// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball ViewSetup legacy camera, 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeIdentity as identity,nativeChain as chain,nativeTranslate as translate,nativeScale as scale,nativeRotate as rotate,nativeTransform as transform,nativeInverse as inverse,nativePerspective as perspective} from './native-matrix.js';
const f=Math.fround,rad=x=>f(f(x)*f(Math.PI/180)),tan=x=>f(Math.tan(f(x)));
export const nativeCameraPresets={classic:[48,48,5,50,-350,1],balanced:[30,40,0,30,-350,1],topdown:[0,10,0,0,-350,1],playfield:[0,10,0,75,-350,1.08]};
export function fitNativeCamera(vertices,aspect,inclination,fov,z,layback){
 const inc=rad(inclination),si=f(Math.sin(inc)),co=f(Math.cos(inc)),sy=tan(f(rad(fov)*.5)),sx=f(sy*f(aspect)),lb=identity();lb[9]=-tan(f(rad(layback)*.5));let xmax=-Infinity,xmin=Infinity,ymax=-Infinity,ymin=Infinity;
 for(const point of vertices){const v=transform(lb,point),y=f(f(co*v[1])-f(si*v[2])),vz=f(f(si*v[1])+f(co*v[2]));xmax=Math.max(xmax,f(v[0]+f(sx*vz)));xmin=Math.min(xmin,f(v[0]-f(sx*vz)));ymax=Math.max(ymax,f(y+f(sy*vz)));ymin=Math.min(ymin,f(y-f(sy*vz)));}
 return [f(f(xmax+xmin)*.5),f(f(ymax+ymin)*.5),f(Math.max(f(f(xmax-xmin)/f(sx*2)),f(f(ymax-ymin)/f(sy*2)))+f(z))];
}
export function computeNativeCamera(inputs,aspect,preset='balanced'){
 const [inclination,fov,layback,y,z,sceneScale]=nativeCameraPresets[preset],{bounds,legacy}=inputs,inc=rad(inclination),fit=fitNativeCamera(legacy,aspect,inclination,fov,z,layback),lb=identity();lb[9]=-tan(f(rad(layback)*.5));
 const pos=transform(rotate('x',-inc),[-fit[0],f(f(y)-fit[1]),-fit[2]]),view=chain(translate(...pos),rotate('x',inc)),coords=scale(sceneScale,-sceneScale,-1),clip=chain(lb,view,coords),cm=x=>f(f(x)*f(50/(2.54*1.0625))),planes=[];
 for(const matrix of [clip,chain(scale(1,1,-1),clip)]){let near=Infinity,far=-Infinity;for(const p of bounds){const depth=transform(matrix,p)[2];if(depth>0){near=Math.min(near,depth);far=Math.max(far,depth);}}near=Math.max(f(near*f(.9)),cm(5));far=Math.max(f(near+1),Math.min(f(far*f(1.1)),cm(100000)));planes.push([near,far]);}
 const near=Math.min(...planes.map(p=>p[0])),far=Math.max(...planes.map(p=>p[1])),ys=f(near*tan(f(rad(fov)*.5))),xs=f(ys*f(aspect)),iv=inverse(view);let projection=chain(iv,identity(),view,coords,perspective(-xs,xs,-ys,ys,near,far),identity());if(Math.abs(layback)>.1)projection=chain(iv,lb,view,projection);
 return {view,projection,fit,near,far,aspect,preset};
}
