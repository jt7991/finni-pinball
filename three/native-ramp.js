// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' Ramp::GetRampVertex/PhysicSetup/CheckJoint,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {nativeDragCurve} from './native-curve.js';
import {f,add,sub,mul,div,dot,cross,length,unit,nativeNormal} from './native-vector.js';
import {ContactMesh} from './mesh-contact.js';
const world=p=>({x:p.x*.01,y:(2115-p.y)*.01,z:(p.z??0)*.01});
const xyLength=(a,b)=>length({x:f(a.x-b.x),y:f(a.y-b.y),z:0});
export function nativeRampSurface(item){
  const center=nativeDragCurve(item.drag_points,false,400),count=center.length,right=[],left=[],vertices=[],indices=[],heights=[];
  let total=0,distance=0;for(let i=1;i<count;i++)total=f(total+xyLength(center[i-1],center[i]));
  for(let i=0;i<count;i++){
    const previous=center[Math.max(0,i-1)],p=center[i],next=center[Math.min(count-1,i+1)];
    const a={x:f(previous.y-p.y),y:f(p.x-previous.x),z:0},b={x:f(p.y-next.y),y:f(next.x-p.x),z:0};let normal;
    if(i===0)normal=unit(b);else if(i===count-1)normal=unit(a);
    else{
      const n1=unit(a),n2=unit(b);
      if(Math.abs(f(n1.x-n2.x))<f(.0001)&&Math.abs(f(n1.y-n2.y))<f(.0001))normal=n1;
      else{
        const A=a.x,B=a.y,C=f(f(A*f(n1.x-previous.x))+f(B*f(n1.y-previous.y))),D=f(next.y-p.y),E=f(p.x-next.x),F=f(f(D*f(n2.x-next.x))+f(E*f(n2.y-next.y))),det=f(f(A*E)-f(B*D)),inverse=det!==0?f(1/det):0;
        const x=f(f(f(B*F)-f(E*C))*inverse),y=f(f(f(C*D)-f(A*F))*inverse);normal={x:f(p.x-x),y:f(p.y-y),z:0};
      }
    }
    distance=f(distance+xyLength(previous,p));const t=f(distance/total);
    let width=f(f(t*f(f(item.width_top)-f(item.width_bottom)))+f(item.width_bottom));
    if(item.ramp_type==='one_wire')width=f(item.wire_diameter);else if(item.ramp_type!=='flat')width=f(f(item.wire_distance_x)+20);
    const z=f(f(p.z+f(t*f(f(item.height_top)-f(item.height_bottom))))+f(item.height_bottom)),offset=mul(normal,f(width*.5));
    right.push({...add(p,offset),z});left.push({...sub(p,offset),z});heights.push(z);
    for(const q of [right[i],left[i]]){const w=world(q);vertices.push(w.x,w.y,w.z);}
    if(i){const a=(i-1)*2;indices.push(a+1,a,a+3,a+3,a,a+2);}
  }
  return {vertices,indices,edges:[right.map(world),left.map(world)],native:{center,right,left,heights}};
}
export function rampWallHeights(item){
  return ({one_wire:[31,31],two_wire:[31,31],four_wire:[62,62],three_wire_right:[62,18.5],three_wire_left:[18.5,62]})[item.ramp_type]??[item.right_wall_height,item.left_wall_height];
}
export function nativeRampContacts(surface,item){
  const mesh=new ContactMesh({vertices:[],indices:[]}),{right,left,heights}=surface.native,count=right.length,[rightHeight,leftHeight]=rampWallHeights(item);
  const vertical=(p,low,high)=>mesh.addVertical(world(p),low*.01,high*.01);
  const wall=(a,b,joint,h1,h2,height)=>{
    if(f(h2-h1)>50){const middle=mul(add(a,b),.5),h=f(f(h1+h2)*.5);wall(a,middle,joint,h1,h,height);wall(middle,b,true,h,h2,height);}
    else{const high=f(h2+f(height));mesh.addWall(world(a),world(b),h1*.01,high*.01);if(joint)vertical(a,h1,high);}
  };
  if(rightHeight>0)for(let i=0;i<count-1;i++){
    const a=right[i],b=right[i+1];wall(a,b,i>0,heights[i],heights[i+1],rightHeight);wall(b,a,i<count-2,heights[i],heights[i+1],rightHeight);
    if(i===0)vertical(a,heights[0],f(heights[0]+rightHeight));if(i===count-2)vertical(b,heights[count-1],f(heights[count-1]+rightHeight));
  }
  if(leftHeight>0)for(let i=0;i<count-1;i++){
    const j=count-i-1,a=left[j],b=left[j-1];wall(a,b,i>0,heights[j-1],heights[j],leftHeight);wall(b,a,i<count-2,heights[j-1],heights[j],leftHeight);
    if(i===0)vertical(a,heights[count-1],f(heights[count-1]+leftHeight));if(i===count-2)vertical(b,heights[0],f(heights[0]+leftHeight));
  }
  const edge=(a,b)=>mesh.addEdge(world(a),world(b));
  const triangle=points=>{
    const ab=sub(points[1],points[0]),ac=sub(points[2],points[0]),raw=cross(ac,ab),ls=dot(raw,raw);if(ls<f(.01))return null;
    const n=div(raw,f(Math.sqrt(ls))),w=points.map(world),worldAb=sub(w[1],w[0]),worldAc=sub(w[2],w[0]);
    mesh.insert({kind:'triangle',points:w,a:w[0],ab:worldAb,ac:worldAc,n:nativeNormal(n),native:{kind:'triangle',points,a:points[0],ab,ac,n}});
    return {points,n};
  };
  let previous=null;const check=next=>{if(!next)return;if(!previous||dot(cross(previous.n,next.n),cross(previous.n,next.n))>=f(1e-8))edge(next.points[0],next.points[1]);previous=next;};
  for(let i=0;i<count-1;i++){
    if(i===0)edge(left[i],right[i]);edge(left[i],left[i+1]);check(triangle([left[i],right[i],left[i+1]]));
    edge(right[i],right[i+1]);check(triangle([left[i+1],right[i],right[i+1]]));
  }
  if(count>=2)edge(right[count-1],left[count-1]);
  for(let i=0;i<count-1;i++){triangle([right[i],left[i],left[i+1]]);triangle([left[i+1],right[i+1],right[i]]);}
  return mesh;
}
