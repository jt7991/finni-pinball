// SPDX-License-Identifier: GPL-3.0-or-later
// Matrix3D::SetPlaneReflection / ModelViewProj / Primitive probe normal,
// Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeIdentity,nativeMultiply,nativeInverse} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround;
const normalize=([x,y,z])=>{x=f(x);y=f(y);z=f(z);const length=f(Math.sqrt(f(f(f(x*x)+f(y*y))+f(z*z))));if(length===0)throw Error('Reflection plane has no normal');const inverse=f(1/length);return[f(x*inverse),f(y*inverse),f(z*inverse)];};
export function nativePlaneReflection(plane){
  const [x,y,z]=normalize(plane),d=f(plane[3]),m=nativeIdentity();
  m[0]=f(1-f(f(2*x)*x));m[1]=m[4]=f(f(-2*x)*y);m[2]=m[8]=f(f(-2*x)*z);
  m[5]=f(1-f(f(2*y)*y));m[6]=m[9]=f(f(-2*y)*z);m[10]=f(1-f(f(2*z)*z));
  m[12]=f(f(-2*d)*x);m[13]=f(f(-2*d)*y);m[14]=f(f(-2*d)*z);return m;
}
export function nativeReflectionCamera(camera,plane){
  return{...camera,view:nativeMultiply(nativePlaneReflection(plane),camera.view),reflection:true};
}
export function nativeMirrorNormalFactor(world,camera,plane,strength){
  const inverse=nativeInverse(nativeMultiply(world,camera.view)),normal=plane.slice(0,3),rotated=[0,1,2].map(i=>f(f(f(inverse[i*4]*normal[0])+f(inverse[i*4+1]*normal[1]))+f(inverse[i*4+2]*normal[2])));
  return nativeShaderArray([...normalize(rotated),strength]);
}
// Primitive::Render uses the CPU MVP and local AABB, before the GLES shader
// precision clamp. A corner behind the eye expands the probe to the full view.
export function nativeProbeArea(bounds,world,camera){
  const mvp=nativeMultiply(nativeMultiply(world,camera.view),camera.projection),area=[1,1,-1,-1];
  for(let i=0;i<8;i++){
    const p=[0,1,2].map(j=>(i&(1<<j)?bounds.min:bounds.max)[j]);
    const project=j=>f(f(f(f(mvp[j]*p[0])+f(mvp[4+j]*p[1]))+f(mvp[8+j]*p[2]))+mvp[12+j]),w=project(3);
    if(w<=0)return[-1,-1,1,1];
    const x=f(project(0)/w),y=f(project(1)/w);
    area[0]=Math.min(area[0],x);area[1]=Math.min(area[1],y);area[2]=Math.max(area[2],x);area[3]=Math.max(area[3],y);
  }
  return area;
}
export function nativeProbeScissor(area,width,height){
  const pixel=(v,size)=>Math.max(0,Math.min(size,Math.trunc(f(f(.5+f(v*.5))*f(size))))),left=pixel(area[0],width),bottom=pixel(area[1],height),right=pixel(area[2],width),top=pixel(area[3],height);
  return[left,bottom,right-left,top-bottom];
}
