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
 const background=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedShortType)});
 const outsideScene=new THREE.Scene(),outsideParts=eligible.map(part=>{const proxy=new THREE.Mesh(part.mesh.geometry,part.material);proxy.frustumCulled=false;outsideScene.add(proxy);return{part,proxy};});
 function renderAllWithBackdrop(scene,camera,destination,copyFramebuffer){
  const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear,color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),gl=renderer.getContext();
  background.setSize(destination.width,destination.height);
  try{
   // This is an empty source, independent of all cached scene geometry. Seed
   // the same player sky, then submit the entire scene in its original order.
   background.scissorTest=false;renderer.setRenderTarget(background);renderer.setClearColor(0,0);renderer.clear(true,true,false);renderer.setClearColor(color,alpha);
   if(destination.scissorTest){
    // Main's copy ignores the probe scissor and includes the static scene
    // outside it. Re-render that region independently; inside the scissor the
    // following render-all submission remains the sole geometry producer.
    const {x,y,z:width,w:height}=destination.scissor,W=destination.width,H=destination.height;
    for(const {part,proxy}of outsideParts){proxy.visible=visible(part.mesh);proxy.renderOrder=part.mesh.renderOrder;}
    background.scissorTest=true;
    for(const rectangle of [[0,0,x,H],[x+width,0,W-x-width,H],[x,0,width,y],[x,y+height,width,H-y-height]])if(rectangle[2]>0&&rectangle[3]>0){background.scissor.fromArray(rectangle);renderer.setRenderTarget(background);renderer.autoClear=false;renderer.render(outsideScene,camera);}
    background.scissorTest=false;
   }
   renderer.setRenderTarget(destination);
   const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,renderer.properties.get(background).__webglFramebuffer);copyFramebuffer(0,0,destination.width,destination.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);}
   renderer.autoClear=false;renderer.render(scene,camera);
  }finally{renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);renderer.setRenderTarget(previous);}
 }
 function cacheFor(key,width,height){let cache=caches.get(key);if(!cache){const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(width,height,THREE.UnsignedShortType)}),parts=eligible.map(part=>{const proxy=new THREE.Mesh(part.mesh.geometry,part.material);proxy.frustumCulled=false;scene.add(proxy);return{part,proxy,visible:null,version:-1,world:new Uint32Array(16),order:null};});cache={scene,target,parts,camera:null,dirty:true};caches.set(key,cache);}if(cache.target.width!==width||cache.target.height!==height){cache.target.setSize(width,height);cache.dirty=true;}return cache;}
 return{stats,eligible,render(scene,camera,destination,{enabled=true,copyFramebuffer}={}){
  if(!enabled){if(copyFramebuffer)renderAllWithBackdrop(scene,camera,destination,copyFramebuffer);else renderer.render(scene,camera);return;}
  const native=camera.userData.nativeCamera,cache=cacheFor(native.reflection?'reflection':'main',destination.width,destination.height),clearColor=renderer.getClearColor(new THREE.Color()),clearState=[clearColor.r,clearColor.g,clearColor.b,renderer.getClearAlpha()];let dirty=cache.dirty||cache.camera!==native||!cache.clearState||clearState.some((value,i)=>value!==cache.clearState[i]);
  for(const record of cache.parts){const part=record.part,shown=visible(part.mesh),version=part.mesh.geometry.getAttribute('vPosition').data.version,world=new Uint32Array(part.matrices.buffer,0,16);if(record.visible!==shown||record.version!==version||record.order!==part.mesh.renderOrder||world.some((value,i)=>value!==record.world[i]))dirty=true;record.proxy.visible=shown;record.proxy.renderOrder=part.mesh.renderOrder;record.visible=shown;record.version=version;record.order=part.mesh.renderOrder;record.world.set(world);}
  if(dirty){const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;try{renderer.autoClear=true;renderer.setRenderTarget(cache.target);renderer.render(cache.scene,camera);}finally{renderer.setRenderTarget(previous);renderer.autoClear=autoClear;}cache.camera=native;cache.clearState=clearState;cache.dirty=false;stats.rebuilds++;}else stats.hits++;
  renderer.setRenderTarget(destination);const gl=renderer.getContext(),source=renderer.properties.get(cache.target).__webglFramebuffer,previousRead=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);if(!source)throw Error('Opaque cache framebuffer unavailable');
  try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,source);if(copyFramebuffer)copyFramebuffer(0,0,destination.width,destination.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);else gl.blitFramebuffer(0,0,destination.width,destination.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previousRead);}stats.blits++;
  const hidden=eligible.map(p=>[p.mesh,p.mesh.visible]),autoClear=renderer.autoClear;try{for(const [mesh]of hidden)mesh.visible=false;renderer.autoClear=false;renderer.render(scene,camera);}finally{for(const [mesh,value]of hidden)mesh.visible=value;renderer.autoClear=autoClear;}
 },invalidate(){for(const cache of caches.values())cache.dirty=true;},dispose(){for(const cache of caches.values())cache.target.dispose();background.dispose();caches.clear();}};
}
