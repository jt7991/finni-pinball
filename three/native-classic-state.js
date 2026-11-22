// SPDX-License-Identifier: GPL-3.0-or-later
// Light::Render, Shader::SetMaterial and native GLES uniform conversion.
import {nativeColor} from './light-animation.js';import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround,color=(value,alpha)=>{const c=nativeColor(value);return nativeShaderArray([f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),alpha]);};
export function nativeClassicMaterialState(material,globals,imageMode=false){
 const metal=material.type==='metal';return{layer:0,is_metal:metal,lightingOff:!!imageMode,basicLightPos:nativeShaderArray(globals.positions),basicLightEmission:nativeShaderArray(globals.emissions),cAmbient_LightRange:nativeShaderArray(globals.ambientRange),fenvEmissionScale_TexWidth:nativeShaderArray(globals.envScaleWidth),fDisableLighting_top_below:nativeShaderArray(globals.disableLighting),cBase_Alpha:color(material.base_color,material.opacity_active?material.opacity:1),cGlossy_ImageLerp:color(metal?0:material.glossy_color,metal?0:material.glossy_image_lerp),cClearcoat_EdgeAlpha:color(material.clearcoat_color,material.edge_alpha),Roughness_WrapL_Edge_Thickness:nativeShaderArray([f(2**f(f(10*f(material.roughness))+1)),material.wrap_lighting,material.edge,material.thickness])};
}
export function nativeClassicLightState(spec,state,{skipOff=true}={}){
 const intensity=f(state.inplayintensity),a=nativeColor(state.color),b=nativeColor(state.colorfull);return{visible:!!state.visible&&(!skipOff||intensity!==0&&((a|b)&0xffffff)!==0),lightColor_intensity:color(a,intensity),lightColor2_falloff_power:color(b,spec.falloff_power),lightCenter_maxRange:nativeShaderArray([spec.center.x,spec.center.y,f(f(spec.surface_height)+f(spec.height)),f(1/Math.max(f(spec.falloff_radius),f(.1)))])};
}
