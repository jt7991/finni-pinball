// Controlled full-scene diagnostic. Captured scene/history are explicit test
// inputs; expected current-frame images are never uploaded into the renderer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {installNativePostprocessObserver} from './native-postprocess-observer.mjs';
const [debug,base,output]=process.argv.slice(2),captureName=process.argv.find(value=>value.startsWith('--capture-name='))?.slice(15)??'control',reportName=process.argv.find(value=>value.startsWith('--report-name='))?.slice(14)??'initial';
const compareCache=process.argv.includes('--compare-cache');
const requireExact=process.argv.includes('--require-exact');
const nativePrepass=process.argv.includes('--native-prepass');
const nativeUniformABI=process.argv.includes('--native-uniform-abi');
const modelStartup=process.argv.includes('--model-startup');
const observedTimerDelivery=process.argv.includes('--observed-timer-delivery');if(observedTimerDelivery)assert.ok(modelStartup);
const tracePixel=process.argv.find(value=>value.startsWith('--trace-pixel='))?.slice(14).split(',').map(Number);
const traceReflection=process.argv.includes('--trace-reflection');
if(tracePixel)assert.ok(tracePixel.length===2&&tracePixel.every(Number.isInteger));
assert.match(captureName,/^[a-z0-9-]+$/);assert.match(reportName,/^[a-z0-9-]+$/);
const directory=path.join(output,'native-whole-frame-'+captureName),fixture=JSON.parse(fs.readFileSync(path.join(directory,'input.json'))),assetsURL='/three/@fs/'+path.resolve(directory).replaceAll('\\','/')+'/',cacheEnabled=process.argv.includes('--cache');
if(modelStartup){assert.equal(fixture.sceneControl?.startup,true);assert.ok(fixture.startupScene?.clock.animationFrames.length);assert.deepEqual(fixture.startupScene.clock.errors,[]);assert.equal(fixture.renderMode.uniformAlignmentReference,false);if(observedTimerDelivery){assert.ok(fixture.startupScene.timers.events.length);assert.deepEqual(fixture.startupScene.timers.errors,[]);}}
assert.equal(!!fixture.renderMode?.uniformAlignmentReference,process.argv.includes('--uniform-alignment-reference'),'Reference compatibility mode must be selected explicitly; never label a corrected WebGL reference as unchanged');
if(requireExact){
 for(const name of ['initialReflection','previousHDR','priorAO','hdr','reflection','bloom','depth','final'])assert.ok(fixture.images[name],'Exact common-input comparison requires native '+name);
 if(nativePrepass){assert.equal(fixture.renderMode?.nativePrepass,true);assert.equal(fixture.renderMode.staticDisabled,false);assert.equal(fixture.renderMode.reflectedTransmissionObserved,true);const image=fixture.images.reflectionTransmission;assert.ok(image,'Original native dynamic-only reflection binds its actual dummy texture');assert.equal(image.width,1);assert.equal(image.height,1);assert.deepEqual(Array.from(fs.readFileSync(path.join(directory,image.file))),[0,0,0,0],'Original reflection transmission binding is black, not an omitted temporal input');}
 else assert.ok(fixture.images.priorReflectionTransmission,'Exact common-input comparison requires native priorReflectionTransmission');
}
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Page.addScriptToEvaluateOnNewDocument',{source:(process.argv.includes('--detailed')?"if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-three-quality','detailed');":'')+'('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});'});await call('Page.navigate',{url:base});
 for(let i=0;i<600;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 if(!modelStartup){await evaluate('document.getElementById("play").click()');
 for(let i=0;i<600;i++){if(await evaluate('finniThree.game.inLane'))break;if(i===599)throw Error('Port did not reach the native ball-in-plunger control state');await new Promise(resolve=>setTimeout(resolve,50));}}
 const result=await evaluate(`(async()=>{
  'use strict';
  let game,view,modelInputs,stateDescriptors;const fixture=${JSON.stringify(fixture)};
  if(${modelStartup}){
   const {createRuntimeGame}=await import('/three/game-runtime.js'),{createView}=await import('/three/scene.js');
   game=await createRuntimeGame('/three/',()=>{},{play(){},stop(){}});
   for(const [name]of game.rules.objects)game.rules.objects.get(name);await Promise.resolve();await game.flush();
   if(game.time!==0||game.state==='playing')throw Error('Fresh production worker must start at ordinary initialization');
   game.start();await game.flush();let ticks=0;const nativeTimerTimes=new Set(${observedTimerDelivery}?(fixture.startupScene.timers.events.filter(row=>row.interval>=0).map(row=>row.ms)):[]);
   const advance=async due=>{if(due<ticks)throw Error('Native frame clocks are not monotonic');const count=due-ticks,dispatchTimers=${observedTimerDelivery}?Array.from({length:count},(_,i)=>nativeTimerTimes.has(ticks+i)):undefined;await game.debug({action:'advance',ticks:count,...dispatchTimers?{dispatchTimers}:{}});ticks=due;};
   for(const frame of fixture.startupScene.clock.animationFrames){await advance(frame.ms+1);await game.prepareFrame();}
   const finalTicks=fixture.startupScene.freeze.after.ms+1;await advance(finalTicks);await game.flush();
   const actual=game.renderBalls,expected=fixture.balls,bodyErrors=[];if(actual.length!==expected.length)throw Error('Model/native body count mismatch');
   actual.forEach((ball,i)=>{const ref=expected[i];for(const field of ['position','velocity'])for(const axis of ['x','y','z'])if(ball[field][axis]!==ref[field][axis])bodyErrors.push({ball:i,field,axis,actual:ball[field][axis],expected:ref[field][axis]});ball.orientation.forEach((value,j)=>{if(value!==ref.orientation[j])bodyErrors.push({ball:i,field:'orientation',index:j,actual:value,expected:ref.orientation[j]});});});
   if(bodyErrors.length)throw Error('Model-generated startup bodies differ: '+JSON.stringify(bodyErrors.slice(0,8)));
   const inspection=await game.debug({action:'inspect'}),expectedRandom=fixture.startupScene.freeze.after.random;if(inspection.random.some((word,i)=>word!==expectedRandom[i]))throw Error('Model-generated startup random progression differs');
   modelInputs={ticks,animationFrames:fixture.startupScene.clock.animationFrames.length,time:game.time,bodyErrors,random:inspection.random,expectedRandom,copiedNativeProperties:0,copiedNativeBodies:0,observedTimerDelivery:${observedTimerDelivery},positiveTimerDeliveryClocks:nativeTimerTimes.size};
   const canvas=document.createElement('canvas');canvas.id='model-startup-canvas';canvas.style.cssText='position:fixed;left:-10000px;top:0;width:'+fixture.canvas.width/devicePixelRatio+'px;height:'+fixture.canvas.height/devicePixelRatio+'px';document.body.append(canvas);view=await createView(canvas,game,{quality:'detailed'});await game.flush();
   // The prepared worker state is read-only for this draw. A fixture-property
   // or body substitution would throw, rather than silently making it pass.
   for(const object of game.rules.objects.values())Object.freeze(object);
   for(const ball of game.renderBalls){Object.freeze(ball.position);Object.freeze(ball.velocity);Object.freeze(ball);}Object.freeze(game.renderBalls);
   stateDescriptors=new Map(['renderBalls','cabinetOffset','plungerPosition'].map(key=>[key,Object.getOwnPropertyDescriptor(game,key)]));for(const key of stateDescriptors.keys())Object.defineProperty(game,key,{writable:false});
   modelInputs.writeGuards={objects:game.rules.objects.size,balls:game.renderBalls.length};
  }else{({game,view}=finniThree);document.getElementById('controls-panel').showPopover();game.setPaused(true);await game.flush();}
  if(${JSON.stringify(fixture.sceneControl?.flippers==='raised')}){game.input('left',true);game.input('right',true);await game.debug({action:'advance',ticks:200});await game.flush();}
  const source=await(await fetch('/three/scene.js')).text(),THREE=await import(source.match(/import \\* as THREE from "([^"]+)"/)[1]),{applyNativeCamera}=await import('/three/camera-render.js'),base=${JSON.stringify(assetsURL)},renderer=view.renderer,gl=renderer.getContext(),images={},owned=[];
  for(const [name,image]of Object.entries(fixture.images)){const response=await fetch(base+image.file);if(!response.ok)throw Error('Frame image unavailable '+name);images[name]=new (image.arrayType==='Float32Array'?Float32Array:Uint8Array)(await response.arrayBuffer());}
  const w=fixture.canvas.width,h=fixture.canvas.height;renderer.setPixelRatio(1);renderer.setSize(w,h,false);view.resizeTargets();applyNativeCamera(view.camera,view.cameraBounds,w/h,fixture.cameraPreset??'balanced');view.setCacheEnabled(${JSON.stringify(cacheEnabled)});view.setStaticPrerenderEnabled(${JSON.stringify(nativePrepass)});view.lightFrame.setHistoryEnabled(false);
  if(${nativeUniformABI}&&fixture.renderMode.uniformAlignmentReference)throw Error('Raw native upload mode conflicts with an aligned reference');
  if(fixture.renderMode.uniformAlignmentReference)view.classicLights.setUniformAlignmentReferenceEnabled(true);
  else if(view.classicLights.uniformAlignmentReferenceEnabled)throw Error('Runtime default must preserve original native uploads');
  const texture=(data,width,height,type,format=THREE.RGBAFormat)=>{const value=new THREE.DataTexture(data,width,height,format,type);value.flipY=false;value.generateMipmaps=false;value.minFilter=value.magFilter=THREE.NearestFilter;value.needsUpdate=true;value.colorSpace=THREE.NoColorSpace;owned.push(value);return value;};
  // This controlled frame occurs after native startup's first tonemap. Run
  // the fresh model's own first draw before supplying the declared history,
  // so the shared FB exposure has passed through the same source ordering.
  if(${modelStartup}){view.render(1);modelInputs.ownExposureWarmupDraws=1;}
  const seedHalf=(name,target)=>{const ref=fixture.images[name];if(!ref)return;renderer.initRenderTarget(target);renderer.copyTextureToTexture(texture(Uint16Array.from(images[name],THREE.DataUtils.toHalfFloat),ref.width,ref.height,THREE.HalfFloatType),target.texture);};
  seedHalf('previousHDR',view.lightFrame.previous);seedHalf('priorTransmissionFiltered',view.nativeTransmission.targets[1]);seedHalf('initialReflection',view.reflectionPass.target);seedHalf('priorReflectionTransmission',view.nativeTransmission.targets[0]);
  const ao=fixture.images.priorAO;if(ao){const red=Uint8Array.from({length:w*h},(_,i)=>images.priorAO[i*4]);renderer.initRenderTarget(view.lightFrame.postprocess.aoTargets[1]);renderer.copyTextureToTexture(texture(red,w,h,THREE.UnsignedByteType,THREE.RedFormat),view.lightFrame.postprocess.aoTargets[1].texture);}
  const savedPlungerPosition=game.plungerPosition;if(!${modelStartup}&&fixture.plungerPosition!==undefined)game.plungerPosition=fixture.plungerPosition;
  const mechanismInputs={mode:game.state,flippers:game.flippers.map(flipper=>({name:flipper.spec.name,angle:flipper.angle,nativeDegrees:Math.fround(Math.fround(Math.PI/2-flipper.angle)*Math.fround(180/Math.PI)),observedDegrees:fixture.states[flipper.spec.name.toLowerCase()]?.CurrentAngle})),plungerPosition:game.plungerPosition,spinners:game.spinners,gates:game.gates,visualMotions:[...game.visualMotions],targets:[...game.targetMotions]};
  const missingObjects=[],saved=[],keyFor=key=>({GetInPlayIntensity:'inplayintensity',GetInPlayStateBool:'inplayon'}[key]??key.toLowerCase());
  if(!${modelStartup})for(const [name,state]of Object.entries(fixture.states)){
   const object=game.rules.objects.get(name);if(!object){missingObjects.push(name);continue;}const restore={};
   for(const [key,value]of Object.entries(state)){const target=keyFor(key);restore[target]=object[target];object[target]=value;}
   if(Object.hasOwn(state,'GetInPlayIntensity')){restore.sequenceactive=object.sequenceactive;object.sequenceactive=false;}
   saved.push([object,restore]);
  }
  if(!${modelStartup})for(const [name,motion]of game.targetMotions){const state=fixture.states[name];if(state){saved.push([motion,{offset:motion.offset,revision:motion.revision}]);motion.offset=motion.drop&&state.IsDropped?-52:0;motion.revision++;}}
  if(!${modelStartup})for(const [name,pose]of Object.entries(fixture.mechanismPoses??{})){const motion=game.visualMotions.get(name);if(!motion)throw Error('Observed source mechanism is missing: '+name);saved.push([motion,Object.fromEntries(Object.keys(pose).map(key=>[key,motion[key]]))]);Object.assign(motion,pose);}
  const oldBalls=game.renderBalls,oldSubmission=game.submission,oldCabinet=game.cabinetOffset;if(!${modelStartup}){game.renderBalls=fixture.balls;game.submission=undefined;game.cabinetOffset={x:0,y:0};}
  const final=new THREE.WebGLRenderTarget(w,h,{type:THREE.UnsignedByteType,depthBuffer:false}),post=view.lightFrame.postprocess,update=post.update,render=post.render;post.update=()=>update.call(post,fixture.frameIndex);post.render=()=>render.call(post,final);
  const compare=(actual,expected,channels=4,rgb=true)=>{
   const result={samples:0,different:0,alphaSamples:0,alphaDifferent:0,maxAbsolute:0,sumAbsolute:0,examples:[]};
   for(let i=0;i<actual.length;i++){const value=actual instanceof Uint16Array?THREE.DataUtils.fromHalfFloat(actual[i]):actual[i],wanted=expected[i];if(rgb&&i%channels===3){result.alphaSamples++;if(value!==wanted)result.alphaDifferent++;continue;}const error=Math.abs(value-wanted);result.samples++;if(!Object.is(value,wanted)&&value!==wanted){result.different++;result.maxAbsolute=Math.max(result.maxAbsolute,error);result.sumAbsolute+=error;if(result.examples.length<8)result.examples.push({i,actual:value,expected:wanted,error});}}return result;
  };
  const readHalf=target=>{const values=new Uint16Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,values);return values;};
  const traces=[],staticPixels=[],pixel=${JSON.stringify(tracePixel??null)},renderDirect=renderer.renderBufferDirect,buildStatic=view.nativeStatic.build;let tracePhase='first';
  if(pixel)view.nativeStatic.build=function(name,...args){const target=buildStatic.call(this,name,...args),actual=new Float32Array(4);renderer.setRenderTarget(target);gl.readPixels(pixel[0],pixel[1],1,1,gl.RGBA,gl.FLOAT,actual);const index=(pixel[1]*w+pixel[0])*4;staticPixels.push({name,actual:Array.from(actual),initialReflection:name==='reflection'?Array.from(images.initialReflection.subarray(index,index+4)):undefined});return target;};
  if(pixel)renderer.renderBufferDirect=function(...args){
   const camera=args[0],target=renderer.getRenderTarget(),watch=!!camera.userData.nativeCamera&&!!camera.userData.nativeCamera.reflection===${JSON.stringify(traceReflection)}&&target?.width===w&&target.height===h&&(!${JSON.stringify(nativePrepass)}||target===view.lightFrame.target||target===view.reflectionPass.target),before=watch?new Float32Array(4):null;
   if(watch)gl.readPixels(pixel[0],pixel[1],1,1,gl.RGBA,gl.FLOAT,before);
   const result=renderDirect.apply(this,args);
   if(watch){const after=new Float32Array(4);gl.readPixels(pixel[0],pixel[1],1,1,gl.RGBA,gl.FLOAT,after);if(after.some((value,i)=>value!==before[i])){const part=view.nativeTable.parts.find(part=>part.material===args[3]),program=gl.getParameter(gl.CURRENT_PROGRAM),uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const active=gl.getActiveUniform(program,i),location=gl.getUniformLocation(program,active.name);if(location!==null){const value=gl.getUniform(program,location);uniforms[active.name]=ArrayBuffer.isView(value)?Array.from(value):value;}}traces.push({phase:tracePhase,target:target===view.lightFrame.target?'main':'cache',name:part?.spec.name??args[4].name,role:part?.record.role,order:args[4].renderOrder,kind:part?.spec.kind,before:Array.from(before),after:Array.from(after),uniforms,blend:{enabled:gl.isEnabled(gl.BLEND),src:gl.getParameter(gl.BLEND_SRC_RGB),dst:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),equation:gl.getParameter(gl.BLEND_EQUATION_RGB),equationAlpha:gl.getParameter(gl.BLEND_EQUATION_ALPHA)}});}}
   return result;
  };
  try{
   view.render(1);
   const hdrPixels=readHalf(view.lightFrame.target),reflectionPixels=readHalf(view.reflectionPass.target),bloomPixels=readHalf(view.nativeTransmission.targets[0]),background={actual:Array.from(hdrPixels.subarray(0,4),THREE.DataUtils.fromHalfFloat),expected:Array.from(images.hdr.subarray(0,4))},hdr=compare(hdrPixels,images.hdr),reflection=compare(reflectionPixels,images.reflection),bloom=compare(bloomPixels,images.bloom),ldr=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(final,0,0,w,h,ldr);
   const decoded=nativePostprocess.io.readDepth(gl,nativePostprocess.io.textureId(renderer.properties.get(view.lightFrame.target.depthTexture).__webglTexture)),binary=atob(decoded.bytes),bytes=Uint8Array.from(binary,value=>value.charCodeAt(0)),depth=new Float32Array(bytes.buffer),expectedDepth=images.depth,depthResult={samples:w*h,different:0,maxAbsolute:0};
   for(let i=0;i<w*h;i++){const error=Math.abs(depth[i*4]-expectedDepth[i*4]);if(error){depthResult.different++;depthResult.maxAbsolute=Math.max(depthResult.maxAbsolute,error);}}
   let cacheComparison;
   if(${JSON.stringify(compareCache)}){
    view.setCacheEnabled(!${JSON.stringify(cacheEnabled)});seedHalf('previousHDR',view.lightFrame.previous);seedHalf('priorTransmissionFiltered',view.nativeTransmission.targets[1]);seedHalf('initialReflection',view.reflectionPass.target);seedHalf('priorReflectionTransmission',view.nativeTransmission.targets[0]);
    if(ao){renderer.initRenderTarget(post.aoTargets[1]);renderer.copyTextureToTexture(texture(Uint8Array.from({length:w*h},(_,i)=>images.priorAO[i*4]),w,h,THREE.UnsignedByteType,THREE.RedFormat),post.aoTargets[1].texture);}
    tracePhase='second';view.render(1);const secondLDR=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(final,0,0,w,h,secondLDR);
    const bits=(first,second)=>{let different=0,alphaDifferent=0;const examples=[];for(let i=0;i<first.length;i++)if(first[i]!==second[i]){if(i%4===3)alphaDifferent++;else{different++;if(examples.length<8)examples.push({i,first:first[i],second:second[i]});}}return{different,alphaDifferent,examples};};
    cacheComparison={hdr:bits(hdrPixels,readHalf(view.lightFrame.target)),reflection:bits(reflectionPixels,readHalf(view.reflectionPass.target)),bloom:bits(bloomPixels,readHalf(view.nativeTransmission.targets[0])),final:bits(ldr,secondLDR)};
   }
   const color=document.createElement('canvas');color.width=w;color.height=h;const rgba=new Uint8ClampedArray(ldr.length);for(let y=0;y<h;y++)rgba.set(ldr.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);color.getContext('2d').putImageData(new ImageData(rgba,w,h),0,0);
   return{cacheEnabled:${JSON.stringify(cacheEnabled)},modelInputs,mechanismInputs,background,cacheComparison,traces,staticPixels,hdr,reflection,bloom,final:compare(ldr,images.final),depth:depthResult,missingObjects,unsupportedSourceInputs:fixture.missing,glError:gl.getError(),gameError:game.error?.message??null,portPNG:color.toDataURL('image/png').split(',')[1],scope:'Real full scene at native resolution. Current-frame HDR/reflection/bloom/depth/final images are comparisons only. Input scope is declared by the diagnostic mode.'};
  }finally{renderer.renderBufferDirect=renderDirect;view.nativeStatic.build=buildStatic;post.update=update;post.render=render;if(!${modelStartup}){game.plungerPosition=savedPlungerPosition;game.renderBalls=oldBalls;game.submission=oldSubmission;game.cabinetOffset=oldCabinet;}for(const [object,state]of saved)Object.assign(object,state);for(const value of owned)value.dispose();final.dispose();view.lightFrame.setHistoryEnabled(true);if(stateDescriptors)for(const [key,descriptor]of stateDescriptors)Object.defineProperty(game,key,descriptor);if(${modelStartup})await game.dispose();}
 })()`);
 result.scope=fixture.control+' Real full scene after ordinary Start/ball-in-plunger, with native properties, body poses and temporal images as shared inputs. Current-frame output images are comparisons only. Background/cache gates remain mandatory; all color/alpha/depth equality is additionally asserted with --require-exact. This does not establish uninterrupted gameplay parity.';
 if(modelStartup)result.scope=fixture.control+' Fresh production worker initialization, ordinary Start and only observed animation/physical clock advances generate every scene property, body and mechanism. No native properties, poses, random state or plunger state copied into the model. Prior GPU temporal images and FrameIndex remain explicit common inputs. This frozen normal-start frame does not establish uninterrupted rendering/history parity.';
 if(observedTimerDelivery)result.scope+=' Actual native positive-timer delivery clocks are also explicit external diagnostic inputs; every physical interval is processed. This isolates the rendered/model state from the native script-budget policy, which is not reconstructed by this test.';
 fs.writeFileSync(path.join(directory,'port-'+reportName+'.png'),Buffer.from(result.portPNG,'base64'));delete result.portPNG;result.requireExact=requireExact;fs.writeFileSync(path.join(directory,'comparison-'+reportName+'.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.gameError,null);assert.deepEqual(result.background.actual,result.background.expected,'observed native background RGBA');if(compareCache)for(const [name,comparison]of Object.entries(result.cacheComparison)){assert.equal(comparison.different,0,name+' cache RGB');assert.equal(comparison.alphaDifferent,0,name+' cache alpha');}if(requireExact)for(const name of ['hdr','reflection','bloom','depth','final'])assert.equal(result[name].different,0,'Full controlled native '+name);
 if(requireExact){
  assert.equal(result.mechanismInputs.mode,'playing');
  for(const flipper of result.mechanismInputs.flippers)assert.equal(Math.fround(flipper.observedDegrees),flipper.nativeDegrees,flipper.name+' given control angle');
  for(const name of ['hdr','reflection','bloom','final'])assert.equal(result[name].alphaDifferent,0,'Full controlled native '+name+' alpha');
 }
 if(modelStartup){assert.equal(result.modelInputs.copiedNativeProperties,0);assert.equal(result.modelInputs.copiedNativeBodies,0);assert.deepEqual(result.modelInputs.bodyErrors,[]);assert.equal(result.modelInputs.ticks,fixture.startupScene.freeze.after.ms+1);}
}finally{socket.close();}
