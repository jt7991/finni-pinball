// SPDX-License-Identifier: GPL-3.0-or-later
// Original native BasicShader programs and primitive transforms. See VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import {nativeIdentity} from './native-matrix.js';
import {nativePrimitiveWorld,nativePrimitiveMatrices,nativeModelMatrices} from './primitive-transform.js';
import {nativeShaderArray} from './native-shader-state.js';
import {decodeNativeGeometry} from './native-geometry-codec.js';
import {nativeMirrorNormalFactor} from './native-reflection.js';
import {nativeTransparentOrder} from './native-render-order.js';
import {nativeSamplersFor} from './native-samplers.js';

const filters={9728:THREE.NearestFilter,9729:THREE.LinearFilter,9984:THREE.NearestMipmapNearestFilter,9985:THREE.LinearMipmapNearestFilter,9986:THREE.NearestMipmapLinearFilter,9987:THREE.LinearMipmapLinearFilter},wraps={10497:THREE.RepeatWrapping,33071:THREE.ClampToEdgeWrapping,33648:THREE.MirroredRepeatWrapping};
const stripVersion=source=>source.replace(/^#version[^\n]*\n/,''),noAngles=[];
export class NativeMatrixStream{
 constructor(renderer,{block='basicMatrixBlock',floats=80}={}){this.renderer=renderer;this.block=block;this.gl=renderer.getContext();const gl=this.gl;this.binding=gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS)-1;this.buffer=gl.createBuffer();this.indices=new WeakMap();gl.bindBuffer(gl.UNIFORM_BUFFER,this.buffer);gl.bufferData(gl.UNIFORM_BUFFER,floats*4,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.UNIFORM_BUFFER,null);}
 upload(material,matrices){const gl=this.gl,compiled=this.renderer.properties.get(material).currentProgram;if(!compiled)throw Error('Compile native materials before rendering');const program=compiled.program;let index=this.indices.get(program);if(index===undefined){index=gl.getUniformBlockIndex(program,this.block);if(index===gl.INVALID_INDEX)throw Error('Native matrix block missing');this.indices.set(program,index);}gl.uniformBlockBinding(program,index,this.binding);gl.bindBufferBase(gl.UNIFORM_BUFFER,this.binding,this.buffer);gl.bindBuffer(gl.UNIFORM_BUFFER,this.buffer);gl.bufferSubData(gl.UNIFORM_BUFFER,0,matrices);gl.bindBuffer(gl.UNIFORM_BUFFER,null);}
 dispose(){this.gl.deleteBuffer(this.buffer);}
}
export async function loadNativePrimitiveVisuals(base,metadataFile='native-primitives.json'){
 const read=async file=>{const response=await fetch(base+file);if(!response.ok)throw Error('Native render asset unavailable: '+file);return response;},metadata=await(await read(metadataFile)).json(),packed=await(await read(metadata.geometry.file)).arrayBuffer(),programs={},pixels={};
 if(metadata.geometry.encoding&&metadata.geometry.encoding!=='delta-byteplanes-v1')throw Error('Unsupported native geometry encoding');
 const geometry=metadata.geometry.encoding?decodeNativeGeometry(packed,metadata.parts):packed;
 await Promise.all(Object.entries(metadata.programs).map(async([id,p])=>{programs[id]={vertex:stripVersion(await(await read(p.vertex)).text()),fragment:stripVersion(await(await read(p.fragment)).text())};}));
 await Promise.all(Object.entries(metadata.textures).map(async([id,spec])=>{
  if(spec.encoding==='webp-lossless'){
   if(spec.levels.length!==1)throw Error('Unsupported encoded native mip chain');
   pixels[id]=await createImageBitmap(await(await read(spec.levels[0].file)).blob(),{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  }else pixels[id]=await Promise.all(spec.levels.map(async level=>({width:level.width,height:level.height,bytes:await(await read(level.file)).arrayBuffer()})));
 }));return{metadata,geometry,programs,pixels,dispose(){for(const image of Object.values(pixels))if(!Array.isArray(image))image.close();}};
}
export function createNativeBaseTexture(assets,id,sampler){
 const spec=assets.metadata.textures[id],levels=assets.pixels[id];if(spec.pixelFormat!==6408||spec.pixelType!==5121)throw Error('Unsupported native base texture upload '+id);const texture=spec.encoding==='webp-lossless'?new THREE.Texture(levels):new THREE.DataTexture(new Uint8Array(levels[0].bytes),spec.width,spec.height,THREE.RGBAFormat,THREE.UnsignedByteType);texture.flipY=false;texture.colorSpace=spec.format===35907?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.internalFormat=spec.format===35907?'SRGB8_ALPHA8':'RGBA8';texture.wrapS=wraps[sampler[10242]];texture.wrapT=wraps[sampler[10243]];texture.magFilter=filters[sampler[10240]];texture.minFilter=filters[sampler[10241]];texture.anisotropy=sampler[34046]??1;texture.generateMipmaps=spec.generatedMipmaps;if(Array.isArray(levels)&&levels.length>1){texture.mipmaps=levels.map(level=>({width:level.width,height:level.height,data:new Uint8Array(level.bytes)}));texture.generateMipmaps=false;}texture.needsUpdate=true;return texture;
}
export function createNativePrimitiveVisuals(renderer,scene,assets,lighting,{stateFor=()=>null,transmissionTexture,reflectionTexture}={}){
 if(!transmissionTexture&&assets.metadata.parts.some(p=>p.uniforms.cBase_Alpha?.[3]<1&&p.uniforms.fDisableLighting_top_below?.[1]<1))throw Error('Native translucent primitives require a light transmission texture');
 if(assets.metadata.parts.some(p=>p.uniforms.doNormalMapping||p.uniforms.doRefractions))throw Error('Native normal maps and refraction probes need their rendering passes');
 if(assets.metadata.parts.some(p=>(p.probe||(p.uniforms.mirrorNormal_factor?.[3]??0)>0)&&(!reflectionTexture||!p.probe)))throw Error('Native reflections need an authored probe and its rendered texture');
 if(assets.metadata.parts.some(p=>(p.uniforms.lightCenter_doShadow?.[3]??0)>0))throw Error('Native ball shadows need current ball inputs');
 const stream=new NativeMatrixStream(renderer),samplers=nativeSamplersFor(renderer),parts=[],textures=new Map(),dummy=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);dummy.needsUpdate=true;const root=new THREE.Group();root.name='NativePrimitives';scene.add(root);
 const dynamicWalls=new Set(assets.metadata.parts.filter(p=>p.spec.kind==='Wall'&&p.renderState.blend).map(p=>p.spec.name));
 const baseTexture=record=>{const key=String(record.id);if(!textures.has(key))textures.set(key,createNativeBaseTexture(assets,record.id,{10240:9729,10241:assets.metadata.textures[key].generatedMipmaps?9987:9729,10242:33071,10243:33071,34046:1}));return textures.get(key);};
 for(const spec of assets.metadata.parts){const program=assets.programs[spec.program],uniforms={};for(const [name,value]of Object.entries(spec.uniforms)){const key=name.replace(/\[0\]$/,'');uniforms[key]={value:Array.isArray(value)?new Float32Array(value):value};}
  uniforms.w_h_height={value:new Float32Array(4)};
  uniforms.matProj={value:new Float32Array(16)};
  uniforms.balls={value:new Float32Array(32)};
  for(const [name,record]of Object.entries(spec.textures)){let texture=dummy;if(name==='tex_base_color')texture=baseTexture(record);else if(name==='tex_env')texture=lighting.textures.environment;else if(name==='tex_diffuse_env')texture=lighting.textures.irradiance;else if(name==='tex_base_transmission')texture=transmissionTexture??dummy;else if(name==='tex_reflection')texture=reflectionTexture??dummy;uniforms[name]={value:texture};}
  const state=spec.renderState,legacyTransparent=state.blend||spec.spec.kind==='Wall'&&dynamicWalls.has(spec.spec.name);
  // These are the native states supported by this basic material path. Fail
  // explicitly if a newly exported part needs another rendering technique.
  if(state.frontFace!==2305||state.depthFunc!==515||state.cull&&![1028,1029].includes(state.cullFace)||state.blend&&(state.blendSrcRGB!==770||state.blendSrcAlpha!==770||state.blendDstRGB!==771||state.blendDstAlpha!==771||state.blendEquationRGB!==32774||state.blendEquationAlpha!==32774))throw Error('Unsupported native basic render state: '+spec.spec.name);
  const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms,vertexShader:program.vertex,fragmentShader:program.fragment,side:state.cull?(state.cullFace===1028?THREE.BackSide:THREE.FrontSide):THREE.DoubleSide,depthWrite:state.depthWrite,depthFunc:THREE.LessEqualDepth,transparent:legacyTransparent,blending:state.blend?THREE.CustomBlending:THREE.NoBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
  const vertices=new Float32Array(assets.geometry,spec.vertexByteOffset,spec.vertices*8),interleaved=new THREE.InterleavedBuffer(vertices,8),geometry=new THREE.BufferGeometry(),position=new THREE.InterleavedBufferAttribute(interleaved,3,0);geometry.setAttribute('position',position);geometry.setAttribute('vPosition',position);geometry.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(interleaved,3,3));geometry.setAttribute('tc',new THREE.InterleavedBufferAttribute(interleaved,2,6));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(assets.geometry,spec.indexByteOffset,spec.indices),1));const mesh=new THREE.Mesh(geometry,material);mesh.name=spec.meshName??spec.name??spec.spec.name;mesh.frustumCulled=false;mesh.renderOrder=spec.drawOrder;if(spec.spec.position)mesh.position.set(spec.spec.position.x*.01,(2115-spec.spec.position.y)*.01,spec.spec.position.z*.01);root.add(mesh);const part={spec:spec.spec,record:spec,mesh,material,baseSide:material.side,matrices:new Float32Array(80),state:stateFor(spec.spec.name),cameras:new WeakMap()};material.onBeforeRender=()=>stream.upload(material,part.matrices);part.releaseSamplers=samplers.register(material,Object.fromEntries(Object.entries(spec.textures).map(([name,binding])=>[name,binding.sampler])));parts.push(part);
 }
 return{root,parts,stream,textures,baseTexture,samplers,async prepare(camera){
  // Initially hidden parts still need a compiled program before a script makes
  // them visible. Compile visible proxies without changing game visibility.
  const compilationScene=new THREE.Scene();
  for(const part of parts){const proxy=new THREE.Mesh(part.mesh.geometry,part.material);proxy.frustumCulled=false;compilationScene.add(proxy);}
  await renderer.compileAsync(compilationScene,camera);
 },update(camera,viewport=renderer.getDrawingBufferSize(new THREE.Vector2()),{skipParts}={}){
  const native=camera.userData.nativeCamera;if(!native)throw Error('Native basic renderer needs the authored camera');let identityMatrices;
  const screen=new Float32Array([1/(viewport.width??viewport.x),1/(viewport.height??viewport.y),0,0]);
  const projection=nativeShaderArray(native.projection);
  for(const part of parts){if(skipParts?.has(part))continue;const {state,spec,record}=part;part.material.uniforms.w_h_height.value.set(screen);part.material.uniforms.matProj.value.set(projection);
   part.mesh.renderOrder=native.reflection?(record.reflectionDrawOrder??record.drawOrder):record.drawOrder;
   if(part.material.transparent){const height=spec.kind==='Wall'?spec.height_top:spec.kind==='Light'?Math.fround(Math.fround(spec.surface_height??0)+Math.fround(spec.height)):spec.position?.z??0,bias=spec.kind==='Wall'?0:spec.depth_bias??0,slot=spec.kind==='Wall'?({side:0,top:1,bottom:2}[record.role]??0):0;part.mesh.userData.nativeTransparentOrder=nativeTransparentOrder(height,bias,spec.native_source_order,slot,!!native.reflection);part.mesh.renderOrder=part.mesh.userData.nativeTransparentOrder[0];}
   const angles=record.transform==='identity'?noAngles:[state?.rotx??spec.rot_and_tra[0],state?.roty??spec.rot_and_tra[1],state?.rotz??spec.rot_and_tra[2]];
   let cached=part.cameras.get(native);
   if(!cached||angles.some((value,i)=>value!==cached.angles[i])){
    if(record.transform==='identity')identityMatrices??=nativeModelMatrices(nativeIdentity(),native);
    cached={angles,matrices:record.transform==='identity'?identityMatrices:nativePrimitiveMatrices(spec,state,native)};
    if(record.probe&&!native.reflection)cached.mirror=nativeMirrorNormalFactor(record.transform==='identity'?nativeIdentity():nativePrimitiveWorld(spec,state),native,record.probe.plane,record.probe.strength);
    part.cameras.set(native,cached);
   }
   part.matrices.set(cached.matrices);
   if(record.transform==='identity'){
    part.mesh.visible=state?.[record.visibilityField]??record.defaultVisible;
    if(spec.kind==='Bumper'||spec.kind==='Gate')part.mesh.visible=!!part.mesh.visible&&!!(state?.visible??spec.is_visible??true)&&(record.role!=='bracket'||!!(state?.showbracket??spec.show_bracket));
   }else{
    part.mesh.visible=!!(state?.visible??spec.is_visible)&&(!state?.sequenceactive||!!state.sequencestate);
   }
   if(native.reflection){if(spec.is_reflection_enabled===false||record.probe)part.mesh.visible=false;part.material.side=native.reverseCullingByRenderer?part.baseSide:part.baseSide===THREE.DoubleSide?THREE.DoubleSide:part.baseSide===THREE.BackSide?THREE.FrontSide:THREE.BackSide;}
   else{part.material.side=part.baseSide;if(record.reflectionOnly)part.mesh.visible=false;}
   if(part.material.uniforms.tex_reflection)part.material.uniforms.tex_reflection.value=native.reflection?dummy:reflectionTexture??dummy;
   if(part.material.uniforms.tex_base_transmission)part.material.uniforms.tex_base_transmission.value=native.reflection&&record.reflectionTransmission===false?dummy:transmissionTexture??dummy;
   if(record.probe)part.material.uniforms.mirrorNormal_factor.value.set(cached.mirror??[0,0,0,0]);
  }
 },dispose(){for(const part of parts){part.releaseSamplers();part.mesh.geometry.dispose();part.material.dispose();}for(const texture of textures.values())texture.dispose();dummy.dispose();stream.dispose();scene.remove(root);}};
}
