// SPDX-License-Identifier: GPL-3.0-or-later
// Original native Flasher shader, source geometry and OLE_COLOR/blend behavior.
import * as THREE from 'three';
import {loadNativePrimitiveVisuals,createNativeBaseTexture} from './native-basic-render.js';
import {nativeFlasherVertices} from './native-flasher-mesh.js';
import {nativeFlasherState,nativeFlasherMVP,nativeFlasherOutside} from './native-flasher-state.js';
import {nativeTransparentOrder} from './native-render-order.js';
export async function loadNativeFlasherVisuals(base,atlasURL=new URL('../dmd-atlas.png',new URL(base,location.href)).href){
 const [assets,response]=await Promise.all([loadNativePrimitiveVisuals(base,'native-flashers.json'),fetch(atlasURL)]);if(!response.ok)throw Error('Native flasher sprite atlas unavailable');assets.atlasBitmap=await createImageBitmap(await response.blob(),{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});return assets;
}
export function createNativeFlasherVisuals(renderer,scene,assets,{stateFor=()=>null,cull=true}={}){
 const root=new THREE.Group(),parts=[],textures=new Map(),atlasTextures=new Map();root.name='NativeFlashers';scene.add(root);let atlasTexture;
 function textureFor(image,sampler){
  if(!image)return null;const key=JSON.stringify([image,sampler]);if(textures.has(key))return textures.get(key);
  let texture;if(image.atlas){
   if(!atlasTexture){atlasTexture=new THREE.Texture(assets.atlasBitmap);atlasTexture.flipY=false;atlasTexture.colorSpace=THREE.SRGBColorSpace;atlasTexture.internalFormat='SRGB8_ALPHA8';atlasTexture.generateMipmaps=false;atlasTexture.minFilter=atlasTexture.magFilter=THREE.NearestFilter;atlasTexture.needsUpdate=true;renderer.initTexture(atlasTexture);}
   const [x,y,width,height]=image.atlas,sourceSpec={format:35907,width,height,pixelFormat:6408,pixelType:5121,generatedMipmaps:true,levels:[{bytes:new Uint8Array(width*height*4).buffer}]};texture=createNativeBaseTexture({metadata:{textures:{sprite:sourceSpec}},pixels:{sprite:sourceSpec.levels}},'sprite',sampler);renderer.initTexture(texture);
   const previous=renderer.getRenderTarget();try{renderer.copyTextureToTexture(atlasTexture,texture,new THREE.Box2(new THREE.Vector2(x,y),new THREE.Vector2(x+width,y+height)));}finally{renderer.setRenderTarget(previous);}texture.image.data=null;atlasTextures.set(key,texture);
  }else texture=createNativeBaseTexture(assets,image.texture,sampler);
  textures.set(key,texture);return texture;
 }
 const dummy=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);dummy.needsUpdate=true;
 const imageFor=name=>assets.metadata.images[String(name??'').toLowerCase()];
 for(const record of [...assets.metadata.parts].sort((a,b)=>a.spec.native_source_order-b.spec.native_source_order)){
  const spec=record.spec,vertices=new THREE.InterleavedBuffer(nativeFlasherVertices(spec),8).setUsage(THREE.DynamicDrawUsage),geometry=new THREE.BufferGeometry(),position=new THREE.InterleavedBufferAttribute(vertices,3,0);geometry.setAttribute('position',position);geometry.setAttribute('vPosition',position);geometry.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(vertices,3,3));geometry.setAttribute('tc',new THREE.InterleavedBufferAttribute(vertices,2,6));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(assets.geometry,record.indexByteOffset,record.indices),1));
  const program=assets.programs[record.program],uniforms={matWorldViewProj:{value:new Float32Array(16)},layer:{value:0},staticColor_Alpha:{value:new Float32Array(4)},alphaTestValueAB_filterMode_addBlend:{value:new Float32Array(4)},amount_blend_modulate_vs_add_flasherMode:{value:new Float32Array(3)},lightCenter_doShadow:{value:new Float32Array(4)},balls:{value:new Float32Array(32)},tex_flasher_A:{value:dummy},tex_flasher_B:{value:dummy}},material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:program.vertex,fragmentShader:program.fragment,uniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,depthFunc:THREE.LessEqualDepth,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor}),mesh=new THREE.Mesh(geometry,material);mesh.name=spec.name;mesh.frustumCulled=false;root.add(mesh);parts.push({spec,record,mesh,material,vertices,state:stateFor(spec.name),lastPose:null,poseRevision:0,cameras:new WeakMap()});
 }
 return{root,parts,textures,atlasTextures,imageFor,textureFor,setCulling(value){cull=!!value;},async prepare(camera){const compile=new THREE.Scene();for(const part of parts){const mesh=new THREE.Mesh(part.mesh.geometry,part.material);mesh.frustumCulled=false;compile.add(mesh);}await renderer.compileAsync(compile,camera);},update(camera){
  const native=camera.userData.nativeCamera;if(!native)throw Error('Native flashers require the authored camera');const matrix=nativeFlasherMVP(native);
  for(const part of parts){const {spec,record,state,material,mesh,vertices}=part,pose=[state?.rotx??spec.rot_x,state?.roty??spec.rot_y,state?.rotz??spec.rot_z,state?.height??spec.height];if(!part.lastPose||pose.some((v,i)=>v!==part.lastPose[i])){vertices.array.set(nativeFlasherVertices(spec,{state}));vertices.needsUpdate=true;part.lastPose=pose;part.poseRevision++;}
   const imageA=imageFor(state?.imagea??spec.image_a),imageB=imageFor(state?.imageb??spec.image_b),inputs=[...['color','opacity','intensityscale','addblend','modulatevsadd','filter','amount','visible','sequenceactive','sequencestate'].map(key=>state?.[key]),imageA,imageB];if(!part.lastInputs||inputs.some((value,i)=>value!==part.lastInputs[i])){part.values=nativeFlasherState(spec,state??{},imageA,imageB);part.lastInputs=inputs;}const values=part.values;let clipped=part.cameras.get(native);if(!clipped||clipped.revision!==part.poseRevision){clipped={revision:part.poseRevision,outside:nativeFlasherOutside(vertices.array,matrix)};part.cameras.set(native,clipped);}mesh.visible=!native.reflection&&values.visible&&(!cull||!clipped.outside);mesh.userData.nativeTransparentOrder=nativeTransparentOrder(state?.height??spec.height,spec.depth_bias??0,spec.native_source_order);mesh.renderOrder=mesh.userData.nativeTransparentOrder[0];
   material.uniforms.matWorldViewProj.value.set(matrix);for(const name of ['staticColor_Alpha','alphaTestValueAB_filterMode_addBlend','amount_blend_modulate_vs_add_flasherMode'])material.uniforms[name].value.set(values[name]);material.blendEquation=values.add?THREE.ReverseSubtractEquation:THREE.AddEquation;material.blendDst=values.add?THREE.OneMinusSrcColorFactor:THREE.OneMinusSrcAlphaFactor;
   if(mesh.visible){const samplers=record.samplers??Object.fromEntries(Object.entries(record.textures).map(([name,binding])=>[name,binding.sampler]));material.uniforms.tex_flasher_A.value=textureFor(imageA??imageB,samplers.tex_flasher_A)??dummy;material.uniforms.tex_flasher_B.value=textureFor(imageA&&imageB?imageB:null,samplers.tex_flasher_B)??dummy;}
  }
 },dispose(){for(const part of parts){part.mesh.geometry.dispose();part.material.dispose();}for(const texture of textures.values())texture.dispose();atlasTexture?.dispose();assets.atlasBitmap?.close();dummy.dispose();scene.remove(root);}};
}
