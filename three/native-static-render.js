// SPDX-License-Identifier: GPL-3.0-or-later
// Renderer/RenderProbe static prerender passes, pinned Visual Pinball source.
import * as THREE from 'three';
import {NativeMatrixStream} from './native-basic-render.js';
import {nativeSamplersFor} from './native-samplers.js';
import {nativeFullscreenGeometry} from './native-postprocess.js';
import {nativePrimitiveWorld,nativeModelMatrices} from './primitive-transform.js';
import {nativeIdentity} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
import {computeNativeCamera} from './native-camera.js';
import {setNativeCamera} from './camera-render.js';
import {nativeReflectionCamera,nativeProbeArea,nativeProbeScissor} from './native-reflection.js';
import {nativeStaticJitter} from './native-static-sampling.js';
import {nativeTransparentOrder} from './native-render-order.js';

export async function loadNativeStatic(base){
 const read=async file=>{const response=await fetch(base+file);if(!response.ok)throw Error('Native prerender asset unavailable: '+file);return response;},metadata=await(await read('native-static.json')).json();
 const [vertex,fragment]=await Promise.all([metadata.mirror.vertex,metadata.mirror.fragment].map(async file=>(await(await read(file)).text()).replace(/^#version[^\n]*\n/,'')));
 let reflectionOnly;if(metadata.reflectionOnly){const [vertex,fragment]=await Promise.all([metadata.reflectionOnly.vertex,metadata.reflectionOnly.fragment].map(async file=>(await(await read(file)).text()).replace(/^#version[^\n]*\n/,'')));reflectionOnly={vertex,fragment};}
 return{metadata,mirror:{vertex,fragment},reflectionOnly};
}

export function createNativeStaticRender(renderer,table,tableAssets,assets){
 if(assets.metadata.tableGeometrySHA256!==tableAssets.metadata.geometry.sha256)throw Error('Native prerender geometry version differs');
 const stream=new NativeMatrixStream(renderer),samplers=nativeSamplersFor(renderer),camera=new THREE.PerspectiveCamera(),passes={},owned=[],baseSetMaterial=renderer.state.setMaterial,black=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);black.needsUpdate=true;
 const blend={0:THREE.ZeroFactor,1:THREE.OneFactor,768:THREE.SrcColorFactor,769:THREE.OneMinusSrcColorFactor,770:THREE.SrcAlphaFactor,771:THREE.OneMinusSrcAlphaFactor};
 for(const name of ['main','reflection']){
  const scene=new THREE.Scene(),parts=[];
  for(const [order,record]of assets.metadata.passes[name].entries()){
   const source=table.parts[record.part],program=tableAssets.programs[record.program],state=record.state,uniforms={};if(source.spec.name!==record.name)throw Error('Native prerender part association differs');
   for(const [key,value]of Object.entries(record.uniforms))uniforms[key.replace(/\[0\]$/,'')]={value:Array.isArray(value)?new Float32Array(value):value};
   Object.assign(uniforms,{matProj:{value:new Float32Array(16)},w_h_height:{value:new Float32Array(4)},balls:{value:new Float32Array(32)}});
   for(const key of Object.keys(record.samplers)){let texture=black;if(['tex_base_color','tex_env','tex_diffuse_env'].includes(key)){texture=source.material.uniforms[key]?.value;if(!texture)throw Error('Native static source image unavailable: '+key);}uniforms[key]={value:texture};}
   if(state.depthFunc!==515||state.blendEquationRGB!==32774||state.blendEquationAlpha!==32774)throw Error('Unsupported native prerender depth/blend state');
   const side=state.cull?((state.frontFace===2305)===(state.cullFace===1029)?THREE.FrontSide:THREE.BackSide):THREE.DoubleSide;
   // A single queue preserves the captured native command order even where
   // additive GL blending and native opaque classification are independent.
   const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:program.vertex,fragmentShader:program.fragment,uniforms,side,transparent:true,depthTest:state.depthTest,depthWrite:state.depthWrite,depthFunc:THREE.LessEqualDepth,blending:state.blend?THREE.CustomBlending:THREE.NoBlending,blendEquation:THREE.AddEquation,blendSrc:blend[state.blendSrcRGB],blendDst:blend[state.blendDstRGB],blendSrcAlpha:blend[state.blendSrcAlpha],blendDstAlpha:blend[state.blendDstAlpha]});
   const mesh=new THREE.Mesh(source.mesh.geometry,material),part={source,record,mesh,material,world:null,matrices:new Float32Array(80)};mesh.name='Static:'+source.spec.name;mesh.frustumCulled=false;mesh.renderOrder=order;scene.add(mesh);parts.push(part);material.onBeforeRender=()=>stream.upload(material,part.matrices);owned.push(samplers.register(material,record.samplers));
  }
  passes[name]={scene,parts,target:new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedShortType)})};
 }
 const accumulation=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),geometry=nativeFullscreenGeometry();
 const mirrorMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:assets.mirror.vertex,fragmentShader:assets.mirror.fragment,uniforms:{layer:{value:0},w_h_height:{value:new Float32Array([1,1,128,0])},tex_fb_unfiltered:{value:passes.main.target.texture}},depthTest:false,depthWrite:false,side:THREE.DoubleSide,transparent:true,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor}),mirrorScene=new THREE.Scene(),quad=new THREE.Mesh(geometry,mirrorMaterial);quad.frustumCulled=false;mirrorScene.add(quad);
 owned.push(samplers.register(mirrorMaterial,{tex_fb_unfiltered:{10240:9728,10241:9728,10242:33071,10243:33071,34046:1}}));
 let reflectionMaterial,reflectionsEnabled=true;const floor=table.parts[assets.metadata.reflectionOnly?.part];
 const staticMeshes=assets.metadata.staticParts.map(index=>table.parts[index].mesh),savedVisible=new Array(staticMeshes.length),skipParts=new Set(assets.metadata.staticParts.map(index=>table.parts[index]).filter(part=>!part.record.probe));
 if(assets.reflectionOnly){const spec=assets.metadata.reflectionOnly,state=spec.state;reflectionMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:assets.reflectionOnly.vertex,fragmentShader:assets.reflectionOnly.fragment,uniforms:{layer:{value:0},staticColor_Alpha:floor.material.uniforms.staticColor_Alpha,w_h_height:floor.material.uniforms.w_h_height,mirrorNormal_factor:floor.material.uniforms.mirrorNormal_factor,tex_reflection:floor.material.uniforms.tex_reflection},side:state.cullFace===1028?THREE.BackSide:THREE.FrontSide,transparent:true,depthWrite:false,depthFunc:THREE.LessEqualDepth,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor});reflectionMaterial.onBeforeRender=()=>stream.upload(reflectionMaterial,floor.matrices);owned.push(samplers.register(reflectionMaterial,{tex_reflection:spec.sampler}));}
 function update(pass,native,width,height){
  setNativeCamera(camera,native);let identityMatrices;const projection=nativeShaderArray(native.projection),screen=nativeShaderArray([1/width,1/height,0,0]);
  for(const part of pass.parts){part.matrices.set(part.source.record.transform==='identity'?(identityMatrices??=nativeModelMatrices(nativeIdentity(),native)):nativeModelMatrices(part.world,native));part.material.uniforms.matProj.value.set(projection);part.material.uniforms.w_h_height.value.set(screen);}
 }
 return{passes,accumulation,camera,skipParts,setReflectionsEnabled(value){reflectionsEnabled=!!value;},async prepare(bounds,width,height,preset='balanced'){
  const native=computeNativeCamera(bounds,width/height,preset);for(const pass of Object.values(passes)){for(const part of pass.parts)part.world=part.source.record.transform==='identity'?nativeIdentity():nativePrimitiveWorld(part.source.spec,part.source.state);update(pass,native,width,height);await renderer.compileAsync(pass.scene,camera);}await renderer.compileAsync(mirrorScene,new THREE.Camera());if(reflectionMaterial){const scene=new THREE.Scene();scene.add(new THREE.Mesh(floor.mesh.geometry,reflectionMaterial));await renderer.compileAsync(scene,camera);}
 },build(name,bounds,width,height,preset='balanced',{visible=part=>part.mesh.visible,onSample}={}){
  const pass=passes[name];if(!pass)throw Error('Unknown native prerender pass');const sample=pass.target;sample.setSize(width,height);accumulation.setSize(width,height);mirrorMaterial.uniforms.tex_fb_unfiltered.value=sample.texture;mirrorMaterial.uniforms.w_h_height.value.set(nativeShaderArray([1/width,1/height,128,0]));
  for(const part of pass.parts){part.mesh.visible=visible(part.source);part.world=part.source.record.transform==='identity'?nativeIdentity():nativePrimitiveWorld(part.source.spec,part.source.state);}
  const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear,color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),setMaterial=renderer.state.setMaterial,gl=renderer.getContext(),cull=gl.getParameter(gl.CULL_FACE_MODE),cullEnabled=gl.isEnabled(gl.CULL_FACE),frontFace=gl.getParameter(gl.FRONT_FACE);
  try{
   // The surrounding live reflection pass reverses culling in its material
   // setter. Prerender proxies already encode the original reflected sides.
   renderer.state.setMaterial=baseSetMaterial;renderer.state.setCullFace(THREE.CullFaceBack);
   renderer.autoClear=false;renderer.setRenderTarget(accumulation);renderer.setClearColor(0,0);renderer.clear(true,false,false);
   for(let index=127;index>=0;index--){let native=computeNativeCamera(bounds,width/height,preset,nativeStaticJitter(index,width,height));if(name==='reflection')native=nativeReflectionCamera(native,tableAssets.metadata.parts.find(part=>part.probe).probe.plane);update(pass,native,width,height);
    renderer.setRenderTarget(sample);renderer.setClearColor(name==='reflection'?0:color,name==='reflection'?0:alpha);renderer.clear(true,true,false);renderer.render(pass.scene,camera);onSample?.(index,sample);
    renderer.setRenderTarget(accumulation);mirrorMaterial.blending=name==='main'&&index===127?THREE.NoBlending:THREE.CustomBlending;renderer.render(mirrorScene,new THREE.Camera());
   }
   if(name==='reflection'){
    // RenderProbe::ApplyAreaOfInterest clips the final color blit. Outside it,
    // the target retains the last (centered) sample, including its alpha.
    const floor=tableAssets.metadata.parts.find(part=>part.probe),native=computeNativeCamera(bounds,width/height,preset),[x,y,w,h]=nativeProbeScissor(nativeProbeArea(floor.bounds,nativePrimitiveWorld(floor.spec),native),width,height);
    if(w&&h)renderer.copyTextureToTexture(accumulation.texture,sample.texture,new THREE.Box2(new THREE.Vector2(x,y),new THREE.Vector2(x+w,y+h)),new THREE.Vector2(x,y));
   }else renderer.copyTextureToTexture(accumulation.texture,sample.texture);return sample;
  }finally{renderer.state.setMaterial=setMaterial;renderer.state.setCullFace(cull===gl.BACK?THREE.CullFaceBack:cull===gl.FRONT?THREE.CullFaceFront:THREE.CullFaceFrontBack);if(!cullEnabled)renderer.state.setCullFace(THREE.CullFaceNone);renderer.state.setFlipSided(frontFace===gl.CW);renderer.setRenderTarget(previous);renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);}
 },renderDynamics(scene,camera,destination,name,{copyFramebuffer}={}){
  const source=passes[name].target,previous=renderer.getRenderTarget(),autoClear=renderer.autoClear,gl=renderer.getContext();if(source.width!==destination.width||source.height!==destination.height)throw Error('Native static target dimensions differ');renderer.setRenderTarget(destination);const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),framebuffer=renderer.properties.get(source).__webglFramebuffer;if(!framebuffer)throw Error('Native static framebuffer unavailable');
  try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,framebuffer);if(copyFramebuffer)copyFramebuffer(0,0,source.width,source.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);else gl.blitFramebuffer(0,0,source.width,source.height,0,0,destination.width,destination.height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);}
  const floorVisible=floor?.mesh.visible,material=floor?.mesh.material,order=floor?.mesh.renderOrder,transparentOrder=floor?.mesh.userData.nativeTransparentOrder;
  try{for(let i=0;i<staticMeshes.length;i++){savedVisible[i]=staticMeshes[i].visible;staticMeshes[i].visible=false;}if(name==='main'&&reflectionMaterial&&reflectionsEnabled){floor.mesh.visible=floorVisible;floor.mesh.material=reflectionMaterial;floor.mesh.userData.nativeTransparentOrder=nativeTransparentOrder(floor.spec.position.z,floor.spec.depth_bias,floor.spec.native_source_order);floor.mesh.renderOrder=floor.mesh.userData.nativeTransparentOrder[0];}renderer.autoClear=false;renderer.render(scene,camera);}finally{for(let i=0;i<staticMeshes.length;i++)staticMeshes[i].visible=savedVisible[i];if(floor){floor.mesh.material=material;floor.mesh.renderOrder=order;floor.mesh.userData.nativeTransparentOrder=transparentOrder;}renderer.autoClear=autoClear;renderer.setRenderTarget(previous);}
 },dispose(){for(const release of owned)release();for(const pass of Object.values(passes)){for(const part of pass.parts)part.material.dispose();pass.target.dispose();}reflectionMaterial?.dispose();mirrorMaterial.dispose();geometry.dispose();accumulation.dispose();black.dispose();stream.dispose();}};
}
