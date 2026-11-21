// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' HitBall::Collide3DWall/HandleStaticContact,
// revision 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See licenses/VPX-Physics-NOTICE.txt. All calculations use native VPU/VPT.
import {f,add,sub,mul,div,dot,cross,length,unit,clamp,nativeNormal,nativeGravity,elasticityAtSpeed} from './native-vector.js';
export function collideNativeSurface(body,hit,material,radius,random){
  const state=body.native,ball=state.snapshot(),n=nativeNormal(hit.normal),gap=f(hit.gap*100);let vn=dot(ball.v,n);
  if(vn>=-f(.0001)){if(vn>f(.0001)||gap>=0)return;vn=-f(.05);}
  const correction=Math.min(5,f(-f(.9875)*gap));if(correction>f(.0001))ball.p=add(ball.p,mul(n,correction));
  const reaction=f(ball.mass*Math.abs(vn)),epsilon=elasticityAtSpeed(material.elasticity,material.elasticity_falloff,vn),delta=f(vn*-f(1+epsilon));
  ball.v=add(ball.v,mul(n,delta));
  const r=mul(n,-f(radius*100)),surface=add(ball.v,cross(div(ball.m,ball.inertia),r)),tangent=sub(surface,mul(n,dot(surface,n))),squared=dot(tangent,tangent);
  if(squared>f(1e-6)){
    const t=div(tangent,f(Math.sqrt(squared))),vt=dot(surface,t),c=cross(r,t),den=f(f(1/ball.mass)+dot(t,cross(div(c,ball.inertia),r))),maximum=f(f(material.friction)*reaction),j=clamp(f(-vt/den),-maximum,maximum);
    if(Number.isFinite(j)){ball.v=add(ball.v,div(mul(t,j),ball.mass));ball.m=add(ball.m,mul(c,j));}
  }
  const scatter=f(f((material.scatter<0?material.default_scatter:material.scatter)*Math.PI/180)*f(material.difficulty));
  if(delta>1&&scatter>f(1e-5)){
    let a=f(random()*2-1);a=f(a*f(f(f(1-f(a*a))*f(2.59808))*scatter));const sn=f(Math.sin(a)),cs=f(Math.cos(a)),v=ball.v;
    ball.v={x:f(f(v.x*cs)-f(v.y*sn)),y:f(f(v.y*cs)+f(v.x*sn)),z:v.z};
  }
  state.commit(ball);
}
export function supportNativeSurface(body,hit,gravity,material,radius,duration){
  const state=body.native,ball=state.snapshot(),n=nativeNormal(hit.normal),dt=f(duration*100),g=nativeGravity(gravity);
  if(dot(ball.v,n)>f(.099))return;
  const force=Math.max(0,-f(f(dot(mul(g,ball.mass),n)*dt)+f(hit.vn)));
  ball.v=add(ball.v,mul(n,force));
  const r=mul(n,-f(radius*100)),w=div(ball.m,ball.inertia),surface=add(ball.v,cross(w,r)),slip=sub(surface,mul(n,dot(surface,n))),speed=length(slip);
  const maximum=f(f(f(material.friction)*ball.mass)*-dot(g,n));let direction,numerator;
  if(dot(ball.v,n)<=f(.025)||speed<f(.01)){
    const acceleration=add(div(g,ball.mass),cross(w,cross(w,r))),slipAcc=sub(acceleration,mul(n,dot(acceleration,n)));
    if(dot(slipAcc,slipAcc)<f(1e-6)){state.commit(ball);return;}
    direction=unit(slipAcc);numerator=-dot(direction,acceleration);
  }else{direction=div(slip,speed);numerator=-dot(direction,surface);}
  const c=cross(r,direction),den=f(f(1/ball.mass)+dot(direction,cross(div(c,ball.inertia),r))),friction=clamp(f(numerator/den),-maximum,maximum),j=f(dt*friction);
  if(Number.isFinite(j)){ball.v=add(ball.v,div(mul(direction,j),ball.mass));ball.m=add(ball.m,mul(c,j));}
  state.commit(ball);
}
