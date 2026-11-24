// SPDX-License-Identifier: GPL-3.0-or-later
// Flipper::Render / Primitive::RecalculateMatrices, VPX 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {flipperSin,flipperCos} from './flipper-float-math.js';
const f=Math.fround;
export function nativeFlipperWorld(spec,angle,top=false,result=new Float32Array(16)){
  const c=flipperCos(angle),s=flipperSin(angle),p=top?spec.position:spec.center,size=top?spec.size:{x:1,y:1,z:1};
  result.set([f(c*f(size.x)),f(s*f(size.x)),0,0,f(-s*f(size.y)),f(c*f(size.y)),0,0,0,0,f(size.z),0,f(p.x),f(p.y),top?f(p.z):0,1]);return result;
}
