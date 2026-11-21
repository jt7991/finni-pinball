// SPDX-License-Identifier: GPL-3.0-or-later
// Adapted from Visual Pinball contributors' hitball.cpp/collideex.cpp at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
// Positions/radii are .01 VPU; velocities retain VPX's VPU/10ms numeric scale.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function playfieldHit(body,radius,duration){
  const gap=body.translation().z-radius,vz=body.linvel().z;
  if(vz>.099||gap< -2*radius)return null;
  if(Math.abs(vz)<=.099)return Math.abs(gap)<=.0005?{contact:true,gap,vz}:null;
  const time=Math.max(0,gap/-vz);
  return time<=duration?{time,gap,vz}:null;
}
function friction(body,gravity,coefficient,duration){
  const v=body.linvel(),w=body.angvel(),r=body.collider(0).radius(),mass=body.mass();
  const sx=v.x-r*w.y,sy=v.y+r*w.x,speed=Math.hypot(sx,sy);
  let x,y,numerator;
  if(v.z<=.025||speed<.01){
    // Native static friction uses surface acceleration, including centripetal
    // acceleration. Its force accumulator uses the historical 10ms time unit.
    const ax=gravity.x-r*w.x*w.z,ay=gravity.y-r*w.y*w.z,a=Math.hypot(ax,ay);
    if(a*a<.01)return;
    x=ax/a;y=ay/a;numerator=-a*.01;
  }else{x=sx/speed;y=sy/speed;numerator=-speed;}
  const force=clamp(numerator*mass/3.5,-coefficient*mass*-gravity.z*.01,coefficient*mass*-gravity.z*.01);
  const impulse=force*duration/.01;
  body.applyImpulse({x:x*impulse,y:y*impulse,z:0},true);
  body.applyTorqueImpulse({x:r*y*impulse,y:-r*x*impulse,z:0},true);
}
export function supportPlayfield(body,hit,gravity,material,duration){
  const v=body.linvel();if(v.z>.099)return;
  body.setLinvel({...v,z:v.z+Math.max(0,-(gravity.z*duration+hit.vz))},true);
  friction(body,gravity,material.friction,duration);
}
export function collidePlayfield(body,hit,material,radius,random=Math.random){
  let v=body.linvel(),vz=v.z;
  if(vz>=-.0001){if(vz>.0001||hit.gap>=0)return;vz=-.05;}
  const p=body.translation(),correction=Math.min(.05,-hit.gap*.9875);
  if(correction>.000001)body.setTranslation({...p,z:p.z+correction},true);
  const e=material.elasticity/(1+material.elasticity_falloff*Math.abs(vz)/18.53),delta=-(1+e)*vz;
  body.setLinvel({...v,z:v.z+delta},true);
  const w=body.angvel(),sx=v.x-radius*w.y,sy=v.y+radius*w.x,speed=Math.hypot(sx,sy);
  if(speed>.001){
    const impulse=clamp(-speed*body.mass()/3.5,-material.friction*body.mass()*Math.abs(vz),material.friction*body.mass()*Math.abs(vz));
    const x=sx/speed,y=sy/speed;
    body.applyImpulse({x:x*impulse,y:y*impulse,z:0},true);
    body.applyTorqueImpulse({x:radius*y*impulse,y:-radius*x*impulse,z:0},true);
  }
  const scatter=(material.scatter<0?material.default_scatter:material.scatter)*material.difficulty;
  if(delta>1&&scatter>1e-5){
    const sample=random()*2-1,angle=sample*(1-sample*sample)*2.59808*scatter*Math.PI/180;
    v=body.linvel();const c=Math.cos(angle),s=Math.sin(angle);
    // VPX's positive rotation is reflected by our reversed playfield Y axis.
    body.setLinvel({x:v.x*c+v.y*s,y:v.y*c-v.x*s,z:v.z},true);
  }
  const q=body.translation();if(q.z<radius)body.setTranslation({...q,z:radius},true);
}
