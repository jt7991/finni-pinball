// SPDX-License-Identifier: GPL-3.0-or-later
// ClassicLightShader / Material_GL / Helpers and Shader::SetMaterial,
// Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import materialSource from './shaders/material.glsl?raw';
import helperSource from './shaders/light-helpers.glsl?raw';
import {nativeColor} from './light-animation.js';
import {nativeDragCurve} from './native-curve.js';

const f=Math.fround,es=source=>source.replace(/\bconst\s+/g,'').replace(/^#pragma[^\n]*$/gm,''),prefix=`
#define GLSL
#define NUM_BALL_LIGHTS 0
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define BRANCH
#define PI 3.14159265358979323846
#define FLT_MIN_VALUE .00006103515625
#define lerp mix
#define saturate(x) clamp(x,0.,1.)
#define sqr(x) ((x)*(x))
#define texNoLod(s,uv) textureLod(s,uv,0.)
uniform mat4 matView[1];uniform sampler2D tex_env;uniform sampler2D tex_diffuse_env;uniform sampler2D tex_light_color;uniform bool is_metal;uniform bool lightingOff;
uniform vec4 cGlossy_ImageLerp;uniform vec4 cClearcoat_EdgeAlpha;
`;
const vertex=`attribute vec3 nativePosition;attribute float lampIndex;uniform mat4 matView[1];uniform sampler2D lampData;uniform float lampCount;
varying vec2 tex0;varying vec3 worldPos;varying vec3 tablePos;varying vec3 lampNormal;
flat varying vec4 lightColor_intensity;flat varying vec4 lightColor2_falloff_power;flat varying vec4 lightCenter_maxRange;flat varying vec2 enabled;
void main(){float y=(lampIndex+.5)/lampCount;lightColor_intensity=texture2D(lampData,vec2(.125,y));lightColor2_falloff_power=texture2D(lampData,vec2(.375,y));lightCenter_maxRange=texture2D(lampData,vec2(.625,y));enabled=texture2D(lampData,vec2(.875,y)).xy;
tablePos=nativePosition;worldPos=(matView[0]*vec4(nativePosition,1.)).xyz;lampNormal=(matView[0]*vec4(0.,0.,1.,0.)).xyz;tex0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=prefix+es(helperSource)+es(materialSource)+`
varying vec2 tex0;varying vec3 worldPos;varying vec3 tablePos;varying vec3 lampNormal;
flat varying vec4 lightColor_intensity;flat varying vec4 lightColor2_falloff_power;flat varying vec4 lightCenter_maxRange;flat varying vec2 enabled;
void main(){if(enabled.x==0.||(enabled.y!=0.&&lightColor_intensity.w==0.))discard;
vec4 pixel=textureLod(tex_light_color,tex0,0.);vec4 color;
if(lightingOff)color=pixel;else{pixel.xyz=clamp(pixel.xyz,0.,1.);vec3 diffuse=pixel.xyz*cBase_Alpha.xyz;vec3 glossy=is_metal?diffuse:pixel.xyz*cGlossy_ImageLerp.xyz*.08;vec3 specular=cClearcoat_EdgeAlpha.xyz*.08;float edge=is_metal?1.:Roughness_WrapL_Edge_Thickness.z;
color.xyz=lightLoop(worldPos,normalize(lampNormal),normalize(-worldPos),diffuse,glossy,specular,edge,is_metal,0.);color.a=pixel.a;}
color.a*=cBase_Alpha.a;
if(lightColor_intensity.w!=0.){float len=length(lightCenter_maxRange.xyz-tablePos)*lightCenter_maxRange.w;float atten=pow(1.-clamp(len,0.,1.),lightColor2_falloff_power.w);vec3 lcolor=mix(lightColor2_falloff_power.xyz,lightColor_intensity.xyz,sqrt(len));color+=vec4(lcolor*(atten*lightColor_intensity.w),clamp(atten*lightColor_intensity.w,0.,1.));color=OverlayHDR(pixel,color);color=ScreenHDR(pixel,color);}
gl_FragColor=color;}`;

export const classicShader={vertex,fragment};
export function colorVector(value,alpha=0){const c=nativeColor(value);return new THREE.Vector4(f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),f(alpha));}
export async function loadNativeLighting(base){
  const response=await fetch(base+'native-lighting.json');if(!response.ok)throw Error('Native lighting metadata unavailable');const metadata=await response.json(),textures={};
  await Promise.all(Object.entries(metadata.textures).map(async([name,spec])=>{
    const response=await fetch(base+spec.file);if(!response.ok)throw Error('Native lighting texture unavailable');const buffer=await response.arrayBuffer(),values=spec.type==='half'?new Uint16Array(buffer):new Uint8Array(buffer),texture=new THREE.DataTexture(values,spec.width,spec.height,THREE.RGBAFormat,spec.type==='half'?THREE.HalfFloatType:THREE.UnsignedByteType);
    texture.colorSpace=spec.colorSpace==='srgb'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=spec.sampler[10242]===10497?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.wrapT=spec.sampler[10243]===10497?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
    texture.magFilter=spec.sampler[10240]===9728?THREE.NearestFilter:THREE.LinearFilter;texture.minFilter=spec.sampler[10241]===9987?THREE.LinearMipmapLinearFilter:texture.magFilter;texture.generateMipmaps=spec.sampler[10241]===9987;texture.needsUpdate=true;textures[name]=texture;
  }));return{metadata,textures};
}

export function createClassicLights(game,scene,floor,lighting){
  const specs=game.specs.objects.filter(s=>s.kind==='Light'&&!s.is_bulb_light&&!s.is_backglass&&s.drag_points?.length>=3),groups=new Map(),lamps=[],globals=lighting.metadata.globals,view=new THREE.Matrix4();
  const data=new Float32Array(Math.max(1,specs.length)*16),texture=new THREE.DataTexture(data,4,Math.max(1,specs.length),THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  const materials=new Map(lighting.metadata.materials.map(m=>[m.name,m]));
  for(const spec of specs){
    const name=lighting.metadata.surfaceMaterials[spec.surface??''],material=materials.get(name);if(!material)throw Error('Missing native light surface material '+name);
    const key=name+'|'+!!spec.is_image_mode;if(!groups.has(key))groups.set(key,{material,imageMode:!!spec.is_image_mode,positions:[],native:[],uv:[],indices:[]});
    const group=groups.get(key),index=lamps.length,surface=spec.surface_height??game.surface?.(spec)??0,nativeHeight=f(f(surface*100)+f(.1)),polygon=nativeDragCurve(spec.drag_points,true,4,2),triangles=THREE.ShapeUtils.triangulateShape(polygon.map(p=>new THREE.Vector2(p.x,p.y)),[]);
    for(const triangle of triangles)for(const i of triangle){const p=polygon[i];group.positions.push(p.x*.01,(2115-p.y)*.01,nativeHeight*.01);group.native.push(p.x,p.y,nativeHeight);group.uv.push(f(p.x*f(1/952)),f(p.y*f(1/2115)));group.indices.push(index);}
    lamps.push({spec,state:game.rules.objects.get(spec.name.toLowerCase()),surface,skipOff:!spec.is_image_mode&&!!spec.image&&lighting.metadata.surfaceImages[spec.surface??'']===spec.image});
  }
  const meshes=[];
  for(const [name,group]of groups){
    const spec=group.material,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(group.positions,3));geometry.setAttribute('nativePosition',new THREE.Float32BufferAttribute(group.native,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(group.uv,2));geometry.setAttribute('lampIndex',new THREE.Float32BufferAttribute(group.indices,1));
    const vector=a=>new THREE.Vector4(...a),pairs=a=>[vector(a.slice(0,4)),vector(a.slice(4,8))];
    const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{lampData:{value:texture},lampCount:{value:Math.max(1,specs.length)},matView:{value:[view]},tex_env:{value:lighting.textures.environment},tex_diffuse_env:{value:lighting.textures.irradiance},tex_light_color:{value:floor},is_metal:{value:spec.type==='metal'},lightingOff:{value:group.imageMode},basicLightPos:{value:pairs(globals.positions)},basicLightEmission:{value:pairs(globals.emissions)},cAmbient_LightRange:{value:vector(globals.ambientRange)},fenvEmissionScale_TexWidth:{value:new THREE.Vector2(...globals.envScaleWidth)},fDisableLighting_top_below:{value:new THREE.Vector2(...globals.disableLighting)},cBase_Alpha:{value:colorVector(spec.base_color,spec.opacity_active?spec.opacity:1)},cGlossy_ImageLerp:{value:colorVector(spec.type==='metal'?0:spec.glossy_color,spec.glossy_image_lerp)},cClearcoat_EdgeAlpha:{value:colorVector(spec.clearcoat_color,spec.edge_alpha)},Roughness_WrapL_Edge_Thickness:{value:new THREE.Vector4(f(2**f(f(10*f(spec.roughness))+1)),f(spec.wrap_lighting),f(spec.edge),f(spec.thickness))}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor});
    const mesh=new THREE.Mesh(geometry,material);mesh.name='NativeClassicLights:'+name;mesh.frustumCulled=false;mesh.renderOrder=0;scene.add(mesh);meshes.push(mesh);
  }
  const conversion=new THREE.Matrix4().makeTranslation(0,21.15,0).multiply(new THREE.Matrix4().makeScale(.01,-.01,.01)),units=new THREE.Matrix4().makeScale(100,100,100);
  return{meshes,lamps,texture,view,update(camera){
    view.copy(units).multiply(camera.matrixWorldInverse).multiply(conversion);
    for(const [index,{spec,state,surface,skipOff}]of lamps.entries()){
      const offset=index*16,low=colorVector(state.color,state.inplayintensity),full=colorVector(state.colorfull,spec.falloff_power??2);low.toArray(data,offset);full.toArray(data,offset+4);data[offset+8]=spec.center.x;data[offset+9]=spec.center.y;data[offset+10]=f(f(surface*100)+f(spec.height??0));data[offset+11]=f(1/Math.max(spec.falloff_radius??50,.1));data[offset+12]=state.visible&&(!skipOff||((nativeColor(state.color)|nativeColor(state.colorfull))&0xffffff))?1:0;data[offset+13]=skipOff?1:0;
    }texture.needsUpdate=true;
  }};
}
