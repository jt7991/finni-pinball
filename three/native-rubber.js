// SPDX-License-Identifier: GPL-3.0-or-later
// Rubber::GenerateMesh/UpdateRubber and GetRotatedAxis, Visual Pinball contributors,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {f,add,sub,mul,dot,cross,unit} from './native-vector.js';
import {nativeDragCurve} from './native-curve.js';
import {ContactMesh} from './mesh-contact.js';
const identity=()=>Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>Number(i===j)));
const translate=(x,y,z)=>{const m=identity();m[3]=[x,y,z,1];return m;};
const multiply=(a,b)=>a.map(row=>b[0].map((_,j)=>f(f(f(f(row[0]*b[0][j])+f(row[1]*b[1][j]))+f(row[2]*b[2][j]))+f(row[3]*b[3][j]))));
const rotate=(axis,degrees)=>{
  const a=f(f(degrees)*f(Math.PI/180)),s=f(Math.sin(a)),c=f(Math.cos(a)),m=identity(),[i,j]=({x:[1,2],y:[2,0],z:[0,1]})[axis];
  m[i][i]=m[j][j]=c;m[i][j]=s;m[j][i]=-s;return m;
};
function around(angle,axis,point){
  const u=unit(axis),a=f(f(Math.PI/180)*angle),s=f(Math.sin(a)),c=f(Math.cos(a)),t=f(1-c),{x,y,z}=u,xx=f(x*x),yy=f(y*y),zz=f(z*z),xy=f(f(x*y)*t),xz=f(f(x*z)*t),yz=f(f(y*z)*t);
  return {x:dot(point,{x:f(xx+f(c*f(1-xx))),y:f(xy-f(s*z)),z:f(xz+f(s*y))}),
    y:dot(point,{x:f(xy+f(s*z)),y:f(yy+f(c*f(1-yy))),z:f(yz-f(s*x))}),
    z:dot(point,{x:f(xz-f(s*y)),y:f(yz+f(s*x)),z:f(zz+f(c*f(1-zz)))})};
}
export function nativeRubberMesh(spec){
  const center=nativeDragCurve(spec.drag_points,true,400,2),count=center.length,height=f(spec.hit_height),points=[],indices=[];
  let previousBinormal;
  for(let i=0;i<count;i++){
    const a=center[i],b=center[(i+1)%count],tangent=sub(b,a);let normal,binormal;
    if(i===0){const up={x:f(a.x+b.x),y:f(a.y+b.y),z:f(height*2)};normal=cross(tangent,up);binormal=cross(tangent,normal);}
    else{normal=cross(previousBinormal,tangent);binormal=cross(tangent,normal);}
    previousBinormal=unit(binormal);normal=unit(normal);
    for(let j=0;j<6;j++){
      const offset=mul(around(f(j*f(360*f(1/6))),tangent,normal),f(spec.thickness*.5));
      if(j===0||j===3)offset.z=f(offset.z*f(.6));
      points.push({x:f(a.x+offset.x),y:f(a.y+offset.y),z:f(height+offset.z)});
      const q0=i*6+j,q1=i*6+(j+1)%6,q2=((i+1)%count)*6+j,q3=((i+1)%count)*6+(j+1)%6;
      // Render indices are CW; native HitTriangle receives reversed winding.
      indices.push(q0,q2,q1,q3,q1,q2);
    }
  }
  const middle=Object.fromEntries(['x','y','z'].map(k=>[k,f(f(Math.max(...points.map(p=>p[k]))+Math.min(...points.map(p=>p[k])))*.5)]));
  const rotation=multiply(multiply(rotate('z',spec.rot_z),rotate('y',spec.rot_y)),rotate('x',spec.rot_x));
  const matrix=multiply(multiply(translate(-middle.x,-middle.y,-middle.z),rotation),translate(middle.x,middle.y,height));
  const vertices=points.flatMap(p=>{
    const q=[0,1,2].map(j=>f(f(f(f(matrix[0][j]*p.x)+f(matrix[1][j]*p.y))+f(matrix[2][j]*p.z))+matrix[3][j]));
    return [q[0]*.01,(2115-q[1])*.01,q[2]*.01];
  });
  return new ContactMesh({vertices,indices},{preserveNormals:true});
}
