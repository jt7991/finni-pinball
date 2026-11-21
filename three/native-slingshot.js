// SPDX-License-Identifier: GPL-3.0-or-later
// LineSegSlingshot::Collide, Visual Pinball contributors, collideex.cpp at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {f,sub,mul,dot,nativeNormal} from './native-vector.js';
import {collideNativeSurface} from './native-ball-response.js';

export function collideNativeSlingshot(body,hit,shape,sling,material,radius,random,emit){
  const native=body.native,n=nativeNormal(hit.normal),ball=native.snapshot(),threshold=dot(ball.v,n)<=-f(sling.threshold);
  if(!sling.disabled&&threshold){
    const a={x:f(shape.points[0].x*100),y:f(2115-shape.points[0].y*100)},b={x:f(shape.points[1].x*100),y:f(2115-shape.points[1].y*100)};
    const length=f(f(f(b.x-a.x)*n.y)-f(f(b.y-a.y)*n.x)),point=sub(ball.p,mul(n,f(radius*100))),distance=f(f(f(point.x-a.x)*n.y)-f(f(point.y-a.y)*n.x));
    let force=Math.abs(length)>1e-6?f(f(f(distance+distance)/length)-1):-1;
    force=f(f(f(.5)*f(1-f(force*force)))*f(sling.force));
    ball.v=sub(ball.v,mul(n,force));native.commit(ball);
  }
  collideNativeSurface(body,hit,material,radius,random);
  if(!sling.disabled&&threshold){
    const position=native.sync(),distance=dot(sub(native.eventPosition,position),sub(native.eventPosition,position));
    native.eventPosition={...position};
    // Native always stores the position here, without resetting the generic
    // Hit event travel accumulator. Only a sufficiently different spot fires.
    if(distance>f(.25)){emit();return true;}
  }
  return false;
}
