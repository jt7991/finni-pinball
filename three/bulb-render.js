// SPDX-License-Identifier: GPL-3.0-or-later
// Bulb halo and Reinhard curve adapted from Visual Pinball LightShader.glfx,
// FBShader.fxh and utils/color.h, 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import {nativeDragCurve} from './native-curve.js';
import {nativeTransparentOrder} from './native-render-order.js';
import {createNativePostprocess} from './native-postprocess.js';

export function createBulbHalos(game,scene){
  const specs=game.specs.objects.filter(s=>s.kind==='Light'&&s.is_bulb_light&&!s.is_backglass&&s.drag_points?.length>=3),positions=[],indices=[],lamps=[];
  for(const spec of specs){
    const start=positions.length/3;
    const polygon=nativeDragCurve(spec.drag_points,true,4,2).map(p=>new THREE.Vector2(p.x*.01,(2115-p.y)*.01)),triangles=THREE.ShapeUtils.triangulateShape(polygon,[]),index=lamps.length;
    const surface=spec.surface_height??game.surface?.(spec)??0;
    for(const triangle of triangles)for(const vertex of triangle){positions.push(polygon[vertex].x,polygon[vertex].y,surface+(spec.bulb_halo_height??0)*.01+.001);indices.push(index);}
    lamps.push({spec,state:game.rules.objects.get(spec.name.toLowerCase()),surface,start,count:positions.length/3-start});
  }
  const data=new Float32Array(Math.max(1,lamps.length)*16),texture=new THREE.DataTexture(data,4,Math.max(1,lamps.length),THREE.RGBAFormat,THREE.FloatType);
  texture.needsUpdate=true;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('lampIndex',new THREE.Float32BufferAttribute(indices,1));
  const material=new THREE.ShaderMaterial({
    uniforms:{lampData:{value:texture},lampCount:{value:Math.max(1,lamps.length)}},
    vertexShader:`attribute float lampIndex;uniform sampler2D lampData;uniform float lampCount;varying vec3 tablePos;varying vec4 lowColor;varying vec4 fullColor;varying vec4 centerRange;varying vec2 blendVisible;
void main(){float y=(lampIndex+.5)/lampCount;lowColor=texture2D(lampData,vec2(.125,y));fullColor=texture2D(lampData,vec2(.375,y));centerRange=texture2D(lampData,vec2(.625,y));blendVisible=texture2D(lampData,vec2(.875,y)).xy;tablePos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 tablePos;varying vec4 lowColor;varying vec4 fullColor;varying vec4 centerRange;varying vec2 blendVisible;
void main(){if(blendVisible.y==0.||lowColor.w==0.)discard;float len=length(tablePos-centerRange.xyz)*centerRange.w;float atten=pow(max(1.-len,.0001),fullColor.w);vec3 lcolor=mix(fullColor.xyz,lowColor.xyz,sqrt(len));float blend=blendVisible.x;gl_FragColor=vec4(lcolor*(-blend*atten*lowColor.w),1./blend-1.);}`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.CustomBlending,blendEquation:THREE.ReverseSubtractEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcColorFactor,
  });
  material.polygonOffset=true;material.polygonOffsetFactor=0;material.polygonOffsetUnits=-1;
  const meshes=lamps.map(lamp=>{const shape=lamps.length===1?geometry:new THREE.BufferGeometry();if(shape!==geometry)for(const [name,attribute]of Object.entries(geometry.attributes))shape.setAttribute(name,attribute);shape.setDrawRange(lamp.start,lamp.count);const mesh=new THREE.Mesh(shape,material);mesh.name='NativeBulbHalo:'+lamp.spec.name;mesh.frustumCulled=false;const height=Math.fround(Math.fround(lamp.surface*100)+Math.fround(lamp.spec.bulb_halo_height??0));mesh.userData.nativeTransparentOrder=nativeTransparentOrder(height,lamp.spec.depth_bias??0,lamp.spec.native_source_order,2);mesh.renderOrder=mesh.userData.nativeTransparentOrder[0];return mesh;});
  const mesh=meshes.length===1?meshes[0]:new THREE.Group();if(mesh.isGroup)mesh.add(...meshes);mesh.name='NativeBulbHalos';scene.add(mesh);
  const color=(offset,value)=>{const c=Number(value)>>>0;data[offset]=(c&255)*Math.fround(1/255);data[offset+1]=(c&65280)*Math.fround(1/65280);data[offset+2]=(c&16711680)*Math.fround(1/16711680);};
  return{mesh,meshes,texture,lamps,update(){
    lamps.forEach(({spec,state,surface},i)=>{const offset=i*16;color(offset,state.color);data[offset+3]=Number(state.inplayintensity);color(offset+4,state.colorfull);data[offset+7]=spec.falloff_power??2;data[offset+8]=spec.center.x*.01;data[offset+9]=(2115-spec.center.y)*.01;data[offset+10]=surface+(spec.height??0)*.01;data[offset+11]=1/(Math.max(spec.falloff_radius??50,.1)*.01);data[offset+12]=Math.min(.9999,Math.max(.0001,spec.bulb_modulate_vs_add??.9));data[offset+13]=state.visible?1:0;meshes[i].visible=!!state.visible&&Number(state.inplayintensity)!==0&&((Number(state.color)|Number(state.colorfull))&0xffffff)!==0;});texture.needsUpdate=true;
  }};
}

export function createLightFrame(renderer,assets,sharedTargets){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedShortType)});
  const previous=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});let historyEnabled=true,historyInitialized=false;
  const postprocess=createNativePostprocess(renderer,assets,target,sharedTargets);let frameIndex=0;
  return{target,previous,postprocess,setHistoryEnabled(value){historyEnabled=!!value;},prepare:()=>postprocess.prepare(),resize(){
    const size=renderer.getDrawingBufferSize(new THREE.Vector2()),resetHistory=!historyInitialized||previous.width!==size.x||previous.height!==size.y;
    target.setSize(size.x,size.y);previous.setSize(size.x,size.y);postprocess.resize(size.x,size.y);
    // A camera/quality update can call resize without reallocating a texture.
    // VPX retains its previous HDR across those updates; only new storage
    // starts black. Clearing here unconditionally destroys ball reflections.
    if(resetHistory){const before=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();try{renderer.setRenderTarget(previous);renderer.setClearColor(0,0);renderer.clear(true,false,false);historyInitialized=true;}finally{renderer.setRenderTarget(before);renderer.setClearColor(clear,alpha);}}
  },render(world,view,draw,cabinetOffset){renderer.setRenderTarget(target);if(draw)draw(target);else renderer.render(world,view);if(historyEnabled)renderer.copyTextureToTexture(target.texture,previous.texture);postprocess.setCabinetOffset(cabinetOffset);postprocess.update(++frameIndex);postprocess.render();renderer.setRenderTarget(null);}};
}
