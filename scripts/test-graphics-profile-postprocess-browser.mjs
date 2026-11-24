import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let seq=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
async function check(fixture,base){
 const {game,view}=finniThree;game.setPaused(true);await game.flush();
 const source=await(await fetch('/three/scene.js')).text(),THREE=await import(source.match(/import \* as THREE from "([^"]+)"/)[1]);
 const {loadNativePostprocess,createNativePostprocess}=await import('/three/native-postprocess.js');
 const renderer=view.renderer,gl=renderer.getContext(),compileErrors=[];renderer.debug.onShaderError=(gl,p,v,f)=>compileErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
 const read=async image=>new (image.arrayType==='Float32Array'?Float32Array:Uint8Array)(await(await fetch(base+image.file)).arrayBuffer()),tone=fixture.stages.at(-1),ao=fixture.stages.find(s=>s.name==='ambient_occlusion');
 const hdrRef=tone.inputImages.tex_fb_unfiltered??tone.inputImages.tex_fb_filtered,depthRef=tone.inputImages.tex_depth,w=hdrRef.width,h=hdrRef.height,owned=[];
 const texture=(data,width,height,type,format=THREE.RGBAFormat)=>{const t=new THREE.DataTexture(data,width,height,format,type);t.flipY=false;t.needsUpdate=true;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.NearestFilter;t.colorSpace=THREE.NoColorSpace;owned.push(t);return t;};
 const hdr=texture(Uint16Array.from(await read(hdrRef),THREE.DataUtils.toHalfFloat),w,h,THREE.HalfFloatType),depth=texture(await read(depthRef),w,h,THREE.FloatType),frame={texture:hdr,depthTexture:depth,width:w,height:h};
 const shared=[0,1].map(()=>new THREE.WebGLRenderTarget(Math.floor(w/4),Math.floor(h/4),{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter})),assets=await loadNativePostprocess(base),post=createNativePostprocess(renderer,assets,frame,shared,{initialExposure:fixture.stages.find(stage=>stage.name==='fb_bloom')?.uniforms.exposure_wcg??tone.uniforms.exposure_wcg});
 post.setProfile(assets.metadata.profiles[fixture.quality]);post.resize(w,h);await post.prepare();
 if(ao){const prior=await read(ao.inputImages.tex_fb_filtered),priorTexture=texture(Uint8Array.from({length:w*h},(_,i)=>prior[i*4]),w,h,THREE.UnsignedByteType,THREE.RedFormat);renderer.initRenderTarget(post.aoTargets[1]);renderer.copyTextureToTexture(priorTexture,post.aoTargets[1].texture);if(ao.nativeFrameIndex!==tone.nativeFrameIndex)throw Error('Native frame clock changed between passes');}
 post.update(tone.nativeFrameIndex);
 let nudge;
 if(fixture.nudgeInput){
  const {CabinetNudge}=await import('/three/cabinet-nudge.js'),cabinet=new CabinetNudge();cabinet.nudge(90,2);for(let i=0;i<tone.cabinet.elapsed;i++)cabinet.step(Math.fround(6*Math.PI/180));
  post.setCabinetOffset(cabinet.nativeOffset);nudge={actual:[cabinet.nativeOffset.x,cabinet.nativeOffset.y],expected:tone.cabinet.position,vertices:Array.from(post.passes.get(tone.name).mesh.geometry.getAttribute('position').data.array),expectedVertices:tone.vertices};
 }
 const output=new THREE.WebGLRenderTarget(w,h,{type:THREE.UnsignedByteType,depthBuffer:false});
 // A displaced native fullscreen quad leaves its uncovered margin intact.
 const seed=texture(await read(tone.priorTarget),w,h,THREE.UnsignedByteType);renderer.initRenderTarget(output);renderer.copyTextureToTexture(seed,output.texture);
 const expected=new Map();for(const stage of fixture.stages.slice(2))expected.set(stage.name,await read(stage.output));const stages=[];
 post.render(output,(pass,target)=>{
  const ref=fixture.stages.find(s=>s.name===pass.name);if(!ref)throw Error('Unexpected production pass '+pass.name);
  const values=expected.get(pass.name),isAO=pass.name==='ambient_occlusion',isTone=pass.name===tone.name,actual=isAO?new Uint8Array(target.width*target.height):isTone?new Uint8Array(target.width*target.height*4):new Uint16Array(target.width*target.height*4);
  renderer.readRenderTargetPixels(target,0,0,target.width,target.height,actual);
  const result={name:pass.name,width:target.width,height:target.height,samples:0,different:0,maxAbsolute:0,uniformFields:0,uniformDifferences:0,examples:[]};
  for(const [key,value]of Object.entries(ref.uniforms)){if(ref.inputs[key])continue;const own=pass.material.uniforms[key]?.value;for(const [i,wanted]of (Array.isArray(value)?value:[value]).entries()){result.uniformFields++;if((ArrayBuffer.isView(own)?own[i]:own)!==wanted)result.uniformDifferences++;}}
  for(let i=0;i<actual.length;i++){if(!isAO&&i%4===3)continue;const value=actual instanceof Uint16Array?THREE.DataUtils.fromHalfFloat(actual[i]):actual[i],wanted=isAO?values[i*4]:values[i],error=Math.abs(value-wanted);result.samples++;result.maxAbsolute=Math.max(result.maxAbsolute,error);if(error){result.different++;if(result.examples.length<4)result.examples.push({i,actual:value,expected:wanted});}}
  stages.push(result);
 });
 post.dispose();output.dispose();for(const t of shared)t.dispose();for(const t of owned)t.dispose();
 return{quality:fixture.quality,nudged:!!fixture.nudgeInput,stages,nudge,compileErrors,glError:gl.getError()};
}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:base});
 for(let i=0;i<1000;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 const results=[];
 for(const name of ['performance','performance-nudged','detailed']){
  const directory='.work/native-main-'+name+'-postprocess-renderer',reference=JSON.parse(fs.readFileSync(directory+'/reference.json')),assets='/three/@fs/'+path.resolve(directory).replaceAll('\\','/')+'/';
  const result=await evaluate(`(${check.toString()})(${JSON.stringify(reference)},${JSON.stringify(assets)})`);results.push(result);
  fs.writeFileSync(output+'/current-main-postprocess-profile-gpu.json',JSON.stringify({results,errors,scope:'Production postprocess math versus independently captured native outputs on the same declared HDR/depth/history inputs and observed native FrameIndex. KeyZ cabinet displacement is recomputed from source input and the actual native elapsed counter. This is component conformance, not uninterrupted whole-frame parity.'},null,2));
  console.log(JSON.stringify(result));assert.deepEqual(result.compileErrors,[]);assert.equal(result.glError,0);assert.equal(result.stages.length,name==='detailed'?5:1);
  for(const stage of result.stages){assert.equal(stage.uniformDifferences,0,stage.name+' uniforms');assert.equal(stage.different,0,stage.name+' pixels');assert.ok(stage.samples>10000);}
  if(result.nudge){assert.deepEqual(result.nudge.actual,result.nudge.expected);assert.deepEqual(result.nudge.vertices,result.nudge.expectedVertices);}
 }
 assert.deepEqual(errors,[]);
}finally{socket.close();}
