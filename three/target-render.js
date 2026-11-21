// SPDX-License-Identifier: GPL-3.0-or-later
// HitTarget::UpdateTarget transform, Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {Vector3} from 'three';

export const TARGET_SCALE=.00053975;
const f=Math.fround,DEGREES=f(Math.PI/180);

// The GLB uses (native X, native Z, native Y). Swapping Y/Z reverses
// handedness, so native RotateX(offset)*RotateZ(rotZ) uses a negative
// rotation around the already-baked target's rotated X axis.
export function targetAnimationAxis(rotZ){
  const angle=f(f(rotZ??0)*DEGREES);
  return new Vector3(f(Math.cos(angle)),0,f(Math.sin(angle))).normalize();
}

export function applyTargetAnimation(object,motion,rest,axis){
  object.position.copy(rest.position);object.quaternion.copy(rest.quaternion);
  if(motion.drop)object.position.y+=motion.offset*TARGET_SCALE;
  else object.quaternion.setFromAxisAngle(axis,-f(f(motion.offset)*DEGREES)).multiply(rest.quaternion);
}
