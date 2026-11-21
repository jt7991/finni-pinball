// SPDX-License-Identifier: GPL-3.0-or-later
// HitTarget SetupHitObject and HitTriangle/HitLine3D/HitPoint::Collide,
// Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {f,dot,nativeNormal} from './native-vector.js';
import {collideNativeSurface} from './native-ball-response.js';

export function collideNativeTarget(body,hit,shape,record,material,radius,random,emit){
  const {target,fireEvents}=record;
  const restricted=shape.kind==='triangle'||shape.kind==='polygon'||shape.kind==='edge'&&!shape.vertical;
  const velocity=body.linvel(),incoming=-dot({x:velocity.x,y:-velocity.y,z:velocity.z},nativeNormal(hit.normal));
  collideNativeSurface(body,hit,material,radius,random);
  if(!fireEvents||!(incoming>=target.threshold)||restricted&&target.dropped())return false;
  // Native arms animation before generic resting-hit suppression, but points
  // and vertical lines dispatch Hit directly without arming that animation.
  if(restricted){target.currentHitThreshold=incoming;target.animate();}
  if(!target.collider.isEnabled()||!body.native.acceptHitEvent(0))return false;
  emit();return true;
}

export function nativeTargetEvent(spec,collider,dropped,animate){
  return {name:spec.name,threshold:f(spec.threshold??2),currentHitThreshold:0,collider,dropped,animate};
}
