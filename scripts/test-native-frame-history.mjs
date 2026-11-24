// Consecutive whole-scene comparison. Native current/prior pixels are read
// only as expectations. No native image, scene property, body or RNG is set.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import{installNativePostprocessObserver}from './native-postprocess-observer.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'initial-history-r6',report=process.argv.find(arg=>arg.startsWith('--report-name='))?.slice(14)??'first';
assert.match(name,/^[a-z0-9-]+$/);assert.match(report,/^[a-z0-9-]+$/);
const directory=path.join(output,'native-frame-history-'+name),fixture=JSON.parse(fs.readFileSync(path.join(directory,'capture.json'))),authoredCamera=JSON.parse(fs.readFileSync(fs.existsSync(path.join(directory,'authored-camera.json'))?path.join(directory,'authored-camera.json'):output+'/native-authored-startup-camera.json'));
assert.equal(authoredCamera.sourceTableSHA256,fixture.reference.sourceSha256);assert.deepEqual(fixture.frames.map(f=>f.frameIndex),[1,2,3,4,5,6]);assert.equal(fs.existsSync(path.join(directory,'comparison-'+report+'.json')),false);
const assetBase='/three/@fs/'+path.resolve(directory).replaceAll('\\','/')+'/';
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});'});await call('Page.navigate',{url:base});
 for(let i=0;i<600;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 const result=await evaluate(`(async()=>{
  const fixture=${JSON.stringify(fixture)},cameraFields=${JSON.stringify(authoredCamera.fields)},base=${JSON.stringify(assetBase)};
  finniThree.game.setPaused(true);await finniThree.game.flush();
  const {connectSimulation}=await import('/three/game-runtime.js'),{createView}=await import('/three/scene.js'),{nativeCameraPresets}=await import('/three/native-camera.js');
  const source=await(await fetch('/three/scene.js')).text(),THREE=await import(source.match(/import \\* as THREE from "([^"]+)"/)[1]);
  const worker=new Worker('/three/simulation-worker.js',{type:'module'}),game=await connectSimulation(worker,{base:new URL('/three/',location.href).href,scriptBudget:{videoSyncMode:2}});
  for(const [name]of game.rules.objects)game.rules.objects.get(name);await Promise.resolve();await game.flush();
  nativeCameraPresets.authoredStartup=[cameraFields.INCL,cameraFields.FOVX,cameraFields.LAYB,cameraFields.XLTY,cameraFields.XLTZ,cameraFields.SCLX];
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-10000px;width:115px;height:212px';document.body.append(canvas);const view=await createView(canvas,game,{quality:'detailed'}),renderer=view.renderer,gl=renderer.getContext();
  await new Promise(requestAnimationFrame);view.setCacheEnabled(false);
  const final=new THREE.WebGLRenderTarget(230,424,{type:THREE.UnsignedByteType,depthBuffer:false}),post=view.lightFrame.postprocess,render=post.render;post.render=()=>render.call(post,final);
  const readHalf=target=>{const values=new Uint16Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,values);return Float32Array.from(values,THREE.DataUtils.fromHalfFloat);};
  const compare=(a,b,channels=4)=>{if(a.length!==b.length)return{different:Math.max(a.length,b.length),lengths:[a.length,b.length]};let different=0,alphaDifferent=0,maxAbsolute=0;const examples=[];for(let i=0;i<a.length;i++){const error=Math.abs(a[i]-b[i]);if(error){if(channels===4&&i%4===3)alphaDifferent++;else{different++;maxAbsolute=Math.max(maxAbsolute,error);if(examples.length<4)examples.push({i,actual:a[i],expected:b[i]});}}}return{different,alphaDifferent,maxAbsolute,examples};};
  const read=async image=>{const r=await fetch(base+image.file);if(!r.ok)throw Error('Expected native image unavailable');const bytes=await r.arrayBuffer();return image.arrayType==='Float32Array'?new Float32Array(bytes):new Uint8Array(bytes);};
  let ticks=0,playing=false;const timers=new Set(fixture.timers.events.filter(e=>e.interval>=0).map(e=>e.ms)),frames=[];
  const dispatch=(from,count)=>Array.from({length:count},(_,j)=>timers.has(from+j));
  const advance=async due=>{if(due<ticks)throw Error('Physical clock moved backward');if(due>ticks)await game.debug({action:'advance',ticks:due-ticks,dispatchTimers:dispatch(ticks,due-ticks)});ticks=due;};
  for(const [i,frame]of fixture.frames.entries()){
   if(frame.playing&&!playing){await game.rules.execute('Table1.BallTrail=0:Table1.BallFrontDecal="":Tilt=0:TiltSensitivity=0:Dim FinniDmdDigit, FinniDmdState:bFreePlay=True:For Each FinniDmdDigit In Digits:FinniDmdDigit.Visible=False:Next:digitgrid.Visible=False:DMDFlush:ShowTableInfo');game.start();await game.flush();playing=true;}
   const previousBeforeCamera=readHalf(view.lightFrame.previous),preset=playing?'balanced':'authoredStartup';if(view.camera.userData.nativeCamera.preset!==preset)view.setCamera(preset);
   const previousAfterCamera=readHalf(view.lightFrame.previous),cameraHistory=compare(previousAfterCamera,previousBeforeCamera);
   if(i<2)view.setStaticPrerenderEnabled(i!==0);
   const animationTicks=i<2?0:frame.snapshot.lastAnimationMilliseconds+1,submissionTicks=i<2?0:frame.snapshot.ms+1;
   await advance(animationTicks);
   if(i>0){
    const raw=worker.postMessage.bind(worker);worker.postMessage=message=>{if(message.type==='submission'&&submissionTicks>ticks){raw({type:'debug',action:'advance',ticks:submissionTicks-ticks,dispatchTimers:dispatch(ticks,submissionTicks-ticks)});ticks=submissionTicks;}return raw(message);};
    try{await game.prepareSubmissionFrame();}finally{worker.postMessage=raw;}
   }
   const inspection=await (i===0?game.debug({action:'inspect'}):Promise.resolve(null));
   const expected={};for(const [key,image]of Object.entries(frame.images))expected[key]=await read(image);
   const before={previousHDR:compare(readHalf(view.lightFrame.previous),expected.previousHDR)};
   const priorAO=new Uint8Array(230*424),pack=gl.getParameter(gl.PACK_ALIGNMENT);gl.pixelStorei(gl.PACK_ALIGNMENT,1);try{renderer.initRenderTarget(post.aoTargets[1]);renderer.readRenderTargetPixels(post.aoTargets[1],0,0,230,424,priorAO);}finally{gl.pixelStorei(gl.PACK_ALIGNMENT,pack);}before.ao=compare(priorAO,Uint8Array.from({length:priorAO.length},(_,j)=>expected.priorAO[j*4]),1);
   view.render(1);
   const hdr=compare(readHalf(view.lightFrame.target),expected.hdr),bloom=compare(readHalf(view.nativeTransmission.targets[0]),expected.bloom),ldr=new Uint8Array(230*424*4);renderer.readRenderTargetPixels(final,0,0,230,424,ldr);
   const sampled=nativePostprocess.io.readDepth(gl,nativePostprocess.io.textureId(renderer.properties.get(view.lightFrame.target.depthTexture).__webglTexture)),bytes=Uint8Array.from(atob(sampled.bytes),v=>v.charCodeAt(0)),depth=compare(new Float32Array(bytes.buffer),expected.depth);
   frames.push({frame:frame.frameIndex,ms:frame.snapshot.ms,animationMilliseconds:frame.snapshot.lastAnimationMilliseconds,ticks,playing,before,cameraHistory,hdr,bloom,depth,final:compare(ldr,expected.final),random:i===0?inspection.random:undefined});
   if(i>0)game.finishSubmissionFrame();
  }
  await game.dispose();return{frames,glError:gl.getError(),copiedNativeImages:0,copiedNativeProperties:0,copiedNativeBodies:0,copiedNativeRandom:0,scope:'Fresh production worker/model and renderer beginning at original initialization. Original authored startup camera is an explicit source-table input. Ordinary main-player configuration/Start, and independently observed animation/submission and positive-timer delivery clocks are diagnostic inputs. All prior textures, AO, bloom, reflections, current scene properties, bodies and RNG are port-owned. Native pixels are expectations only. This comparison exposes remaining differences; no parity is claimed unless every frame/buffer passes.'};
 })()`);
 fs.writeFileSync(path.join(directory,'comparison-'+report+'.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));assert.deepEqual(errors,[]);assert.equal(result.glError,0);for(const frame of result.frames)for(const key of ['hdr','bloom','depth','final']){assert.equal(frame[key].different,0,'frame'+frame.frame+' '+key);assert.equal(frame[key].alphaDifferent,0,'frame'+frame.frame+' '+key+' alpha');}
}finally{socket.close();}
