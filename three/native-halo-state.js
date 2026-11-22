// SPDX-License-Identifier: GPL-3.0-or-later
// Light::Render and Renderer::Render ball-shadow uploads, pinned VPX revision.
import {nativeColor} from './light-animation.js';import {nativeShaderArray,nativeShaderFloat} from './native-shader-state.js';
const f=Math.fround;
export function nativeHaloState(spec,state){
 const intensity=f(state.inplayintensity),a=nativeColor(state.color),b=nativeColor(state.colorfull),color=(c,w)=>nativeShaderArray([f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),w]);
 return{visible:!!state.visible&&intensity!==0&&((a|b)&0xffffff)!==0,
  lightColor_intensity:color(a,intensity),lightColor2_falloff_power:color(b,spec.falloff_power),
  lightCenter_maxRange:nativeShaderArray([spec.center.x,spec.center.y,f(f(spec.surface_height)+f(spec.height)),f(1/Math.max(f(spec.falloff_radius),f(.1)))]),
  blend_modulate_vs_add:nativeShaderFloat(Math.max(f(.0001),Math.min(f(.9999),f(spec.bulb_modulate_vs_add)))),
 };
}
export function nativeBallShadowState(balls){
 const values=new Float32Array(32);let count=0;
 for(const ball of balls){if(ball.visible===false)continue;const {position,radius}=ball;values.set([position.x,position.y,position.z,radius],count++*4);if(count===8)break;}
 for(;count<8;count++)values.set([-1000,-1000,-1000,0],count*4);
 return nativeShaderArray(values);
}
