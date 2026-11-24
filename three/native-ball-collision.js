// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' HitBall::HitTest/Collide, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {f,add,sub,mul,dot,unit} from './native-vector.js';

// Rapier 0.21 Coarena indexes the low word of its opaque f64 handle. The
// generation distinguishes lifetimes; the slot supplies allocation order.
const handleValue=new Float64Array(1),handleWords=new Uint32Array(handleValue.buffer);
export function nativeBallStorageOrder(handle){handleValue[0]=handle;return handleWords[0];}

export function nativeBallHit(query,other,radius,duration){
  const d=sub(other.p,query.p),dv=sub(other.v,query.v),squared=dot(d,d),distance=f(Math.sqrt(squared));
  const b=dot(dv,d),vn=f(b/distance);if(vn>f(.0001))return null;
  const total=f(query.r+f(radius*100)),gap=f(distance-total);let time;
  if(gap<=f(.05)){
    if(gap<f(-2*query.r))return null;
    time=Math.abs(vn)>f(.099)||gap<=f(-.05)?0:f(f(gap*10)+f(.5));
  }else{
    const a=dot(dv,dv);if(a<f(1e-8))return null;
    const bb=f(2*b),c=f(squared-f(total*total)),discriminant=f(f(bb*bb)-f(f(4*a)*c));if(discriminant<0)return null;
    const root=f(Math.sqrt(discriminant)),inverse=f(-.5/a),t1=f(f(bb+root)*inverse),t2=f(f(bb-root)*inverse);
    time=f(t1*t2)<0?Math.max(t1,t2):Math.min(t1,t2);
  }
  if(!Number.isFinite(time)||time<0||Object.is(time,-0)||time>f(duration*100))return null;
  // Preserve the pinned native relative-velocity expression for oblique hits.
  const normal=sub(add(query.p,mul(dv,time)),other.p);
  if(Math.abs(normal.x)<=1.1754943508222875e-38&&Math.abs(normal.y)<=1.1754943508222875e-38&&Math.abs(normal.z)<=1.1754943508222875e-38)return null;
  const n=unit(normal);return {time:time*.01,gap:gap*.01,vn,normal:{x:n.x,y:-n.y,z:n.z},contact:false};
}

export function collideNativeBalls(ball,other,hit,locked,swapped,emit){
  // Native pointer order selects one reciprocal event. Use the current body
  // storage slot, which can be reused, rather than a ball's creation age.
  if(!locked&&(swapped?ball.order>=other.order:ball.order<=other.order))return false;
  let a=ball.snapshot(),b=other.snapshot();const n={x:f(hit.normal.x),y:f(-hit.normal.y),z:f(hit.normal.z)},gap=f(hit.gap*100);
  let normalSpeed=dot(sub(a.v,b.v),n);
  if(normalSpeed>=-f(.0001)){
    if(normalSpeed>f(.0001)||gap>=0)return false;
    normalSpeed=-f(.05);
  }
  if(normalSpeed< -f(.25)){
    emit?.(-normalSpeed);a=ball.snapshot();b=other.snapshot();
  }
  let correction=f(-f(.9875)*gap);
  if(correction>f(.0001)){correction=Math.min(correction,5);if(!locked)correction=f(correction*.5);a.p=add(a.p,mul(n,correction));}
  correction=f(-f(.9875)*f(other.collisionGap??0));
  if(!locked&&correction>f(.0001)){correction=f(Math.min(correction,5)*.5);b.p=sub(b.p,mul(n,correction));}
  const inverseOther=locked?0:f(1/b.mass),inverseBall=f(1/a.mass),impulse=f(f(-f(1.8)*normalSpeed)/f(inverseOther+inverseBall));
  if(!locked)b.v=sub(b.v,mul(n,f(impulse*inverseOther)));
  a.v=add(a.v,mul(n,f(impulse*inverseBall)));
  other.commit(b);ball.commit(a);return true;
}
