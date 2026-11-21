// SPDX-License-Identifier: GPL-3.0-or-later
// Nonlegacy drop-target hit plane from Visual Pinball parts/hittarget.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {ContactMesh} from './mesh-contact.js';
import {nativeTargetMesh} from './native-target.js';
const vertices=[
  [-.3,.001737,-.160074],[-.3,.001738,.439926],[.3,.001738,.439926],[.3,.001737,-.160074],
  [-.5,.001738,.439926],[-.5,.001738,1.789926],[.5,.001738,1.789926],[.5,.001738,.439926],
  [-.535355,.001738,.454570],[-.535355,.001738,1.775281],[-.55,.001738,.489926],[-.55,.001738,1.739926],
  [.535355,.001738,.454570],[.535355,.001738,1.775281],[.55,.001738,.489926],[.55,.001738,1.739926],
];
const indices=[0,1,2,2,3,0,1,4,5,6,7,2,5,6,1,2,1,6,4,8,9,9,5,4,8,10,11,11,9,8,6,12,7,12,6,13,12,13,14,13,15,14];
export function dropTargetFront(spec,bodyMesh){
  const offset=spec.target_type==='drop_target_beveled'?.25:spec.target_type==='drop_target_flat_simple'?.13:.18;
  // VPX shares edge IDs between the render mesh and its added hit plane.
  return new ContactMesh(nativeTargetMesh(spec,vertices,indices,offset),{preserveNormals:true,edgeKeys:bodyMesh.edgeKeys});
}
