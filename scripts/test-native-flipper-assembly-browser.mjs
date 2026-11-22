// Compare overlapping flipper parts against unchanged native shaders, UBOs,
// and observed submission order. D16 ties are invisible in single-part tests.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const fixture=JSON.parse(gunzipSync(fs.readFileSync('three/tests/fixtures/vpx-flipper-matrices-native.json.gz')));
const shader=type=>fixture.program.shaders.find(s=>s.type===type).source.replace(/^#version[^\n]*\n/,'').replace(/^#extension[^\n]*\n/gm,'');
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.navigate',{url:base});
 for(let i=0;i<600;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 const result=await evaluate(`(async()=>{
  const {game,view}=finniThree;document.getElementById('controls-panel').showPopover();game.setPaused(true);await game.flush();
  const source=await(await fetch('/three/scene.js')).text(),THREE=await import(source.match(/import \\* as THREE from "([^"]+)"/)[1]),fixture=${JSON.stringify({camera:fixture.camera,samples:fixture.samples})},renderer=view.renderer,w=fixture.camera.width,h=fixture.camera.height;
  const target=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(w,h,THREE.UnsignedShortType)}),camera=new THREE.Camera();camera.userData.nativeCamera={};
  const actualScene=new THREE.Scene(),referenceScene=new THREE.Scene(),parts=[],read=()=>{const pixels=new Uint16Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);return pixels;};
  const difference=(a,b)=>{let different=0;for(let i=0;i<a.length;i++)if(i%4!==3&&a[i]!==b[i])different++;return different;};
  for(const part of view.flipperVisuals.parts){
   const {mesh,spec,top}=part,geometry=mesh.geometry,uniforms=mesh.material.uniforms;
   geometry.setAttribute('vPosition',geometry.getAttribute('nativePosition'));geometry.setAttribute('vNormal',geometry.getAttribute('nativeNormal'));geometry.setAttribute('tc',geometry.getAttribute('uv'));
   const group=new THREE.UniformsGroup().setName('basicMatrixBlock');for(let i=0;i<5;i++)group.add(new THREE.Uniform(new THREE.Matrix4()));
   const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{...uniforms,doNormalMapping:{value:false},objectSpaceNormalMap:{value:false},doRefractions:{value:false},doReflections:{value:false},mirrorNormal_factor:{value:new THREE.Vector4()},lightCenter_doShadow:{value:new THREE.Vector4()},clip_plane:{value:new THREE.Vector4()}},uniformsGroups:[group],vertexShader:${JSON.stringify(shader(35633))},fragmentShader:${JSON.stringify(shader(35632))}});
   const actual=new THREE.Mesh(geometry,mesh.material),reference=new THREE.Mesh(geometry,material);actual.frustumCulled=reference.frustumCulled=false;actual.renderOrder=mesh.renderOrder;actualScene.add(actual);referenceScene.add(reference);parts.push({part,actual,reference,material,group,x:top?spec.position.x:spec.center.x});
  }
  const cases=[];
  try{for(const phase of ['rest','raised','restored']){
   for(const item of parts){
    const {part,group,x}=item,{mesh,top}=part,samples=fixture.samples.filter(sample=>sample.phase===phase&&sample.count===(top?462:300)&&Math.abs(sample.world[12]-x)<.01),sample=samples[mesh.name.endsWith(':Rubber')?1:0],matrices=new Float32Array(new Uint32Array(sample.matrixBits).buffer),uniforms=mesh.material.uniforms;
    uniforms.matView.value[0].fromArray(matrices,16);for(let i=0;i<5;i++){group.uniforms[i].value.fromArray(matrices,i*16);mesh.material.userData.nativeMatrices.uniforms[i].value.fromArray(matrices,i*16);}item.reference.renderOrder=fixture.samples.indexOf(sample);item.actual.renderOrder=mesh.renderOrder;
   }
   renderer.setRenderTarget(target);renderer.render(actualScene,camera);const actual=read();renderer.render(referenceScene,camera);const expected=read();
   for(const item of parts)item.actual.renderOrder=0;renderer.render(actualScene,camera);const oldOrder=read();
   cases.push({phase,samples:w*h*3,different:difference(actual,expected),oldOrderDifferent:difference(oldOrder,expected)});
  }return{cases,glError:renderer.getContext().getError()};}
  finally{for(const item of parts){item.material.dispose();item.group.dispose();}renderer.setRenderTarget(null);target.dispose();}
 })()`);
 fs.writeFileSync(output+'/native-flipper-assembly-conformance.json',JSON.stringify({result,errors,engineSHA256:fixture.engineSHA256},null,2));console.log(JSON.stringify({result,errors}));
 assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.cases.length,3);for(const item of result.cases)assert.equal(item.different,0,item.phase+' complete flipper assembly');assert.ok(result.cases.some(item=>item.oldOrderDifferent>0),'The pre-fix order must expose the original D16 counterexample');
}finally{socket.close();}
