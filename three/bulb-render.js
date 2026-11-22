// SPDX-License-Identifier: GPL-3.0-or-later
// Bulb halo and Reinhard curve adapted from Visual Pinball LightShader.glfx,
// FBShader.fxh and utils/color.h, 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import {nativeDragCurve} from './native-curve.js';

export function createBulbHalos(game,scene){
  const specs=game.specs.objects.filter(s=>s.kind==='Light'&&s.is_bulb_light&&!s.is_backglass&&s.drag_points?.length>=3),positions=[],indices=[],lamps=[];
  for(const spec of specs){
    const polygon=nativeDragCurve(spec.drag_points,true,4,2).map(p=>new THREE.Vector2(p.x*.01,(2115-p.y)*.01)),triangles=THREE.ShapeUtils.triangulateShape(polygon,[]),index=lamps.length;
    const surface=spec.surface_height??game.surface?.(spec)??0;
    for(const triangle of triangles)for(const vertex of triangle){positions.push(polygon[vertex].x,polygon[vertex].y,surface+(spec.bulb_halo_height??0)*.01+.001);indices.push(index);}
    lamps.push({spec,state:game.rules.objects.get(spec.name.toLowerCase()),surface});
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
  const mesh=new THREE.Mesh(geometry,material);mesh.name='NativeBulbHalos';mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);
  const color=(offset,value)=>{const c=Number(value)>>>0;data[offset]=(c&255)*Math.fround(1/255);data[offset+1]=(c&65280)*Math.fround(1/65280);data[offset+2]=(c&16711680)*Math.fround(1/16711680);};
  return{mesh,texture,lamps,update(){
    lamps.forEach(({spec,state,surface},i)=>{const offset=i*16;color(offset,state.color);data[offset+3]=Number(state.inplayintensity);color(offset+4,state.colorfull);data[offset+7]=spec.falloff_power??2;data[offset+8]=spec.center.x*.01;data[offset+9]=(2115-spec.center.y)*.01;data[offset+10]=surface+(spec.height??0)*.01;data[offset+11]=1/(Math.max(spec.falloff_radius??50,.1)*.01);data[offset+12]=Math.min(.9999,Math.max(.0001,spec.bulb_modulate_vs_add??.9));data[offset+13]=state.visible?1:0;});texture.needsUpdate=true;
  }};
}

export function createLightFrame(renderer){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedShortType)}),scene=new THREE.Scene(),camera=new THREE.Camera();
  const material=new THREE.ShaderMaterial({uniforms:{frame:{value:target.texture},depth:{value:target.depthTexture}},depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 uvFrame;void main(){uvFrame=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;varying vec2 uvFrame;void main(){vec3 result=texture2D(frame,uvFrame).rgb;float d=texture2D(depth,uvFrame).r;if(d!=0.&&d!=1.){float l=min(dot(result,vec3(.176204,.812985,.0108109)),1000.);result*=((l*.25+1.)/(l+1.));}gl_FragColor=vec4(clamp(result,0.,1.),1.);
#include <colorspace_fragment>
}`});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);
  return{target,resize(){const size=renderer.getDrawingBufferSize(new THREE.Vector2());target.setSize(size.x,size.y);},render(world,view,draw){renderer.setRenderTarget(target);if(draw)draw(target);else renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);}};
}
