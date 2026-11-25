// SPDX-License-Identifier: GPL-3.0-or-later
// Spinner::UpdatePlate, Gate::Render, Bumper::UpdateSkirt, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeChain,nativeRotate,nativeScale,nativeTranslate,nativeTransform} from './native-matrix.js';
import {nativeAngleSin,nativeAngleCos} from './native-angle-math.js';
const f=Math.fround,rad=value=>f(f(value)*f(Math.PI/180)),rotate=(axis,angle)=>nativeRotate(axis,angle,nativeAngleSin,nativeAngleCos);
function write(template,rotation,position,output,writeUV=true){
 for(let i=0;i<template.length;i+=8){output.set(position(i),i);for(let j=0;j<3;j++)output[i+3+j]=f(f(f(rotation[j]*template[i+3])+f(rotation[4+j]*template[i+4]))+f(rotation[8+j]*template[i+5]));if(writeUV){output[i+6]=template[i+6];output[i+7]=template[i+7];}}return output;
}
export function nativeSpinnerRenderVertices(spec,template,angle,surface=0,output=new Float32Array(template.length)){
 const rotation=nativeChain(rotate('x',-f(angle)),rotate('z',rad(spec.rotation))),length=f(spec.length),z=f(f(surface)+f(spec.height));
 return write(template,rotation,i=>{const p=nativeTransform(rotation,template.subarray(i,i+3));return[f(f(p[0]*length)+f(spec.center.x)),f(f(p[1]*length)+f(spec.center.y)),f(f(p[2]*length)+z)];},output);
}
export function nativeGateRenderVertices(spec,template,angle,surface=0,output=new Float32Array(template.length)){
 const rotation=nativeChain(rotate('x',spec.two_way?f(angle):-f(angle)),rotate('z',rad(spec.rotation))),world=nativeChain(rotation,nativeScale(spec.length),nativeTranslate(spec.center.x,spec.center.y,f(f(spec.height)+f(surface))));
 return write(template,rotation,i=>nativeTransform(world,template.subarray(i,i+3)),output,false);
}
export function nativeBumperSkirtVertices(spec,template,rotx,roty,surface=0,{initial=false,output=new Float32Array(template.length)}={}){
 const rotation=initial?rotate('z',rad(spec.orientation)):nativeChain(rotate('z',rad(spec.orientation)),rotate('y',rad(roty)),rotate('x',rad(rotx))),radius=f(spec.radius),height=f(spec.height_scale),z=f(f(surface)+5);
 return write(template,rotation,i=>{const p=nativeTransform(rotation,template.subarray(i,i+3));return[f(f(p[0]*radius)+f(spec.center.x)),f(f(p[1]*radius)+f(spec.center.y)),f(f(p[2]*height)+z)];},output);
}
