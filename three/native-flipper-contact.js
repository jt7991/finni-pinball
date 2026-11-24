// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' hitflipper.cpp, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {f,add,sub,mul,div,dot,cross,length as magnitude,unit,clamp,nativeNormal,nativeGravity,elasticityAtSpeed} from './native-vector.js';
import {flipperSin,flipperCos} from './flipper-float-math.js';
const length=(x,y)=>f(Math.sqrt(f(f(x*x)+f(y*y))));
export function nativeFlipperHit(body,flipper,radius,duration){
  const p=body.translation(),v=body.linvel(),x=f(p.x*100),y=f(2115-p.y*100),z=f(p.z*100),vx=f(v.x),vy=f(-v.y),vz=f(v.z),r=f(radius*100),dt=f(duration*100);
  const cx=f(flipper.p.x*100),cy=f(2115-flipper.p.y*100),base=f(flipper.baseRadius*100),end=f(flipper.endRadius*100),len=f(flipper.length*100);
  const ratio=f(f(base-end)/len),nx=f(Math.sqrt(f(1-f(ratio*ratio)))),ny=-ratio,angle=flipper.nativeAngle,speed=-flipper.nativeMotion.speed,min=Math.min(flipper.nativeRestAngle,flipper.nativeRaisedAngle),max=Math.max(flipper.nativeRestAngle,flipper.nativeRaisedAngle);
  const solve=face=>{
    const tip=face===null,ffnx=face?-nx:nx,px=tip?0:f(base*ffnx),py=tip?-len:f(base*ny);
    let t=0,t0,t1,d0,d1,previous,gap,dx,dy,normalX,normalY,contactAngle,distance,k;
    for(k=1;k<=20;k++){
      contactAngle=Math.max(min,Math.min(max,f(angle+f(speed*t))));const sn=flipperSin(contactAngle),cs=flipperCos(contactAngle);
      normalX=f(f(ffnx*cs)-f(ny*sn));normalY=f(f(ny*cs)+f(ffnx*sn));
      const qx=f(f(f(px*cs)-f(py*sn))+cx),qy=f(f(f(py*cs)+f(px*sn))+cy);
      dx=f(f(x+f(vx*t))-qx);dy=f(f(y+f(vy*t))-qy);
      if(tip){distance=length(dx,dy);gap=f(distance-f(end+r));}else gap=f(f(f(dx*normalX)+f(dy*normalY))-r);
      if(Math.abs(gap)<=f(.01))break;
      if(k===1){if(gap< -f(r+end))return null;if(gap<=f(.05))break;t0=t1=dt;d0=0;d1=gap;}
      else if(k===2){if(f(previous*gap)>0)return null;t0=0;t1=dt;d0=previous;d1=gap;}
      else if(f(gap*d0)<=0){t1=t;d1=gap;if(f(previous*gap)>0)d0=f(d0*.5);}
      else{t0=t;d0=gap;if(f(previous*gap)>0)d1=f(d1*.5);}
      t=f(t0-f(f(d0*f(t1-t0))/f(d1-d0)));previous=gap;
    }
    if(!Number.isFinite(t)||t<0||Object.is(t,-0)||t>dt||k>20&&Math.abs(gap)>f(r*.25))return null;
    if(tip){const inv=f(1/distance);normalX=f(dx*inv);normalY=f(dy*inv);}
    else{const tx=face?-normalY:normalY,ty=face?normalX:-normalX,along=f(f(dx*tx)+f(dy*ty));if(along<0||along>f(len*nx))return null;}
    const hitZ=f(z+f(vz*t));if(f(hitZ+f(r*.5))<0||f(hitZ-f(r*.5))>f(flipper.height*100))return null;
    const rx=f(f(f(x+f(vx*t))-f(r*normalX))-cx),ry=f(f(f(y+f(vy*t))-f(r*normalY))-cy),dist=length(rx,ry),inv=f(1/dist);
    const angular=contactAngle>=max&&speed>0||contactAngle<=min&&speed<0?0:speed;
    const tx=f(-ry*inv),ty=f(rx*inv),sv=f(angular*dist);
    // VPX's tip test multiplies tangent by angular speed, then distance;
    // its face test groups speed and distance. Keep their Float32 order.
    const surfaceX=tip?f(f(tx*angular)*dist):f(tx*sv),surfaceY=tip?f(f(ty*angular)*dist):f(ty*sv);
    const dvx=f(vx-surfaceX),dvy=f(vy-surfaceY),vn=f(f(dvx*normalX)+f(dvy*normalY)),contact=Math.abs(vn)<=f(.099)&&gap<=f(.05);
    if(tip?vn>=0:!contact&&vn>f(.0001))return null;
    const normal={x:normalX,y:-normalY,z:0};
    return {time:t*.01,contact,profile:{normal,gap:gap*.01,hitMomentBit:dist===0},normal,gap:gap*.01,vn};
  };
  const first=flipper.lastHitFace??false;
  let hit=solve(first);if(hit)return hit;
  hit=solve(!first);if(hit){flipper.lastHitFace=!first;return hit;}
  hit=solve(null);if(hit)return hit;
  // The fixed base uses HitCircle's rigid, lateral test.
  const dx=f(x-cx),dy=f(y-cy),d2=f(f(dx*dx)+f(dy*dy)),distance=f(Math.sqrt(d2));if(distance<=f(1e-6))return null;
  const b=f(f(dx*vx)+f(dy*vy)),vn=f(b/distance),total=f(base+r),gap=f(distance-total);if(vn>f(.0001))return null;
  let time=0,contact=false;
  if(gap<f(.05)){if(gap< -r)return null;if(Math.abs(vn)<=f(.099))contact=true;else time=Math.max(0,f(-gap/vn));}
  else{
    const a=f(f(vx*vx)+f(vy*vy));if(a<f(1e-8))return null;
    const bb=f(2*b),c=f(d2-f(total*total)),disc=f(f(bb*bb)-f(f(4*a)*c));if(disc<0)return null;
    const root=f(Math.sqrt(disc)),inverse=f(-.5/a),t1=f(f(bb+root)*inverse),t2=f(f(bb-root)*inverse);time=f(t1*t2)<0?Math.max(t1,t2):Math.min(t1,t2);
  }
  if(!Number.isFinite(time)||time<0||Object.is(time,-0)||time>dt)return null;
  const hitZ=f(z+f(vz*time));if(f(hitZ+f(r*.5))<0||f(hitZ-f(r*.5))>f(flipper.height*100))return null;
  const hx=f(f(x+f(vx*time))-cx),hy=f(f(y+f(vy*time))-cy),inverse=f(1/length(hx,hy)),normal={x:f(hx*inverse),y:-f(hy*inverse),z:0};
  return {time:time*.01,contact,profile:{normal,gap:gap*.01,hitMomentBit:true},normal,gap:gap*.01,vn};
}
function context(body,flipper,normal,radius){
  const state=body.native,ball=state.snapshot(),n=nativeNormal(normal),rB=mul(n,-f(radius*100)),hit=add(ball.p,rB),center={x:f(flipper.p.x*100),y:f(2115-flipper.p.y*100),z:ball.p.z},rF=sub(hit,center),omega=-flipper.nativeMotion.speed;
  const relative=sub(add(ball.v,cross(div(ball.m,ball.inertia),rB)),{x:f(-omega*rF.y),y:f(omega*rF.x),z:0});
  return {state,ball,n,rB,rF,relative,omega,inertia:flipper.nativeMotion.inertia};
}
export function collideNativeFlipper(body,flipper,contact,material,radius,clock=0,emit){
  const c=context(body,flipper,contact.normal,radius),{state,ball,n,rB,rF,relative,inertia}=c;let vn=dot(n,relative);
  const gap=f(contact.gap*100);if(vn>=-f(.0001)){if(vn>f(.0001)||gap>=0)return false;vn=-f(.05);}
  const correction=Math.min(5,f(-f(.9875)*gap));if(correction>f(.0001))ball.p=add(ball.p,mul(n,correction));
  let response=cross(rF,n),scaling=1;const torque=-flipper.contactTorque;
  if(torque&&f(torque*-response.z)>=0){response={x:0,y:0,z:0};scaling=f(.5);}
  const epsilon=elasticityAtSpeed(material.elasticity,material.elasticity_falloff,vn),inverse=f(1/ball.mass);
  let impulse=f(f(-f(1+epsilon)*vn)/f(inverse+dot(n,cross(div(response,inertia),rF)))),rot=cross(rF,mul(n,-f(impulse*scaling)));
  if(torque&&f(rot.z*torque)<0){
    const recoil=f(-rot.z/torque),after=f(vn+f(impulse*inverse));
    if(recoil<=f(.5)||after>0){impulse=f(f(-f(1+epsilon)*vn)*ball.mass);rot={x:0,y:0,z:0};}
  }
  ball.v=add(ball.v,mul(n,f(impulse*inverse)));flipper.nativeMotion.nativeImpulse(rot.z);
  const tangent=sub(relative,mul(n,dot(relative,n))),squared=dot(tangent,tangent);
  if(squared>f(1e-6)){
    const t=div(tangent,f(Math.sqrt(squared))),vt=dot(relative,t),b=cross(rB,t),a=cross(rF,t);
    const den=f(f(inverse+dot(t,cross(div(b,ball.inertia),rB)))+dot(t,cross(div(a,inertia),rF))),maximum=f(f(material.friction)*impulse),j=clamp(f(-vt/den),-maximum,maximum);
    ball.v=add(ball.v,div(mul(t,j),ball.mass));ball.m=add(ball.m,mul(b,j));flipper.nativeMotion.nativeImpulse(f(-j*a.z));
  }
  state.commit(ball);
  // Native throttles the whole flipper, rather than each ball/sensor pair.
  // Every resolved impact renews its idle clock, even below event threshold.
  if(vn< -f(.25)&&clock-(flipper.lastCollisionMs??0)>250)emit?.(contact.hitMomentBit?'Hit':'Collide',contact.hitMomentBit?undefined:-vn);
  flipper.lastCollisionMs=clock;return true;
}
export function supportNativeFlipper(body,flipper,hit,gravity,friction,radius,duration){
  const {state,ball,n,rB,rF,omega,inertia,...rest}=context(body,flipper,hit.profile.normal,radius),dt=f(duration*100),g=nativeGravity(gravity);let relative=rest.relative;
  if(f(hit.profile.gap*100)<0){
    ball.v=add(ball.v,mul(n,f(.1)));
    relative=sub(add(ball.v,cross(div(ball.m,ball.inertia),rB)),{x:f(-omega*rF.y),y:f(omega*rF.x),z:0});
  }
  const vn=dot(relative,n);if(vn>f(.099)){state.commit(ball);return;}
  const w=div(ball.m,ball.inertia),aB=add(div(g,ball.mass),cross(w,cross(w,rB))),acc=f(-flipper.angularAcceleration*.0001),omega2=f(omega*omega);
  const aF=add({x:f(-acc*rF.y),y:f(acc*rF.x),z:0},{x:f(-omega2*rF.x),y:f(-omega2*rF.y),z:0}),arel=sub(aB,aF),dn={x:f(-omega*n.y),y:f(omega*n.x),z:0},normalAcc=f(dot(arel,n)+f(2*dot(dn,relative)));
  if(normalAcc>=0){state.commit(ball);return;}
  const inverse=f(1/ball.mass),lever=cross(rF,mul(n,-1)),contactAcc=dot(n,sub(mul(n,inverse),cross(div(lever,inertia),rF))),force=f(-normalAcc/contactAcc);
  ball.v=add(ball.v,mul(n,f(f(f(force*dt)*inverse)-f(hit.vn))));flipper.nativeMotion.nativeImpulse(f(f(force*dt)*lever.z));
  const slip=sub(relative,mul(n,vn)),speed=magnitude(slip),maximum=f(force*f(friction));let t,numerator,denF;
  if(speed<f(.01)){
    const slipAcc=sub(arel,mul(n,dot(arel,n)));if(dot(slipAcc,slipAcc)<f(1e-6)){state.commit(ball);return;}
    t=unit(slipAcc);numerator=-dot(t,arel);denF=dot(t,cross(div(cross(rF,t),-inertia),rF));
  }else{t=div(slip,speed);numerator=-dot(t,relative);denF=dot(t,cross(div(cross(rF,t),inertia),rF));}
  const a=cross(rF,t),b=cross(rB,t),denB=f(inverse+dot(t,cross(div(b,ball.inertia),rB))),j=f(dt*clamp(f(numerator/f(denB+denF)),-maximum,maximum));
  ball.v=add(ball.v,div(mul(t,j),ball.mass));ball.m=add(ball.m,mul(b,j));flipper.nativeMotion.nativeImpulse(f(-j*a.z));state.commit(ball);
}
