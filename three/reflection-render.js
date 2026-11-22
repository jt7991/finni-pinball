// SPDX-License-Identifier: GPL-3.0-or-later
// RenderProbe::DoRenderReflectionProbe, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. No recursive probe sampling.
import * as THREE from 'three';
import {applyNativeReflectionCamera} from './camera-render.js';
import {nativeProbeScissor} from './native-reflection.js';

export function createNativeReflectionPass(renderer,probe){
  if(probe.type!==0||probe.roughness!==0)throw Error('This native planar pass requires the authored zero-roughness probe');
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true}),camera=new THREE.PerspectiveCamera();let source=null;
  return{target,texture:target.texture,camera,resize(width,height){target.setSize(Math.max(1,Math.floor(width)),Math.max(1,Math.floor(height)));},render(mainCamera,draw,{area}={}){
    if(mainCamera.userData.nativeCamera!==source){source=mainCamera.userData.nativeCamera;applyNativeReflectionCamera(camera,mainCamera,probe.plane);camera.userData.nativeCamera.reverseCullingByRenderer=true;}
    const gl=renderer.getContext(),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear,setMaterial=renderer.state.setMaterial,cull=gl.getParameter(gl.CULL_FACE_MODE),cullEnabled=gl.isEnabled(gl.CULL_FACE),frontFace=gl.getParameter(gl.FRONT_FACE),scissor=target.scissor.clone(),scissorTest=target.scissorTest;
    // Reverse the raster cull face without changing material.side: changing
    // side also changes normals in non-raw Three shader programs.
    renderer.state.setMaterial=(material,frontFaceCW)=>{setMaterial(material,frontFaceCW);if(material.side!==THREE.DoubleSide)renderer.state.setCullFace(THREE.CullFaceFront);};
    try{
      renderer.autoClear=false;renderer.setClearColor(0,0);
      // VPX clears the entire probe, then clips its draw pass to the receiver's
      // projected bounds. Clearing only that rectangle leaves stale reflections.
      target.scissorTest=false;renderer.setRenderTarget(target);renderer.clear(true,true,false);
      if(area){const rectangle=nativeProbeScissor(area,target.width,target.height);target.scissor.fromArray(rectangle);target.scissorTest=true;renderer.setRenderTarget(target);if(!rectangle[2]||!rectangle[3])return;}
      draw(camera,target);
    }
    finally{
      renderer.state.setMaterial=setMaterial;
      // Three's ordinary material setter enables culling but assumes the cull
      // face remains BACK. Restore both the GL state and its Three cache.
      renderer.state.setCullFace(cull===gl.BACK?THREE.CullFaceBack:cull===gl.FRONT?THREE.CullFaceFront:THREE.CullFaceFrontBack);
      if(!cullEnabled)renderer.state.setCullFace(THREE.CullFaceNone);
      renderer.state.setFlipSided(frontFace===gl.CW);
      target.scissor.copy(scissor);target.scissorTest=scissorTest;
      renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);renderer.autoClear=autoClear;
    }
  },dispose(){target.dispose();}};
}
