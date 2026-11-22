// SPDX-License-Identifier: GPL-3.0-or-later
// Flasher::RenderSetup/Render vertex generation, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See VPX-Physics-NOTICE.txt.
import {nativeDragCurve} from './native-curve.js';
import {nativeMultiply,nativeTranslate,nativeRotate,nativeTransform} from './native-matrix.js';
const f=Math.fround,rad=value=>f(f(value)*f(Math.PI/180));
export function nativeFlasherVertices(spec,{width=952,height=2115,state}={}){
 const points=nativeDragCurve(spec.drag_points,true,4,2),minx=Math.min(...points.map(p=>p.x)),maxx=Math.max(...points.map(p=>p.x)),miny=Math.min(...points.map(p=>p.y)),maxy=Math.max(...points.map(p=>p.y)),cx=f(minx+f(f(maxx-minx)*f(.5))),cy=f(miny+f(f(maxy-miny)*f(.5))),iw=f(1/f(maxx-minx)),ih=f(1/f(maxy-miny)),tw=f(1/f(width)),th=f(1/f(height));
 const rotation=nativeMultiply(nativeMultiply(nativeRotate('z',rad(state?.rotz??spec.rot_z)),nativeRotate('y',rad(state?.roty??spec.rot_y))),nativeRotate('x',rad(state?.rotx??spec.rot_x))),matrix=nativeMultiply(nativeTranslate(-cx,-cy,0),nativeMultiply(rotation,nativeTranslate(cx,cy,state?.height??spec.height))),vertices=new Float32Array(points.length*8);
 for(let i=0;i<points.length;i++){const p=points[i],position=nativeTransform(matrix,[p.x,p.y,0]),uv=spec.image_alignment==='world'?[f(p.x*tw),f(p.y*th)]:[f(f(p.x-minx)*iw),f(f(p.y-miny)*ih)];vertices.set([...position,0,0,1,...uv],i*8);}
 return vertices;
}
