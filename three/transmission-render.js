// SPDX-License-Identifier: GPL-3.0-or-later
// Native bulb transmission and 19x19 Gaussian passes. Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf; see VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import {nativeMultiply} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround,stripVersion=source=>source.replace(/^#version[^\n]*\n/,'');

export async function loadNativeTransmission(base){
  const read=async file=>{const response=await fetch(base+file);if(!response.ok)throw Error('Native transmission asset unavailable: '+file);return response;};
  const metadata=await(await read('native-transmission.json')).json(),geometry=await(await read(metadata.geometry.file)).arrayBuffer(),programs={};
  await Promise.all(Object.entries(metadata.programs).map(async([name,program])=>{
    programs[name]={vertex:stripVersion(await(await read(program.vertex.file)).text()),fragment:stripVersion(await(await read(program.fragment.file)).text())};
  }));return{metadata,geometry,programs};
}
const color=(value,intensity)=>{const c=Number(value)>>>0;return new Float32Array([
  f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),f(intensity),
]);};
export function nativeTransmissionScissor(parts,camera,width,height,margin=0){
  const m=nativeMultiply(camera.view,camera.projection),bounds=[1,1,-1,-1];
  for(const {spec}of parts)for(let i=0;i<4;i++){
    const radius=f(spec.falloff_radius),x=f(f(spec.center.x)+((i&1)?-radius:radius)),y=f(f(spec.center.y)+((i&2)?-radius:radius)),z=f(f(f(spec.surface_height)+f(spec.bulb_halo_height??0))+f(.1)),
      coordinate=j=>f(f(f(f(m[j]*x)+f(m[4+j]*y))+f(m[8+j]*z))+m[12+j]),w=coordinate(3);
    if(w<=0){bounds.splice(0,4,-1,-1,1,1);break;}
    const xp=f(coordinate(0)/w),yp=f(coordinate(1)/w);
    bounds[0]=Math.min(bounds[0],xp);bounds[1]=Math.min(bounds[1],yp);bounds[2]=Math.max(bounds[2],xp);bounds[3]=Math.max(bounds[3],yp);
  }
  const pixels=bounds.map((v,i)=>Math.max(0,Math.min(i%2?height:width,Math.trunc(f(f(f(.5)+f(f(v+f(i<2?-margin:margin))*f(.5)))*(i%2?height:width))))));
  return[pixels[0],pixels[1],pixels[2]-pixels[0],pixels[3]-pixels[1]];
}
export function createNativeTransmission(renderer,assets,stateFor){
  const scene=new THREE.Scene(),camera=new THREE.Camera(),parts=[],targets=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{
    type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,
  }));
  for(const record of assets.metadata.parts){
    const spec=record.spec,vertices=new THREE.InterleavedBuffer(new Float32Array(assets.geometry,record.vertexByteOffset,record.vertices*8),8),geometry=new THREE.BufferGeometry(),position=new THREE.InterleavedBufferAttribute(vertices,3,0);
    geometry.setAttribute('position',position);geometry.setAttribute('vPosition',position);geometry.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(vertices,3,3));geometry.setAttribute('tc',new THREE.InterleavedBufferAttribute(vertices,2,6));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(assets.geometry,record.indexByteOffset,record.indices),1));
    const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:assets.programs.bulb.vertex,fragmentShader:assets.programs.bulb.fragment,
      uniforms:{matWorldViewProj:{value:new Float32Array(16)},layer:{value:0},lightColor_intensity:{value:new Float32Array(4)},lightColor2_falloff_power:{value:new Float32Array(4)},lightCenter_maxRange:{value:new Float32Array([spec.center.x,spec.center.y,f(f(spec.surface_height)+f(spec.height)),f(1/Math.max(f(spec.falloff_radius),f(.1)))])},blend_modulate_vs_add:{value:f(.0001)}},
      depthTest:false,depthWrite:false,side:THREE.BackSide,transparent:true,blending:THREE.CustomBlending,
      blendEquation:THREE.ReverseSubtractEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcColorFactor,
    });
    const mesh=new THREE.Mesh(geometry,material);mesh.name=spec.name;mesh.frustumCulled=false;mesh.renderOrder=parts.length;scene.add(mesh);parts.push({spec,mesh,material,state:stateFor(spec.name)});
  }
  // Original RenderDevice fullscreen strip, expanded to the same two triangles.
  const quadGeometry=new THREE.BufferGeometry(),quadValues=new THREE.InterleavedBuffer(new Float32Array([
    1,1,0,1,0,-1,1,0,0,0,1,-1,0,1,1,-1,-1,0,0,1,
  ]),5),quadPosition=new THREE.InterleavedBufferAttribute(quadValues,3,0);
  quadGeometry.setAttribute('position',quadPosition);quadGeometry.setAttribute('vPosition',quadPosition);quadGeometry.setAttribute('tc',new THREE.InterleavedBufferAttribute(quadValues,2,3));quadGeometry.setIndex([0,1,2,2,1,3]);
  const blurScenes=[],blurMaterials=[];
  for(const name of ['horizontal','vertical']){
    const program=assets.programs[name],material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:program.vertex,fragmentShader:program.fragment,
      uniforms:{layer:{value:0},w_h_height:{value:new Float32Array([1,1,1,1])},tex_fb_filtered:{value:targets[name==='horizontal'?0:1].texture}},
      depthTest:false,depthWrite:false,side:THREE.DoubleSide,
    }),pass=new THREE.Scene(),quad=new THREE.Mesh(quadGeometry,material);quad.frustumCulled=false;pass.add(quad);blurScenes.push(pass);blurMaterials.push(material);
  }
  let rectangles;
  return{parts,targets,texture:targets[0].texture,get rectangles(){return rectangles;},async prepare(){const proxies=new THREE.Scene();for(const part of parts){const proxy=new THREE.Mesh(part.mesh.geometry,part.material);proxy.frustumCulled=false;proxies.add(proxy);}await renderer.compileAsync(proxies,camera);for(const pass of blurScenes)await renderer.compileAsync(pass,camera);},resize(width,height){
    const w=Math.max(1,Math.floor(width/4)),h=Math.max(1,Math.floor(height/4));
    for(const target of targets)target.setSize(w,h);
    for(const material of blurMaterials)material.uniforms.w_h_height.value.set([f(1/w),f(1/h),1,1]);
  },update(view){
    const native=view.userData.nativeCamera;if(!native)throw Error('Native transmission needs the authored camera');
    const matrix=nativeShaderArray(nativeMultiply(native.view,native.projection));
    rectangles={light:nativeTransmissionScissor(parts,native,targets[0].width,targets[0].height),blur:nativeTransmissionScissor(parts,native,targets[0].width,targets[0].height,.05)};
    for(const part of parts){const {state,spec,material,mesh}=part;material.uniforms.matWorldViewProj.value.set(matrix);
      const intensity=f(f(state.inplayintensity)*f(spec.transmission_scale));mesh.visible=!!state.visible&&intensity!==0&&((Number(state.color)|Number(state.colorfull))&0xffffff)!==0;
      material.uniforms.lightColor_intensity.value.set(color(state.color,intensity));material.uniforms.lightColor2_falloff_power.value.set(color(state.colorfull,spec.falloff_power));
    }
  },render(){
    const previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
    const clip=(target,rectangle)=>{target.scissor.fromArray(rectangle);target.scissorTest=true;renderer.setRenderTarget(target);};
    try{renderer.autoClear=false;renderer.setClearColor(0,0);targets[0].scissorTest=false;renderer.setRenderTarget(targets[0]);renderer.clear(true,false,false);clip(targets[0],rectangles.light);renderer.render(scene,camera);
      // VPX keeps the temporary buffer outside the pass's area of interest.
      // The full renderer also uses this buffer for bloom between frames.
      if(parts.some(p=>p.mesh.visible)){clip(targets[1],rectangles.blur);renderer.render(blurScenes[0],camera);clip(targets[0],rectangles.blur);renderer.render(blurScenes[1],camera);}
    }finally{for(const target of targets)target.scissorTest=false;renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);renderer.autoClear=autoClear;}
  },dispose(){for(const part of parts){part.mesh.geometry.dispose();part.material.dispose();}quadGeometry.dispose();for(const material of blurMaterials)material.dispose();for(const target of targets)target.dispose();}};
}
