import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const [debug,base,output]=process.argv.slice(2);
const tabs=await (await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map();
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const wait=async expression=>{
  for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,40));}
  throw Error(`Timed out: ${expression}`);
};
const touch=points=>call('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points});
const point=(x,y,id)=>({x,y,id,radiusX:3,radiusY:3,force:1});
await call('Page.enable');
await call('Emulation.setFocusEmulationEnabled',{enabled:true});
try{
  for(const [width,height,name] of [[360,780,'android-portrait'],[844,390,'android-landscape'],[320,568,'small-phone'],[768,1024,'tablet'],[1440,900,'desktop']]){
    const mobile=name!=='desktop';
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile});
    await call('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});
    await call('Page.navigate',{url:base});
    await wait('!!window.playerTest');
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.equal(await evaluate('document.getElementById("camera-view").value'),'balanced',`${name} default camera`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${name} horizontal overflow`);
    assert.equal(await evaluate('document.documentElement.scrollHeight<=innerHeight'),true,`${name} vertical overflow`);
    if(!mobile)continue;
    const geometry=await evaluate(`(()=>{
      const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      return {stage:box('.stage'),full:box('#fullscreen'),left:box('[data-action=left]'),right:box('[data-action=right]'),dmd:box('#dmd')};
    })()`);
    assert.ok(geometry.full.w>=44&&geometry.full.h>=44,`${name} fullscreen target`);
    assert.ok(geometry.full.x>=0&&geometry.full.x+geometry.full.w<=width,`${name} fullscreen reachable`);
    assert.ok(geometry.stage.h>height*.6,`${name} usable playfield height`);
    assert.ok(geometry.left.w>=44&&geometry.right.w>=44,`${name} flipper zones`);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-action=left]")).webkitTapHighlightColor'),'rgba(0, 0, 0, 0)');
    const left=point(geometry.left.x+geometry.left.w*.35,geometry.left.y+geometry.left.h*.6,1);
    const right=point(geometry.right.x+geometry.right.w*.65,geometry.right.y+geometry.right.h*.6,2);
    await evaluate('playerTest.scripts.length=0');
    await touch([left]);await touch([left,right]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),2,`${name} simultaneous flippers`);
    await touch([]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} release`);
    assert.equal(await evaluate('playerTest.scripts.filter(s=>s.includes("KeyDown")&&s.includes("Flipper")).length'),2);
    assert.equal(await evaluate('playerTest.scripts.filter(s=>s.includes("KeyUp")&&s.includes("Flipper")).length'),2);
    await touch([left]);
    await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} cancellation`);
    await touch([right]);await evaluate('window.dispatchEvent(new Event("blur"))');await touch([]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} focus loss`);
    // Capture actual UI/CSS with the documented isolated engine fixture.
    await new Promise(resolve=>setTimeout(resolve,150));
    await writeFile(`${output}/${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    if(name==='android-portrait'){
      await call('Input.dispatchMouseEvent',{type:'mousePressed',x:geometry.full.x+22,y:geometry.full.y+22,button:'left',clickCount:1});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:geometry.full.x+22,y:geometry.full.y+22,button:'left',clickCount:1});
      // Windows headless Edge denies native fullscreen even with a trusted click.
      // Check its visible recovery, then exercise enter/exit events with an API fixture.
      await wait('!!document.fullscreenElement || !document.getElementById("screen-message").hidden');
      if(await evaluate('!!document.fullscreenElement')){
        await evaluate('document.exitFullscreen()');
      }
      await evaluate(`Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:async()=>{
        Object.defineProperty(document,'fullscreenElement',{configurable:true,value:document.documentElement});
        document.dispatchEvent(new Event('fullscreenchange'));
      }});document.getElementById('fullscreen').click()`);
      await wait('document.body.classList.contains("fullscreen-play")');
      assert.equal(await evaluate('document.getElementById("fullscreen").getAttribute("aria-pressed")'),'true');
      await evaluate(`Object.defineProperty(document,'fullscreenElement',{configurable:true,value:null});document.dispatchEvent(new Event('fullscreenchange'))`);
      assert.equal(await evaluate('document.body.classList.contains("fullscreen-play")'),false);
      await evaluate('Object.defineProperty(document.documentElement,"requestFullscreen",{configurable:true,value:undefined});document.getElementById("fullscreen").click()');
      assert.equal(await evaluate('!document.getElementById("screen-message").hidden'),true,'Unsupported fullscreen has a visible message');
      await evaluate('Object.defineProperty(document.documentElement,"requestFullscreen",{configurable:true,value:()=>Promise.reject(Error("denied"))});document.getElementById("fullscreen").click()');
      await wait('document.getElementById("screen-message").textContent.includes("try again")');
    }
    const fit=await evaluate(`(()=>{
      const c=document.getElementById('canvas'),stage=document.querySelector('.screen');
      c.width=Math.round(stage.clientWidth*2);c.height=Math.round(stage.clientHeight*2);
      document.getElementById('camera-view').dispatchEvent(new Event('change'));
      return {actual:c.getBoundingClientRect().height,available:stage.clientHeight};
    })()`);
    assert.ok(Math.abs(fit.actual-fit.available)<2,`${name} portrait render buffer fills available height`);
    await evaluate('localStorage.setItem("finni-camera-v2","classic")');
    await call('Page.navigate',{url:base});await wait('!!window.playerTest');
    assert.equal(await evaluate('document.getElementById("camera-view").value'),'classic','Saved camera preserved');
    await evaluate('localStorage.removeItem("finni-camera-v2")');
  }
  console.log('PASS: phone portrait/landscape, small phone, tablet and desktop layout; Balanced default; two-touch flippers, release/cancel/blur; fullscreen API event fixtures and unavailable/denied recovery. Headless native fullscreen may be denied; no physical Android or physics/FPS certification.');
}finally{socket.close();}
