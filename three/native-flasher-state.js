// SPDX-License-Identifier: GPL-3.0-or-later
// Flasher::Render uniforms and legacy transparent depth, pinned VPX revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeIdentity,nativeMultiply} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
import {nativeColor} from './light-animation.js';
const f=Math.fround;
export const nativeFlasherMVP=camera=>nativeShaderArray(nativeMultiply(nativeMultiply(nativeIdentity(),camera.view),camera.projection));
const filters={none:0,additive:1,overlay:2,multiply:3,screen:4};
export function nativeFlasherLong(value){const n=Number(value),floor=Math.floor(n);return n-floor===.5?(floor%2===0?floor:floor+1):Math.round(n);}
export function nativeFlasherState(spec,state={},imageA,imageB){
 const color=nativeColor(state.color??spec.color??0xffffff),opacity=Math.max(0,nativeFlasherLong(state.opacity??spec.alpha??100)),intensity=f(state.intensityscale??1),add=!!(state.addblend??(spec.add_blend==='add')),modulate=f(Math.max(f(.00001),Math.min(f(.9999),f(state.modulatevsadd??spec.modulate_vs_add??.9)))),mode=imageA&&imageB?1:imageA||imageB?0:2,selected=imageA??imageB,filter=filters[String(state.filter??spec.filter??'none').toLowerCase()]??0;
 // The pinned wasm32 build folds division by100 into a Float32 reciprocal.
 const alpha=f(f(f(opacity)*intensity)*f(.01));
 return{visible:!!(state.visible??spec.is_visible)&&(!state.sequenceactive||!!state.sequencestate)&&color!==0&&opacity!==0&&intensity!==0,add,depth:f(f(spec.depth_bias??0)-f(state.height??spec.height)),
  staticColor_Alpha:nativeShaderArray([f((color&255)*f(1/255)),f((color&65280)*f(1/65280)),f((color&16711680)*f(1/16711680)),alpha]),
  alphaTestValueAB_filterMode_addBlend:nativeShaderArray([!add&&selected?selected.alphaTest:-1,!add&&imageA&&imageB?imageB.alphaTest:-1,filter,add?1:0]),
  amount_blend_modulate_vs_add_flasherMode:nativeShaderArray([f(f(Math.max(0,nativeFlasherLong(state.amount??spec.filter_amount??100)))*f(.01)),modulate,mode]),
 };
}
// Homogeneous clipping: rejecting a quad wholly beyond one plane preserves
// every rasterized pixel, and avoids loading offscreen DMD sprite textures.
export function nativeFlasherOutside(vertices,matrix){
 const clips=[];for(let i=0;i<vertices.length;i+=8){const x=vertices[i],y=vertices[i+1],z=vertices[i+2],p=[0,1,2,3].map(j=>f(f(f(f(matrix[j]*x)+f(matrix[4+j]*y))+f(matrix[8+j]*z))+matrix[12+j]));clips.push(p);}
 const margin=Math.max(1,...clips.flatMap(p=>p.map(Math.abs)))*.00001;
 return[0,1,2].some(axis=>clips.every(p=>p[axis]<-p[3]-margin)||clips.every(p=>p[axis]>p[3]+margin));
}
