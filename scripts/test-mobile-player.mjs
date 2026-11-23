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
const capture=async name=>writeFile(`${output}/${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
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
    await evaluate(`playerTest.playingClass=document.body.className;document.body.classList.remove('playing','game-in-play');document.getElementById('waiting').hidden=false;document.getElementById('play').disabled=false;document.getElementById('play').textContent='Start game';document.getElementById('progress').hidden=true;document.getElementById('loading').textContent='Table loaded.';Promise.all([...document.querySelectorAll('.start-content img')].map(i=>i.decode()))`);
    const titleScreen=await evaluate(`(()=>{const inside=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};return{fit:[...document.querySelectorAll('.start-content h2,.start-dmd,.preview-frame,#play,#loading')].every(inside),pixel:document.fonts.check('24px Pixel'),help:inside(document.getElementById('touch-help'))}})()`);
    assert.equal(titleScreen.fit,true,`${name} selected title screen fits every viewport`);
    assert.equal(titleScreen.pixel,true,`${name} bundled pixel face loads`);
    assert.equal(titleScreen.help,true,`${name} title screen help stays reachable`);
    await capture(`${name}-start`);
    if(name==='android-portrait'){
      await evaluate(`document.body.classList.add('engine-error');document.getElementById('loading').textContent='The graphics context was lost. Reload to restart the game.';document.getElementById('play').textContent='Reload and retry'`);
      await capture('mobile-error');
      await evaluate(`document.body.classList.remove('engine-error')`);
    }
    await evaluate(`document.body.className=playerTest.playingClass;document.getElementById('waiting').hidden=true`);
    assert.equal(await evaluate('document.getElementById("camera-view").value'),'balanced',`${name} default camera`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${name} horizontal overflow`);
    assert.equal(await evaluate('document.documentElement.scrollHeight<=innerHeight'),true,`${name} vertical overflow`);
    const help=await evaluate(`(()=>{const r=document.getElementById('touch-help').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    assert.ok(help.w>=44&&help.h>=44&&help.x>=0&&help.x+help.w<=width,`${name} small help button reachable`);
    await evaluate('document.getElementById("touch-help").click()');
    await wait('!document.getElementById("touch-guide").hidden');
    if(!mobile)assert.equal(await evaluate('getComputedStyle(document.querySelector(".keyboard-help-text")).display'),'block','Desktop help has keyboard instructions');
    await capture(`${name}-help`);
    await evaluate('document.getElementById("dismiss-touch-guide").click()');
    assert.equal(await evaluate('document.getElementById("touch-guide").hidden'),true,`${name} help dismisses`);
    if(!mobile){await capture(name);continue;}
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
    assert.equal(await evaluate('[...document.querySelectorAll(".flip-zones button")].every(b=>getComputedStyle(b,"::after").opacity==="0")'),true,`${name} held flippers do not show Flip tabs`);
    await touch([]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} release`);
    assert.equal(await evaluate('playerTest.scripts.filter(s=>s.includes("KeyDown")&&s.includes("Flipper")).length'),2);
    assert.equal(await evaluate('playerTest.scripts.filter(s=>s.includes("KeyUp")&&s.includes("Flipper")).length'),2);
    if(name==='android-portrait'){
      await evaluate(`playerTest.holdMenus=0;document.querySelector('[data-action=left]').addEventListener('contextmenu',()=>playerTest.holdMenus++)`);
      await touch([left]);await new Promise(resolve=>setTimeout(resolve,1100));
      assert.equal(await evaluate('document.querySelector("[data-action=left]").getAttribute("aria-pressed")'),'true','Long hold keeps the flipper engaged');
      assert.equal(await evaluate('playerTest.holdMenus'),0,'Long hold does not start the browser context gesture');
      await touch([]);
      assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,'Long hold releases normally');
    }
    await touch([left]);
    await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} cancellation`);
    await touch([right]);await evaluate('window.dispatchEvent(new Event("blur"))');await touch([]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} focus loss`);
    const upperLeft=point(geometry.stage.x+16,geometry.stage.y+geometry.stage.h*.12,3);
    await touch([upperLeft]);
    assert.equal(await evaluate('document.querySelector("[data-action=left]").getAttribute("aria-pressed")'),'true',`${name} side space above the lower controls flips`);
    await evaluate('document.getElementById("touch-help").click()');
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} help releases held flippers`);
    assert.equal(await evaluate('[...document.querySelectorAll(".flip-zones button")].every(b=>getComputedStyle(b,"::after").opacity==="1")'),true,`${name} help still labels flipper zones`);
    await touch([]);await evaluate('document.getElementById("dismiss-touch-guide").click()');
    assert.equal(await evaluate('document.activeElement.id'),'canvas',`${name} help restores keyboard/game focus`);
    await evaluate('document.getElementById("latch").checked=true;document.getElementById("latch").dispatchEvent(new Event("change"))');
    await touch([left]);await touch([]);
    assert.equal(await evaluate('document.querySelector("[data-action=left]").getAttribute("aria-pressed")'),'true',`${name} normal pointer release retains toggle mode`);
    await touch([left]);await touch([]);
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} second tap releases toggle mode`);
    await touch([left]);await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await evaluate('document.querySelectorAll(".flip-zones .pressed").length'),0,`${name} cancelled toggle cannot stick`);
    await evaluate('document.getElementById("latch").checked=false;document.getElementById("latch").dispatchEvent(new Event("change"));document.getElementById("controls-panel").showPopover()');
    await wait('!!document.querySelector(".panel:popover-open")');
    if(name==='android-portrait'){
      await capture('mobile-settings');
      await evaluate(`document.getElementById('controls-panel').hidePopover();document.getElementById('leaderboard-panel').showPopover()`);
      await capture('mobile-scores');
      await evaluate(`document.getElementById('leaderboard-panel').hidePopover();document.getElementById('initials-dialog').showModal()`);
      await capture('mobile-initials');
      await evaluate(`document.getElementById('initials-dialog').close();document.getElementById('controls-panel').showPopover()`);
    }
    await evaluate('playerTest.scripts.length=0;document.querySelector("[data-action=left]").dispatchEvent(new PointerEvent("pointerdown",{pointerId:88,bubbles:true}))');
    assert.equal(await evaluate('playerTest.scripts.some(s=>s.includes("KeyDown"))'),false,`${name} settings cannot send gameplay input through the sheet`);
    await evaluate('document.getElementById("controls-panel").hidePopover()');
    await wait('!document.querySelector(".panel:popover-open")');
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
      await evaluate('Object.defineProperty(document.documentElement,"requestFullscreen",{configurable:true,value:undefined});Object.defineProperty(document.documentElement,"webkitRequestFullscreen",{configurable:true,writable:true,value:undefined});document.getElementById("fullscreen").click()');
      assert.equal(await evaluate('!document.getElementById("screen-message").hidden'),true,'Unsupported fullscreen has a visible message');
      await evaluate('Object.defineProperty(document.documentElement,"requestFullscreen",{configurable:true,value:()=>Promise.reject(Error("denied"))});document.getElementById("fullscreen").click()');
      await wait('document.getElementById("screen-message").textContent.includes("try again")');
      await evaluate(`Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:undefined});
        document.documentElement.webkitRequestFullscreen=function(){
          playerTest.webkitArgumentCount=arguments.length;
          Object.defineProperty(document,'webkitFullscreenElement',{configurable:true,value:document.documentElement});
          document.dispatchEvent(new Event('webkitfullscreenchange'));
        };document.getElementById('fullscreen').click()`);
      await wait('document.body.classList.contains("fullscreen-play")');
      assert.equal(await evaluate('playerTest.webkitArgumentCount'),0,'Safari prefixed fullscreen receives no standard-options object');
      assert.equal(await evaluate('document.getElementById("screen-message").hidden'),true,'Successful fullscreen clears earlier failure message');
      await evaluate(`Object.defineProperty(document,'webkitFullscreenElement',{configurable:true,value:null});document.dispatchEvent(new Event('webkitfullscreenchange'));delete document.documentElement.webkitRequestFullscreen`);
      await evaluate('document.dispatchEvent(new Event("webkitfullscreenerror"))');
      assert.equal(await evaluate('!document.getElementById("screen-message").hidden'),true,'Safari asynchronous fullscreen failure is visible');
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
  await evaluate('playerTest.failNext={message:"Native test failure",errno:44};document.querySelector("[data-action=left]").dispatchEvent(new PointerEvent("pointerdown",{pointerId:89,bubbles:true}))');
  assert.equal(await evaluate('document.getElementById("play").textContent'),'Reload and retry','Native input exception offers recovery');
  assert.equal(await evaluate('document.querySelectorAll("[data-action]:not(:disabled),[data-action].pressed").length'),0,'Failed engine stops and releases every control');
  assert.ok(await evaluate('document.getElementById("loading").textContent.includes("Native test failure (errno 44)")'),'Native failure preserves useful details');
  console.log('PASS: responsive player; side-space and two-touch flippers; toggle/cancel/blur/help/settings cleanup; standard and Safari-prefixed fullscreen recovery; native error recovery. Headless browser fixtures, not physical-phone certification.');
}finally{socket.close();}
