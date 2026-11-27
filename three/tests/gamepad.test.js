import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamepadControls} from '../gamepad.js';

function fixture(){
  const host=new EventTarget(),doc=new EventTarget(),calls=[],released=[];
  let pads=[],denied=false,focus=true,all=0,nextFrame;
  host.requestAnimationFrame=fn=>{nextFrame=fn;return 1;};host.cancelAnimationFrame=()=>{};
  doc.hasFocus=()=>focus;doc.hidden=false;
  const pad=index=>({index,connected:true,mapping:'standard',buttons:Array.from({length:17},()=>({pressed:false}))});
  const nav={getGamepads(){if(denied)throw Error('Gamepad access denied');return pads;}};
  const game=createGamepadControls({host,doc,nav,input:(...args)=>calls.push(args),releaseSource:source=>released.push(source),releaseAll:()=>all++});
  return {game,host,doc,calls,released,pad,setPads:value=>pads=value,deny:()=>denied=true,focus:value=>focus=value,get all(){return all;},frame:()=>nextFrame()};
}

test('standard mapping combines shoulder/trigger presses and preserves held launch',()=>{
  const f=fixture(),pad=f.pad(0);f.setPads([pad]);
  for(const index of [4,6,5,0,2,14,12,15,9])pad.buttons[index].pressed=true;
  f.game.sample();
  assert.deepEqual(f.calls.map(([name,down])=>[name,down]),['left','right','launch','action','nudgeLeft','nudgeForward','nudgeRight','start'].map(name=>[name,true]));
  f.game.sample();assert.equal(f.calls.length,8,'held inputs do not repeat');
  pad.buttons[4].pressed=false;f.game.sample();assert.equal(f.calls.length,8,'the other left trigger remains pressed');
  pad.buttons[6].pressed=false;pad.buttons[0].pressed=false;f.game.sample();
  assert.deepEqual(f.calls.slice(-2),[['left',false,'gamepad:0'],['launch',false,'gamepad:0']]);f.game.dispose();
});

test('disconnect releases only its controller source and ignores nonstandard pads',()=>{
  const f=fixture(),a=f.pad(0),b=f.pad(1),ignored=f.pad(2);ignored.mapping='';
  for(const pad of [a,b,ignored])pad.buttons[4].pressed=true;
  f.setPads([a,b,ignored]);f.game.sample();assert.equal(f.calls.length,2);
  a.connected=false;f.game.sample();assert.deepEqual(f.released,['gamepad:0']);
  const event=new Event('gamepaddisconnected');event.gamepad=b;f.host.dispatchEvent(event);
  assert.deepEqual(f.released,['gamepad:0','gamepad:1']);f.game.dispose();
});

test('focus return records already-held buttons without restarting them',()=>{
  const f=fixture(),pad=f.pad(0);f.setPads([pad]);pad.buttons[4].pressed=true;f.game.sample();
  f.focus(false);f.host.dispatchEvent(new Event('blur'));assert.equal(f.all,1);
  pad.buttons[0].pressed=true;f.game.sample();assert.equal(f.calls.length,1);
  f.focus(true);f.game.sample();assert.equal(f.calls.length,1,'newly held launch is suppressed on refocus');
  pad.buttons[0].pressed=false;f.game.sample();pad.buttons[0].pressed=true;f.game.sample();
  assert.deepEqual(f.calls.slice(-2),[['launch',false,'gamepad:0'],['launch',true,'gamepad:0']]);
  f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));f.host.dispatchEvent(new Event('pagehide'));assert.equal(f.all,3);f.game.dispose();
});

test('permission failure releases inputs and leaves the polling loop alive',()=>{
  const f=fixture(),pad=f.pad(0);f.setPads([pad]);pad.buttons[4].pressed=true;f.frame();
  f.deny();f.frame();assert.deepEqual(f.released,['gamepad:0']);f.frame();assert.deepEqual(f.released,['gamepad:0']);f.game.dispose();
});
