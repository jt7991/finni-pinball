import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map(),errors=[],requests=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const touch=points=>call('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:4,radiusY:4,force:1}))});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  for(const [width,height,name]of [[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape'],[1440,900,'desktop']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:name!=='desktop'});
    await call('Emulation.setTouchEmulationEnabled',{enabled:name!=='desktop',maxTouchPoints:5});
    await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
    await evaluate('document.getElementById("play").click()');
    await wait('document.body.classList.contains("ball-in-plunger")');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name} no overflow`);
    if(name==='phone'||name==='small-phone'){
      const left=await center('#flip-zones [data-input=left]'),right=await center('#flip-zones [data-input=right]');
      await touch([left,right]);assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),2);
      await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),0);
      const launch=await center('#launch');await touch([launch]);await new Promise(r=>setTimeout(r,500));await touch([]);
    }else{
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});
      assert.ok(await evaluate('document.querySelector("[data-input=left]").classList.contains("pressed")'));
      await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(r=>setTimeout(r,500));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});
    }
    await wait('!document.body.classList.contains("ball-in-plunger")');
    if(name!=='desktop')await evaluate('document.getElementById("touch-help").click();document.querySelector("#touch-guide [popovertarget=controls-panel]").click()');
    else await evaluate('document.getElementById("settings").click()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    await evaluate('document.getElementById("controls-panel").hidePopover()');
    if(name!=='desktop')await evaluate('document.getElementById("dismiss-touch-guide").click()');
    await writeFile(`${output}/main-ui-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('PASS',name,'main UI, real controls, launch and settings');
  }
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/table\.vpx|vpinball\.(wasm|js)/.test(url)),false);
}finally{socket.close();}
