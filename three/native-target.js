// SPDX-License-Identifier: GPL-3.0-or-later
// HitTarget::TransformVertices/PhysicSetup, Visual Pinball contributors,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {f} from './native-vector.js';
export function nativeTargetMesh(spec,vertices,indices,offset=0){
  const a=f(f(spec.rot_z??0)*f(Math.PI/180)),s=f(Math.sin(a)),c=f(Math.cos(a)),size=spec.size,p=spec.position;
  const world=vertices.flatMap(v=>{
    const x=f(f(v[0])*f(size.x)),y=f(f(f(v[1])+f(offset))*f(size.y)),z=f(f(v[2])*f(size.z));
    const tx=f(f(f(c*x)+f(-s*y))+f(p.x)),ty=f(f(f(s*x)+f(c*y))+f(p.y)),tz=f(z+f(p.z));
    return [tx*.01,(2115-ty)*.01,tz*.01];
  });
  const faces=[];for(let i=0;i<indices.length;i+=3)faces.push(indices[i],indices[i+2],indices[i+1]);
  return {vertices:world,indices:faces,native_edges:true};
}
