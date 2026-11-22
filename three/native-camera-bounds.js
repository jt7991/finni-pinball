// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball ViewSetup legacy mode and part bounding vertices,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. Inputs come from the authored VPX.
import {nativeDragCurve} from './native-curve.js';
import {nativeRampSurface} from './native-ramp.js';
import {nativeChain as chain,nativeTranslate as translate,nativeScale as scale,nativeRotate as rotate,nativeTransform as transform} from './native-matrix.js';
const f=Math.fround,rad=x=>f(f(x)*f(Math.PI/180)),tan=x=>f(Math.tan(f(x)));
const corners=(lo,hi)=>Array.from({length:8},(_,i)=>[0,1,2].map(j=>(i&(1<<j))?lo[j]:hi[j]));
function rubberBounds(item){
 const center=nativeDragCurve(item.drag_points,true,4,2),count=center.length,ribbon=new Array((count+1)*2),unit=v=>{const d=f(Math.sqrt(f(f(v[0]*v[0])+f(v[1]*v[1]))));return v.map(x=>f(x/d));};
 for(let i=0;i<count;i++){
  const a=center[(i+count-1)%count],p=center[i],b=center[(i+1)%count],v1=[f(a.y-p.y),f(p.x-a.x)],v2=[f(p.y-b.y),f(b.x-p.x)],n1=unit(v1),n2=unit(v2);let n;
  if(count===2)n=i===0?n2:n1;
  else if(Math.abs(f(n1[0]-n2[0]))<f(.0001)&&Math.abs(f(n1[1]-n2[1]))<f(.0001))n=n1;
  else{const [A,B]=v1,C=f(f(A*f(n1[0]-a.x))+f(B*f(n1[1]-a.y))),D=f(b.y-p.y),E=f(p.x-b.x),F=f(f(D*f(n2[0]-b.x))+f(E*f(n2[1]-b.y))),det=f(f(A*E)-f(B*D)),inv=det===0?0:f(1/det);n=[f(p.x-f(f(f(B*F)-f(E*C))*inv)),f(p.y-f(f(f(C*D)-f(A*F))*inv))];}
  const half=f(item.thickness*.5),z=f(f(item.height)+50),offset=n.map(x=>f(x*half));ribbon[i]=[f(p.x+offset[0]),f(p.y+offset[1]),z];ribbon[(count+1)*2-i-1]=[f(p.x-offset[0]),f(p.y-offset[1]),z];
  if(i===0){ribbon[count]=ribbon[0];ribbon[count+1]=ribbon[(count+1)*2-1];}
 }
 const points=[];for(let i=0;i<count;i++)points.push(ribbon[i],ribbon[count*2-i-1]);return box(points);
}
const box=points=>corners([0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),[0,1,2].map(j=>Math.max(...points.map(p=>p[j]))));
export function nativeCameraBounds(inputs){
 const bounds=[],legacy=[],byPart=[];
 for(const item of inputs.parts){let points;
  if(item.kind==='Wall')points=corners([f(inputs.table.left),f(inputs.table.top),f(item.height_bottom)],[f(inputs.table.right),f(inputs.table.bottom),f(item.height_top)]);
  else if(item.kind==='Ramp'){const s=nativeRampSurface(item).native;points=box([...s.right,...s.left].map(p=>[p.x,p.y,f(p.z+50)]));}
  else if(item.kind==='Rubber')points=rubberBounds(item);
  else if(item.kind==='Primitive'&&item.is_visible&&item.use_3d_mesh){const r=item.rot_and_tra,p=item.position,s=item.size,rt=chain(translate(...r.slice(3,6)),...[[2,'z'],[1,'y'],[0,'x'],[8,'z'],[7,'y'],[6,'x']].map(([i,axis])=>rotate(axis,rad(r[i])))),m=chain(scale(s.x,s.y,s.z),rt,translate(p.x,p.y,p.z)),[a,b]=item.local_bounds.map(v=>transform(m,v));points=corners(a,b);}
  if(!points)continue;const visible=item.is_visible??true;if(visible)bounds.push(...points);if(item.kind!=='Primitive')legacy.push(...points);byPart.push({name:item.name,kind:item.kind,visible,points});
 }
 return {bounds,legacy,byPart};
}
