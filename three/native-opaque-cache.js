// Cache exact HDR color and D16 depth for source opaque static meshes.
// Dynamic mechanisms, probe receivers and transmission-dependent materials
// remain live. Each camera has its own cache and visibility/world signatures.
import * as THREE from 'three';
const dynamic=new Set(['HitTarget','Trigger','Bumper','Plunger','Spinner','Gate']);
export function createNativeOpaqueCache(renderer,visual,{liveParts=[]}={}){
 // An assembly's fixed body can share raster depths with its moving limbs.
 // Keep the complete assembly live to retain their original tie ordering.
 const live=new Set(liveParts),eligible=visual.parts.filter(p=>!dynamic.has(p.spec.kind)&&!live.has(p)&&!p.material.transparent&&!p.record.probe&&!(p.record.uniforms.cBase_Alpha?.[3]<1&&p.record.uniforms.fDisableLighting_top_below?.[1]<1)),caches=new Map(),stats={rebuilds:0,hits:0,blits:0};
 const visible=mesh=>{for(let object=mesh;object;object=object.parent)if(!object.visible)return false;return true;};
 function cacheFor(key,width,height){let cache=caches.get(key);if(!cache){const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(width,height,THREE.UnsignedShortType)}),parts=eligible.map(part=>{const proxy=new THREE.Mesh(part.mesh.geometry,part.material);proxy.frustumCulled=false;scene.add(proxy);return{part,proxy,visible:null,version:-1,world:new Uint32Array(16),order:null};});cache={scene,target,parts,camera:null,dirty:true};caches.set(key,cache);}if(cache.target.width!==width||cache.target.height!==height){cache.target.setSize(width,height);cache.dirty=true;}return cache;}
 return{stats,eligible,render(scene,camera,destination,{enabled=true}={}){
  if(!enabled){renderer.render(scene,camera);return;}
  const native=camera.userData.nativeCamera,cache=cacheFor(native.reflection?'reflection':'main',destination.width,destination.height),clearColor=renderer.getClearColor(new THREE.Color()),clearState=[clearColor.r,clearColor.g,clearColor.b,renderer.getClearAlpha()];let dirty=cache.dirty||cache.camera!==native||!cache.clearState||clearState.some((value,i)=>value!==cache.clearState[i]);
  for(const record of cache.parts){const part=record.part,shown=visible(part.mesh),version=part.mesh.geometry.getAttribute('vPosition').data.version,world=new Uint32Array(part.matrices.buffer,0,16);if(record.visible!==shown||record.version!==version||record.order!==part.mesh.renderOrder||world.some((value,i)=>value!==record.world[i]))dirty=true;record.proxy.visible=shown;record.proxy.renderOrder=part.mesh.renderOrder;record.visible=shown;record.version=version;record.order=part.mesh.renderOrder;record.world.set(world);}
  if(dirty){const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;try{renderer.autoClear=true;renderer.setRenderTarget(cache.target);renderer.render(cache.scene,camera);}finally{renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}cache.camera=native;cache.clearState=clearState;cache.dirty=false;stats.rebuilds++;}else stats.hits++;
  renderer.setRenderTarget(destination);const gl=renderer.getContext(),source=renderer.properties.get(cache.target).__webglFramebuffer,previousRead=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);if(!source)throw Error('Opaque cache framebuffer unavailable');
  try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,source);gl.blitFramebuffer(0,0,destination.width,destination.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previousRead);}stats.blits++;
  const hidden=eligible.map(p=>[p.mesh,p.mesh.visible]),autoClear=renderer.autoClear;try{for(const [mesh]of hidden)mesh.visible=false;renderer.autoClear=false;renderer.render(scene,camera);}finally{for(const [mesh,value]of hidden)mesh.visible=value;renderer.autoClear=autoClear;}
 },invalidate(){for(const cache of caches.values())cache.dirty=true;},dispose(){for(const cache of caches.values())cache.target.dispose();caches.clear();}};
}
