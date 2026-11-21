import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.id){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expr=>{for(let i=0;i<1800;i++){if(await evaluate(expr))return;await delay(50)}throw Error(`Timed out: ${expr}`)};
try{
 await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:412,height:783,deviceScaleFactor:2.625,mobile:true});
 await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  const quality=new URL(location.href).searchParams.get('graphics-test');
  if(quality)localStorage.setItem('finni-graphics-v1',quality);
  window.renderProfile={uploads:[],errors:[]};
  const p=WebGL2RenderingContext.prototype,upload=p.texImage2D,storage=p.texStorage2D,compile=p.compileShader,link=p.linkProgram;
  p.texImage2D=function(...args){const w=args.length>=9?args[3]:args.at(-1)?.width,h=args.length>=9?args[4]:args.at(-1)?.height;if(w&&h)renderProfile.uploads.push([w,h]);return upload.apply(this,args)};
  p.texStorage2D=function(...args){renderProfile.uploads.push([args[3],args[4]]);return storage.apply(this,args)};
  p.compileShader=function(s){compile.call(this,s);if(!this.getShaderParameter(s,this.COMPILE_STATUS))renderProfile.errors.push(this.getShaderInfoLog(s))};
  p.linkProgram=function(p){link.call(this,p);if(!this.getProgramParameter(p,this.LINK_STATUS))renderProfile.errors.push(this.getProgramInfoLog(p))};
 `});
 const results=[];
 for(const quality of ['detailed','performance']){
  await call('Page.navigate',{url:`${base}/?graphics-test=${quality}`});
  await wait('!!window.finni && !document.getElementById("play").disabled');
  const settings=await evaluate(`finni.engine.FS.readFile('/libsdl/VPinballX/10.8/VPinballX.ini',{encoding:'utf8'})`);
  if(quality==='performance'){
   assert.equal(Number(settings.match(/^AAFactor\s*=\s*(.*)$/m)?.[1]),1,'Native internal resolution factor');
   for(const text of ['MaxTexDimension=2048','DisableAO=1','PFReflection=0','ForceBloomOff=1'])assert.ok(settings.includes(text),text);
   assert.ok(await evaluate('document.getElementById("log").textContent.includes("Settings file was loaded")'),'Settings installed before native initialization');
  }
  const button=await evaluate(`(()=>{const r=document.getElementById('play').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...button,button:'left',clickCount:1});
  await wait('document.body.classList.contains("playing")');
  await delay(2000);
  const status=await evaluate(`(()=>{const c=document.getElementById('canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {canvas:[c.width,c.height],renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),uploadCount:renderProfile.uploads.length,uploadedTexels:renderProfile.uploads.reduce((a,[w,h])=>a+w*h,0),largestTexture:Math.max(...renderProfile.uploads.flat()),errors:renderProfile.errors,packedTableRetained:finni.engine.FS.analyzePath('/tables/finni.vpx').exists}})()`);
  assert.deepEqual(status.errors,[],'No shader errors');
  assert.equal(status.packedTableRetained,false,'Packed download released after native table loading');
  if(quality==='performance'){
   assert.ok(status.largestTexture<=2048,'Texture cap actually reaches GPU uploads');
   assert.ok(status.canvas[0]<=724&&status.canvas[1]<=1054,'Final phone render buffer is capped before native initialization');
  }
  const sample=await evaluate(`new Promise(resolve=>{let last;const frames=[];const start=performance.now();function tick(t){if(last!==undefined)frames.push(t-last);last=t;if(performance.now()-start<8000)requestAnimationFrame(tick);else{frames.sort((a,b)=>a-b);resolve({frames:frames.length,elapsedMs:performance.now()-start,fps:frames.length*1000/(performance.now()-start),p50Ms:frames[Math.floor(frames.length*.5)],p95Ms:frames[Math.floor(frames.length*.95)]})}}requestAnimationFrame(tick)})`);
  await writeFile(`${output}/${quality}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  results.push({quality,status,sample});
  console.log(JSON.stringify(results.at(-1),null,2));
 }
 assert.ok(results[1].status.uploadedTexels<results[0].status.uploadedTexels*.7,'Performance materially reduces GPU texture/render-target allocation');
 await writeFile(`${output}/render-profiles.json`,JSON.stringify({note:'Desktop Chromium with phone viewport. This comparison does not establish physical Android or iPhone frame rates.',results},null,2));
 console.log('PASS: real engine reads graphics settings before startup, capped texture uploads, fewer allocated texels and no shader errors in either profile.');
}finally{ws.close()}
