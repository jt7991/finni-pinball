// SPDX-License-Identifier: GPL-3.0-or-later
// BumperHitCircle::Collide, Visual Pinball contributors, collideex.cpp at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {f,add,mul,dot,nativeNormal} from './native-vector.js';
import {collideNativeSurface} from './native-ball-response.js';

export function collideNativeBumper(body,hit,bumper,material,radius,random,emit){
  const native=body.native,n=nativeNormal(hit.normal),incoming=dot(native.snapshot().v,n);
  collideNativeSurface(body,hit,material,radius,random);
  // HasHitEvent controls both the solenoid kick and the callback. The force is
  // a velocity increment, independent of ball mass, evaluated after reflection.
  if(bumper.hit_event&&incoming<=-f(bumper.threshold)){
    const ball=native.snapshot();ball.v=add(ball.v,mul(n,f(bumper.force)));native.commit(ball);
    emit();return true;
  }
  return false;
}
