// SPDX-License-Identifier: GPL-3.0-or-later
// Primitive::RecalculateMatrices, Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeChain,nativeTranslate,nativeScale,nativeRotate,nativeMultiply,nativeInverse} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround,rad=value=>f(f(value)*f(Math.PI/180));
export function nativePrimitiveWorld(spec,state){
 const r=spec.rot_and_tra.slice(),p=spec.position,s=spec.size;
 if(state)for(const [i,name] of ['rotx','roty','rotz'].entries())if(state[name]!==undefined)r[i]=state[name];
 const rt=nativeChain(nativeTranslate(...r.slice(3,6)),...[[2,'z'],[1,'y'],[0,'x'],[8,'z'],[7,'y'],[6,'x']].map(([i,axis])=>nativeRotate(axis,rad(r[i]))));
 return nativeChain(nativeScale(s.x,s.y,s.z),rt,nativeTranslate(p.x,p.y,p.z));
}
export function nativePrimitiveMatrices(spec,state,camera){
 return nativeModelMatrices(nativePrimitiveWorld(spec,state),camera);
}
export function nativeModelMatrices(world,camera){
 const view=camera.view,worldView=nativeMultiply(world,view),inverse=nativeInverse(worldView),normal=Float32Array.from({length:16},(_,i)=>inverse[(i%4)*4+Math.floor(i/4)]),mvp=nativeMultiply(worldView,camera.projection);
 return nativeShaderArray([...world,...view,...worldView,...normal,...mvp]);
}
