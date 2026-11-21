// SPDX-License-Identifier: GPL-3.0-or-later
// Native contact behavior adapted from Visual Pinball contributors' GPLv3+
// physics/hitflipper.cpp at 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt for source and license details.
// Analytic side contacts for the native tapered flipper profile. The ball is
// tested against the two tangent faces and the exposed base/tip circle arcs.
import {nativeFlipperHit,collideNativeFlipper,supportNativeFlipper} from './native-flipper-contact.js';
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const plus=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function flipperContact(position,f,angle,radius){
  if(position.z+radius*.5<0||position.z-radius*.5>f.height)return null;
  const c=Math.cos(angle),s=Math.sin(angle),dx=position.x-f.p.x,dy=position.y-f.p.y;
  const x=dx*c+dy*s,y=-dx*s+dy*c,ratio=(f.baseRadius-f.endRadius)/f.length,cos=Math.sqrt(1-ratio*ratio);
  const points=[];
  for(const sign of [-1,1]){
    const ax=f.baseRadius*ratio,ay=sign*f.baseRadius*cos,bx=f.length+f.endRadius*ratio,by=sign*f.endRadius*cos;
    const t=clamp(((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2),0,1);
    points.push({x:ax+t*(bx-ax),y:ay+t*(by-ay)});
  }
  for(const [center,r,base]of [[0,f.baseRadius,true],[f.length,f.endRadius,false]]){
    const a=x-center,d=Math.hypot(a,y)||1;
    if(base?a/d<=ratio:a/d>=ratio)points.push({x:center+r*a/d,y:r*y/d});
  }
  const q=points.reduce((a,b)=>(x-a.x)**2+(y-a.y)**2<(x-b.x)**2+(y-b.y)**2?a:b);
  const inside=x<f.baseRadius*ratio?Math.hypot(x,y)<f.baseRadius:x>f.length+f.endRadius*ratio?Math.hypot(x-f.length,y)<f.endRadius:Math.abs(y)<(f.baseRadius-ratio*x)/cos;
  const d=Math.hypot(x-q.x,y-q.y),sign=inside?-1:1;
  const nx=sign*(x-q.x)/(d||1),ny=sign*(y-q.y)/(d||1);
  return {gap:sign*d-radius,normal:{x:nx*c-ny*s,y:nx*s+ny*c,z:0},point:{x:f.p.x+q.x*c-q.y*s,y:f.p.y+q.x*s+q.y*c,z:position.z}};
}
export function flipperHit(body,f,angle,omega,radius,duration){
  const p=body.translation(),v=body.linvel();
  const reach=f.length+f.endRadius+radius,x2=p.x+v.x*duration,y2=p.y+v.y*duration,z2=p.z+v.z*duration;
  if(Math.min(p.x,x2)>f.p.x+reach||Math.max(p.x,x2)<f.p.x-reach||Math.min(p.y,y2)>f.p.y+reach||Math.max(p.y,y2)<f.p.y-reach||Math.min(p.z,z2)-radius*.5>f.height||Math.max(p.z,z2)+radius*.5<0)return null;
  if(f.nativeMotion)return nativeFlipperHit(body,f,radius,duration);
  const at=t=>flipperContact({x:p.x+v.x*t,y:p.y+v.y*t,z:p.z+v.z*t},f,angle+omega*t,radius);
  // Native classifies the solved contact, including a future TOI. Slow
  // approaches use the persistent-contact response rather than a bounce.
  const classify=(time,profile)=>{
    if(!profile)return null;
    const position={x:p.x+v.x*time,y:p.y+v.y*time,z:p.z+v.z*time};
    const r=minus(minus(position,scale(profile.normal,radius)),{...f.p,z:position.z}),fv={x:-omega*r.y,y:omega*r.x,z:0};
    const vn=dot(minus(v,fv),profile.normal);
    if(Math.abs(vn)<=.099&&profile.gap<=.0005)return {time,contact:true,profile,vn};
    return vn<-.0001?{time}:null;
  };
  const start=at(0);if(!start)return null;
  if(start.gap<=.0005)return classify(0,start);
  const end=at(duration);if(!end||end.gap>0)return null;
  // VPX accepts the modified false-position solution within .01 VPU. Using
  // a different root tolerance changes the contact angle and later impacts.
  let low=0,high=duration,d0=start.gap,d1=end.gap,previous=d1,time=duration;
  for(let i=0;i<20;i++){
    time=low-d0*(high-low)/(d1-d0);
    const profile=at(time);if(!profile)return null;const gap=profile.gap;
    if(Math.abs(gap)<=.0001)return classify(time,profile);
    if(gap*d0<=0){high=time;d1=gap;if(previous*gap>0)d0*=.5;}
    else{low=time;d0=gap;if(previous*gap>0)d1*=.5;}
    previous=gap;
  }
  return classify(time,at(time));
}
export function resolveFlipperContact(body,f,contact,material,radius,clock,emit){
  if(body.native&&f.nativeMotion)return collideNativeFlipper(body,f,contact,material,radius,clock,emit);
  const flipperBody=f.nativeMotion?.body??f.body;
  const n=contact.normal,p=body.translation(),mass=body.mass(),ballI=.4*mass*radius*radius;
  const rB=scale(n,-radius),hit=plus(p,rB),rF=minus(hit,{...f.p,z:p.z}),lever=cross(rF,n).z;
  const omega=flipperBody.angvel().z;
  const relative=minus(plus(body.linvel(),cross(body.angvel(),rB)),{x:-omega*rF.y,y:omega*rF.x,z:0});
  const vn=dot(relative,n);
  if(contact.gap<-1e-6)body.setTranslation(plus(p,scale(n,Math.min(.05,-contact.gap*.9875))),true);
  if(vn>=-.0001)return false;
  let response=lever*lever/f.inertia,responseScale=1;
  if(f.contactTorque&&f.contactTorque*(-lever)>=0){response=0;responseScale=.5;}
  const elasticity=material.elasticity/(1+material.elasticity_falloff*Math.abs(vn)/18.53);
  let impulse=-(1+elasticity)*vn/(1/mass+response);
  let angular=-impulse*lever*responseScale;
  if(f.contactTorque&&angular*f.contactTorque<0&&(Math.abs(angular/f.contactTorque)<=.005||vn+impulse/mass>0)){
    impulse=-(1+elasticity)*vn*mass;angular=0;
  }
  body.applyImpulse(scale(n,impulse),true);flipperBody.applyTorqueImpulse({x:0,y:0,z:angular},true);
  const tangent=minus(relative,scale(n,vn)),length=Math.hypot(tangent.x,tangent.y,tangent.z);
  if(length>.000001){
    const t=scale(tangent,1/length),a=cross(rB,t),b=cross(rF,t);
    const inverse=1/mass+dot(a,a)/ballI+dot(b,b)/f.inertia;
    const friction=clamp(-dot(relative,t)/inverse,-material.friction*impulse,material.friction*impulse);
    body.applyImpulse(scale(t,friction),true);body.applyTorqueImpulse(scale(a,friction),true);
    flipperBody.applyTorqueImpulse({x:0,y:0,z:-b.z*friction},true);
  }
  return true;
}
export function supportFlipper(body,f,hit,gravity,friction,radius,duration){
  if(body.native&&f.nativeMotion)return supportNativeFlipper(body,f,hit,gravity,friction,radius,duration);
  const flipperBody=f.nativeMotion?.body??f.body;
  const n=hit.profile.normal,p=body.translation(),mass=body.mass(),ballI=.4*mass*radius*radius;
  if(hit.profile.gap<0)body.applyImpulse(scale(n,.1*mass),true);
  const rB=scale(n,-radius),rF=minus(plus(p,rB),{...f.p,z:p.z}),omega=flipperBody.angvel().z;
  const vrel=minus(plus(body.linvel(),cross(body.angvel(),rB)),{x:-omega*rF.y,y:omega*rF.x,z:0}),vn=dot(vrel,n);
  if(vn>.099)return;
  const w=body.angvel(),aB=plus(gravity,cross(w,cross(w,rB)));
  const aF={x:-f.angularAcceleration*rF.y-omega*omega*rF.x,y:f.angularAcceleration*rF.x-omega*omega*rF.y,z:0};
  const arel=minus(aB,aF),dn={x:-omega*n.y,y:omega*n.x,z:0},normalAcc=dot(arel,n)+2*dot(dn,vrel);
  if(normalAcc>=0)return;
  const lever=cross(rF,n),force=-normalAcc/(1/mass+dot(lever,lever)/f.inertia);
  body.applyImpulse(scale(n,force*duration-hit.vn*mass),true);
  flipperBody.applyTorqueImpulse({x:0,y:0,z:-force*duration*lever.z},true);
  const slip=minus(vrel,scale(n,vn)),speed=Math.hypot(slip.x,slip.y,slip.z);
  let t,numerator,sign=1;
  if(speed<.01){
    const acceleration=minus(arel,scale(n,dot(arel,n))),length=Math.hypot(acceleration.x,acceleration.y,acceleration.z);
    if(length*length<.01)return;
    t=scale(acceleration,1/length);numerator=-dot(t,arel)*.01;sign=-1;
  }else{t=scale(slip,1/speed);numerator=-dot(t,vrel);}
  const b=cross(rB,t),a=cross(rF,t),denominator=1/mass+dot(b,b)/ballI+sign*dot(a,a)/f.inertia;
  const impulse=clamp(numerator/denominator,-force*friction*.01,force*friction*.01)*duration/.01;
  body.applyImpulse(scale(t,impulse),true);body.applyTorqueImpulse(scale(b,impulse),true);
  flipperBody.applyTorqueImpulse({x:0,y:0,z:-impulse*a.z},true);
}
