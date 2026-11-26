// Compare the production cache with ordinary draw submission on real D16
// targets. Equal-depth receiver/follower geometry exercises draw order;
// reference pixels are produced independently by the uncached renderer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const moduleURL=process.argv.find(arg=>arg.startsWith('--cache-module='))?.slice(15)??'/three/native-opaque-cache.js';
const host=path.join(output,'opaque-cache-host.html');
fs.writeFileSync(host,'<!doctype html><title>Opaque cache regression</title><canvas id="test"></canvas>',{flag:'wx'});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Runtime.enable');
 await call('Page.navigate',{url:new URL('/three/@fs/'+host.replaceAll('\\','/'),base).href});
 const response=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const moduleURL=${JSON.stringify(moduleURL)},source=await(await fetch(moduleURL)).text();
  const THREE=await import(source.match(/from ["']([^"']+)["']/)[1]),{createNativeOpaqueCache}=await import(moduleURL);
  const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('test'),antialias:false});renderer.setSize(8,8,false);renderer.setClearColor(0,1);
  const scene=new THREE.Scene(),camera=new THREE.Camera();camera.userData.nativeCamera={reflection:false};
  const parts=[],geometries=[],materials=[],rows=[];
  function part(name,order,color,probe=false){
   const data=new THREE.InterleavedBuffer(new Float32Array([-1,-1,0,0,0,1,0,0,1,-1,0,0,0,1,1,0,1,1,0,0,0,1,1,1,-1,1,0,0,0,1,0,1]),8),geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));geometry.setAttribute('vPosition',new THREE.InterleavedBufferAttribute(data,3,0));geometry.setIndex([0,1,2,0,2,3]);
   const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:'precision highp float; in vec3 position; void main(){gl_Position=vec4(position,1.0);}',fragmentShader:'precision highp float; uniform vec4 tint; out vec4 color; void main(){color=tint;}',uniforms:{tint:{value:new Float32Array([...color,1])}},depthTest:true,depthWrite:true,depthFunc:THREE.LessEqualDepth});
   const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.renderOrder=order;mesh.frustumCulled=false;scene.add(mesh);
   const value={spec:{kind:'Primitive',name},record:{drawOrder:order,probe:probe?{}:undefined,uniforms:{cBase_Alpha:[1,1,1,1],fDisableLighting_top_below:[0,1]}},mesh,material,matrices:new Float32Array(80)};
   parts.push(value);geometries.push(geometry);materials.push(material);return value;
  }
  part('cached predecessor',10,[0,1,0]);const receiver=part('live receiver',20,[1,0,0],true),follower=part('opaque follower',30,[0,0,1]);
  const cache=createNativeOpaqueCache(renderer,{parts}),target=()=>new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(8,8,THREE.UnsignedShortType)}),reference=target(),actual=target();
  const read=target=>{const values=new Uint16Array(8*8*4);renderer.readRenderTargetPixels(target,0,0,8,8,values);return values;};
  function compare(label,channel){
   renderer.setRenderTarget(reference);renderer.autoClear=true;renderer.render(scene,camera);const expected=read(reference);
   cache.render(scene,camera,actual);const observed=read(actual),different=observed.reduce((sum,value,i)=>sum+(value!==expected[i]),0);
   const pixel=Array.from(expected.slice(0,4),THREE.DataUtils.fromHalfFloat);if(pixel[channel]!==1)throw Error('Reference draw did not cover the target: '+label);
   rows.push({label,different,expectedPixel:pixel,actualPixel:Array.from(observed.slice(0,4),THREE.DataUtils.fromHalfFloat)});
  }
  try{
   compare('receiver then equal-depth follower',2);compare('main cache reuse',2);
   follower.mesh.visible=false;compare('hidden follower exposes live receiver',0);
   follower.mesh.visible=true;compare('restored follower retains later draw',2);
   camera.userData.nativeCamera={reflection:true};receiver.mesh.visible=false;compare('reflection caches both static parts',2);compare('reflection cache reuse',2);
   return{rows,stats:{...cache.stats},glError:renderer.getContext().getError(),scope:'Real production opaque cache versus independently rendered ordinary submissions, using identical coplanar geometry on separate D16/HDR targets. No expected image is supplied to the cache.'};
  }finally{cache.dispose();reference.dispose();actual.dispose();for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();renderer.dispose();}
 })()`});
 assert.ok(!response.exceptionDetails,JSON.stringify(response.exceptionDetails));const result=response.result.value;
 fs.writeFileSync(path.join(output,'opaque-cache-browser.json'),JSON.stringify({moduleURL,result,errors},null,2),{flag:'wx'});
 assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.rows.length,6);
 for(const row of result.rows)assert.equal(row.different,0,row.label);
 assert.ok(result.stats.hits>=4,'Both caches must actually be reused');
 console.log(JSON.stringify(result));
}finally{socket.close();}
