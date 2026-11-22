// SPDX-License-Identifier: GPL-3.0-or-later
// HitTarget::GenerateMesh/UpdateTarget, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. Original local vertex template.
import {nativeChain,nativeRotate,nativeScale,nativeTranslate,nativeTransform} from './native-matrix.js';
const f=Math.fround,rad=value=>f(f(value)*f(Math.PI/180));
export function nativeStandupRenderVertices(spec,template,offset=0,{initial=false,output=new Float32Array(template.length)}={}){
 const rotation=initial?nativeRotate('z',rad(spec.rot_z)):nativeChain(nativeRotate('x',rad(offset)),nativeRotate('z',rad(spec.rot_z))),size=spec.size,position=spec.position,world=initial?null:nativeChain(nativeScale(size.x,size.y,size.z),rotation,nativeTranslate(position.x,position.y,position.z));
 for(let i=0;i<template.length;i+=8){
  let p=Array.from(template.subarray(i,i+3));
  if(initial){p=nativeTransform(rotation,p.map((v,j)=>f(v*f(size[['x','y','z'][j]]))));p=p.map((v,j)=>f(v+f(position[['x','y','z'][j]])));}
  else p=nativeTransform(world,p);
  // MultiplyVectorNoTranslate omits the final +0, preserving signed zeros.
  const n=[0,1,2].map(j=>f(f(f(rotation[j]*template[i+3])+f(rotation[4+j]*template[i+4]))+f(rotation[8+j]*template[i+5])));
  output.set(p,i);output.set(n,i+3);output.set(template.subarray(i+6,i+8),i+6);
 }
 return output;
}
export function nativeDropRenderVertices(rest,offset,output=new Float32Array(rest.length)){
 output.set(rest);for(let i=2;i<output.length;i+=8)output[i]=f(rest[i]+f(offset));return output;
}
