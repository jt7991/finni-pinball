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
const tracePixel=process.argv.find(value=>value.startsWith('--trace-pixel='))?.slice(14).split(',').map(Number);
const traceReflection=process.argv.includes('--trace-reflection');
if(tracePixel)assert.ok(tracePixel.length===2&&tracePixel.every(Number.isInteger));
assert.match(captureName,/^[a-z0-9-]+$/);assert.match(reportName,/^[a-z0-9-]+$/);
const directory=path.join(output,'native-whole-frame-'+captureName),fixture=JSON.parse(fs.readFileSync(path.join(directory,'input.json'))),assetsURL='/three/@fs/'+path.resolve(directory).replaceAll('\\','/')+'/',cacheEnabled=process.argv.includes('--cache');
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
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});'});await call('Page.navigate',{url:base});
 for(let i=0;i<600;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 await evaluate('document.getElementById("play").click()');
 for(let i=0;i<600;i++){if(await evaluate('finniThree.game.inLane'))break;if(i===599)throw Error('Port did not reach the native ball-in-plunger control state');await new Promise(resolve=>setTimeout(resolve,50));}
 const result=await evaluate(`(async()=>{
  const {game,view}=finniThree;document.getElementById('controls-panel').showPopover();game.setPaused(true);await game.flush();
  const source=await(await fetch('/three/scene.js')).text(),THREE=await import(source.match(/import \\* as THREE from "([^"]+)"/)[1]),{applyNativeCamera}=await import('/three/camera-render.js'),fixture=${JSON.stringify(fixture)},base=${JSON.stringify(assetsURL)},renderer=view.renderer,gl=renderer.getContext(),images={},owned=[];
  for(const [name,image]of Object.entries(fixture.images)){const response=await fetch(base+image.file);if(!response.ok)throw Error('Frame image unavailable '+name);images[name]=new (image.arrayType==='Float32Array'?Float32Array:Uint8Array)(await response.arrayBuffer());}
  const w=fixture.canvas.width,h=fixture.canvas.height;renderer.setPixelRatio(1);renderer.setSize(w,h,false);view.resizeTargets();applyNativeCamera(view.camera,view.cameraBounds,w/h,fixture.cameraPreset??'balanced');view.setCacheEnabled(${JSON.stringify(cacheEnabled)});view.setStaticPrerenderEnabled(${JSON.stringify(nativePrepass)});view.lightFrame.setHistoryEnabled(false);
  const texture=(data,width,height,type,format=THREE.RGBAFormat)=>{const value=new THREE.DataTexture(data,width,height,format,type);value.flipY=false;value.generateMipmaps=false;value.minFilter=value.magFilter=THREE.NearestFilter;value.needsUpdate=true;value.colorSpace=THREE.NoColorSpace;owned.push(value);return value;};
  const seedHalf=(name,target)=>{const ref=fixture.images[name];if(!ref)return;renderer.initRenderTarget(target);renderer.copyTextureToTexture(texture(Uint16Array.from(images[name],THREE.DataUtils.toHalfFloat),ref.width,ref.height,THREE.HalfFloatType),target.texture);};
  seedHalf('previousHDR',view.lightFrame.previous);seedHalf('priorTransmissionFiltered',view.nativeTransmission.targets[1]);seedHalf('initialReflection',view.reflectionPass.target);seedHalf('priorReflectionTransmission',view.nativeTransmission.targets[0]);
  const ao=fixture.images.priorAO;if(ao){const red=Uint8Array.from({length:w*h},(_,i)=>images.priorAO[i*4]);renderer.initRenderTarget(view.lightFrame.postprocess.aoTargets[1]);renderer.copyTextureToTexture(texture(red,w,h,THREE.UnsignedByteType,THREE.RedFormat),view.lightFrame.postprocess.aoTargets[1].texture);}
  const mechanismInputs={mode:game.state,flippers:game.flippers.map(flipper=>({name:flipper.spec.name,angle:flipper.angle,nativeDegrees:Math.fround(Math.fround(Math.PI/2-flipper.angle)*Math.fround(180/Math.PI)),observedDegrees:fixture.states[flipper.spec.name.toLowerCase()]?.CurrentAngle})),plungerPosition:game.plungerPosition,spinners:game.spinners,gates:game.gates,visualMotions:[...game.visualMotions],targets:[...game.targetMotions]};
  const missingObjects=[],saved=[],keyFor=key=>({GetInPlayIntensity:'inplayintensity',GetInPlayStateBool:'inplayon'}[key]??key.toLowerCase());
  for(const [name,state]of Object.entries(fixture.states)){
   const object=game.rules.objects.get(name);if(!object){missingObjects.push(name);continue;}const restore={};
   for(const [key,value]of Object.entries(state)){const target=keyFor(key);restore[target]=object[target];object[target]=value;}
   if(Object.hasOwn(state,'GetInPlayIntensity')){restore.sequenceactive=object.sequenceactive;object.sequenceactive=false;}
   saved.push([object,restore]);
  }
  for(const [name,motion]of game.targetMotions){const state=fixture.states[name];if(state){saved.push([motion,{offset:motion.offset,revision:motion.revision}]);motion.offset=motion.drop&&state.IsDropped?-52:0;motion.revision++;}}
  const oldBalls=game.renderBalls,oldSubmission=game.submission,oldCabinet=game.cabinetOffset;game.renderBalls=fixture.balls;game.submission=undefined;game.cabinetOffset={x:0,y:0};
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
   if(watch){const after=new Float32Array(4);gl.readPixels(pixel[0],pixel[1],1,1,gl.RGBA,gl.FLOAT,after);if(after.some((value,i)=>value!==before[i])){const part=view.nativeTable.parts.find(part=>part.material===args[3]);traces.push({phase:tracePhase,target:target===view.lightFrame.target?'main':'cache',name:part?.spec.name??args[4].name,role:part?.record.role,order:args[4].renderOrder,kind:part?.spec.kind,before:Array.from(before),after:Array.from(after)});}}
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
   return{cacheEnabled:${JSON.stringify(cacheEnabled)},mechanismInputs,background,cacheComparison,traces,staticPixels,hdr,reflection,bloom,final:compare(ldr,images.final),depth:depthResult,missingObjects,unsupportedSourceInputs:fixture.missing,glError:gl.getError(),gameError:game.error?.message??null,portPNG:color.toDataURL('image/png').split(',')[1],scope:'Real full scene at native resolution after ordinary Start and ball-in-plunger condition, with observed properties, ball states and actual temporal history as shared test inputs. Current-frame HDR/reflection/bloom/depth/final images are comparisons only. Classic inserts explicitly hidden in both scenes. Background equality is asserted; remaining full-frame differences are reported, not accepted as parity.'};
  }finally{renderer.renderBufferDirect=renderDirect;view.nativeStatic.build=buildStatic;post.update=update;post.render=render;game.renderBalls=oldBalls;game.submission=oldSubmission;game.cabinetOffset=oldCabinet;for(const [object,state]of saved)Object.assign(object,state);for(const value of owned)value.dispose();final.dispose();view.lightFrame.setHistoryEnabled(true);}
 })()`);
 result.scope=fixture.control+' Real full scene after ordinary Start/ball-in-plunger, with native properties, body poses and temporal images as shared inputs. Current-frame output images are comparisons only. Background/cache gates remain mandatory; all color/alpha/depth equality is additionally asserted with --require-exact. This does not establish uninterrupted gameplay parity.';
 fs.writeFileSync(path.join(directory,'port-'+reportName+'.png'),Buffer.from(result.portPNG,'base64'));delete result.portPNG;result.requireExact=requireExact;fs.writeFileSync(path.join(directory,'comparison-'+reportName+'.json'),JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.gameError,null);assert.deepEqual(result.background.actual,result.background.expected,'observed native background RGBA');if(compareCache)for(const [name,comparison]of Object.entries(result.cacheComparison)){assert.equal(comparison.different,0,name+' cache RGB');assert.equal(comparison.alphaDifferent,0,name+' cache alpha');}if(requireExact)for(const name of ['hdr','reflection','bloom','depth','final'])assert.equal(result[name].different,0,'Full controlled native '+name);
 if(requireExact){
  assert.equal(result.mechanismInputs.mode,'playing');
  for(const flipper of result.mechanismInputs.flippers)assert.equal(Math.fround(flipper.observedDegrees),flipper.nativeDegrees,flipper.name+' given control angle');
  for(const name of ['hdr','reflection','bloom','final'])assert.equal(result[name].alphaDifferent,0,'Full controlled native '+name+' alpha');
 }
}finally{socket.close();}
