import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {nativeHitDescriptor,collideNativeHitSurface} from '../native-hit-event.js';
import {NativeBall} from '../native-ball.js';

const material={elasticity:.3,elasticity_falloff:0,friction:0,scatter:0,difficulty:1};
const hit={normal:{x:1,y:0,z:0},gap:0};
function ball(){
  let state={p:{x:0,y:0,z:25},v:{x:-6,y:0,z:0},m:{x:0,y:0,z:0},mass:1,inertia:250};
  const native={eventPosition:{x:-10000,y:-10000,z:-10000},eventDistance:0,sync:()=>state.p,snapshot:()=>structuredClone(state),commit:value=>{state=value;},acceptHitEvent:NativeBall.prototype.acceptHitEvent};
  return {native,linvel:()=>({x:state.v.x,y:-state.v.y,z:state.v.z}),reset(speed=6){state.v={x:-speed,y:0,z:0};},get state(){return state;}};
}

test('native shape classes preserve wall reflection while limiting which surfaces fire Hit',()=>{
  const shapes=[['wall',false,true],['point',false,true],['edge',true,true],['edge',false,false],['polygon',false,false],['triangle',false,false],['plane',false,false],['circle',false,false]];
  for(const kind of ['Wall','Primitive','Rubber','Ramp'])for(const [shapeKind,vertical,wallEvent]of shapes){
    const body=ball(),event=nativeHitDescriptor({name:'test',kind,hit_event:true,threshold:2}),restricted=['triangle','polygon'].includes(shapeKind)||shapeKind==='edge'&&!vertical;
    const expected=wallEvent||kind!=='Wall'&&restricted;let count=0;
    collideNativeHitSurface(body,hit,{kind:shapeKind,vertical},event,material,.25,()=>{throw Error('zero scatter must not draw');},()=>count++);
    assert.equal(count,Number(expected),kind+'/'+shapeKind+'/'+vertical);assert.ok(body.state.v.x>0,'event eligibility must not remove the physical wall response');
    assert.equal(event.currentHitThreshold,expected&&restricted?6:0,'only ePrimitive polygon/triangle/3D-line handlers update HitThreshold');
  }
});

test('rest-event suppression shares ball history across objects and still updates primitive HitThreshold',()=>{
  const body=ball(),a=nativeHitDescriptor({name:'a',kind:'Primitive',hit_event:true,threshold:2}),b=nativeHitDescriptor({name:'b',kind:'Wall',hit_event:true,threshold:2});let events=0;
  const collide=(event,shape,speed=6)=>{body.reset(speed);return collideNativeHitSurface(body,hit,{kind:shape},event,material,.25,()=>.5,()=>events++);};
  assert.equal(collide(a,'triangle'),true);assert.equal(events,1);assert.equal(body.native.eventDistance,0);
  assert.equal(collide(b,'wall'),false,'another object at the same resting position is suppressed');
  assert.equal(collide(a,'triangle',4),false);assert.equal(a.currentHitThreshold,4,'native updates the measured threshold before generic Hit filtering');
  body.native.eventDistance=.5;assert.equal(collide(b,'wall'),true,'sufficient squared travel permits an event at the old position');assert.equal(body.native.eventDistance,0);
  body.native.eventPosition={x:1,y:0,z:25};assert.equal(collide(a,'point'),true,'a sufficiently different location fires immediately');
  a.collider={isEnabled:()=>false};body.native.eventDistance=1;assert.equal(collide(a,'triangle'),false);assert.equal(body.native.eventDistance,1,'disabled event dispatch preserves travel history');
});

test('generic hit flags and thresholds are baked independently of later script settings; rubber uses native threshold two',()=>{
  const spec={name:'wall',kind:'Wall',hit_event:true,threshold:2},event=nativeHitDescriptor(spec);spec.hit_event=false;spec.threshold=100;
  const body=ball();let count=0;collideNativeHitSurface(body,hit,{kind:'wall'},event,material,.25,()=>.5,()=>count++);assert.equal(count,1);
  assert.equal(nativeHitDescriptor({kind:'Rubber',hit_event:true,threshold:100}).threshold,2);
  const quiet=ball();quiet.reset(1);collideNativeHitSurface(quiet,hit,{kind:'wall'},event,material,.25,()=>.5,()=>count++);assert.equal(count,1,'a subthreshold bounce remains silent');
});

test('seventeen native wall/primitive/rubber recordings retain event classes, scores, sounds and every RNG frame',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-material-events.mjs','--check','--json','--report=.work/three-review/material-events-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:5*1024*1024}));
  assert.equal(reports.length,17);assert.equal(reports.reduce((sum,r)=>sum+r.nativeRandomAudit.length,0),1739);
  for(const report of reports)assert.ok(report.nativeRandomAudit.every(row=>row.agrees),report.name+' physics RNG');
  for(const name of ['rlband003-face-6','rlband004-face-6','rlband007-face-6','rlband003-baked-flags'])assert.equal(reports.find(r=>r.name===name).samples.at(-1).actual[12],110);
  for(const name of ['rlband003-top','rlband003-top-edge','rlband003-disabled'])assert.equal(reports.find(r=>r.name===name).events.length,0);
  assert.equal(reports.find(r=>r.name==='Rubber001-enabled').events.length,1);
});
