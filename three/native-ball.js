// SPDX-License-Identifier: GPL-3.0-or-later
// Native-unit position integration from Visual Pinball hitball.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export class NativeBall {
  constructor(body){
    this.rapier=body;this.position=null;this.lastWorld=null;
    this.eventPosition={x:-10000,y:-10000,z:-10000};this.eventDistance=0;
    this.body={translation:()=>this.translation(),setTranslation:(p,wake)=>this.setTranslation(p,wake),handle:body.handle};
    this.body.acceptHitEvent=()=>this.acceptHitEvent();
    this.body.advanceTrigger=()=>this.advanceTrigger();
    this.body.native=this;
    for(const method of ['linvel','setLinvel','angvel','setAngvel','mass','applyImpulse','applyTorqueImpulse','collider'])this.body[method]=(...args)=>body[method](...args);
    this.angularMomentum={x:0,y:0,z:0};this.lastAngular=null;
    this.body.angvel=()=>this.angularVelocity();
    this.body.applyTorqueImpulse=impulse=>this.angularImpulse(impulse);
    this.body.setAngvel=(velocity,wake)=>{body.setAngvel(velocity,wake);this.lastAngular=null;this.syncAngular();};
    this.sync();
  }
  sync(){
    const p=this.rapier.translation(),old=this.lastWorld;
    if(!old||p.x!==old.x||p.y!==old.y||p.z!==old.z){this.position={x:f(p.x*100),y:f(2115-p.y*100),z:f(p.z*100)};this.lastWorld=p;}
    return this.position;
  }
  translation(){const p=this.sync();return {x:p.x*.01,y:(2115-p.y)*.01,z:p.z*.01};}
  setTranslation(p,wake){this.position={x:f(p.x*100),y:f(2115-p.y*100),z:f(p.z*100)};this.publish(wake);}
  publish(wake=true){const p=this.position;this.rapier.setTranslation({x:p.x*.01,y:(2115-p.y)*.01,z:p.z*.01},wake);this.lastWorld=this.rapier.translation();}
  displace(start,v,duration){
    const dt=f(duration*100);
    const dx=f(v.x*dt),dy=f(-v.y*dt),dz=f(v.z*dt);
    this.eventDistance=f(this.eventDistance+f(f(f(dx*dx)+f(dy*dy))+f(dz*dz)));
    this.position={x:f(start.x+dx),y:f(start.y+dy),z:f(start.z+dz)};this.publish();
  }
  acceptHitEvent(){
    const p=this.sync(),last=this.eventPosition,dx=f(last.x-p.x),dy=f(last.y-p.y),dz=f(last.z-p.z);
    if(this.eventDistance<.5&&f(f(f(dx*dx)+f(dy*dy))+f(dz*dz))<=.25)return false;
    this.eventDistance=0;this.eventPosition={...p};return true;
  }
  advanceTrigger(){
    // Trigger::Collide advances the center directly, without adding physical
    // travel to the material Hit event suppression history.
    const p=this.sync(),v=this.rapier.linvel(),dt=f(.02);
    this.position={x:f(p.x+f(v.x*dt)),y:f(p.y+f(-v.y*dt)),z:f(p.z+f(v.z*dt))};this.publish();
  }
  syncAngular(){
    const w=this.rapier.angvel(),old=this.lastAngular;
    this.inertia=f(f(f(.4)*f(this.rapier.mass()))*f(25*25));
    if(!old||w.x!==old.x||w.y!==old.y||w.z!==old.z){
      this.angularMomentum={x:f(f(-w.x/100)*this.inertia),y:f(f(w.y/100)*this.inertia),z:f(f(-w.z/100)*this.inertia)};this.lastAngular=w;
    }
  }
  angularVelocity(){
    this.syncAngular();const m=this.angularMomentum,i=this.inertia;
    return {x:-f(m.x/i)*100,y:f(m.y/i)*100,z:-f(m.z/i)*100};
  }
  restoreAngular(){
    // Rapier's orientation integration can perturb angular velocity by a few
    // ULPs even for an isolated sphere. Native momentum changes only on an
    // impulse or an authored setter; don't adopt that integrator drift.
    const w=this.rapier.angvel(),old=this.lastAngular;
    if(old&&w.x===old.x&&w.y===old.y&&w.z===old.z)return;
    const m=this.angularMomentum,i=this.inertia;
    this.rapier.setAngvel({x:-f(m.x/i)*100,y:f(m.y/i)*100,z:-f(m.z/i)*100},true);this.lastAngular=this.rapier.angvel();
  }
  angularImpulse(impulse){
    this.syncAngular();const m=this.angularMomentum;
    this.angularMomentum={x:f(m.x+f(-impulse.x*100)),y:f(m.y+f(impulse.y*100)),z:f(m.z+f(-impulse.z*100))};
    const p=this.angularMomentum,i=this.inertia;
    this.rapier.setAngvel({x:-f(p.x/i)*100,y:f(p.y/i)*100,z:-f(p.z/i)*100},true);this.lastAngular=this.rapier.angvel();
  }
  dampAngular(factor){
    this.syncAngular();const m=this.angularMomentum;this.angularMomentum={x:f(m.x*factor),y:f(m.y*factor),z:f(m.z*factor)};
    const p=this.angularMomentum,i=this.inertia;this.rapier.setAngvel({x:-f(p.x/i)*100,y:f(p.y/i)*100,z:-f(p.z/i)*100},true);this.lastAngular=this.rapier.angvel();
  }
  setAngularMomentum(axis,value){
    this.syncAngular();this.angularMomentum[axis]=f(value);
    const p=this.angularMomentum,i=this.inertia;this.rapier.setAngvel({x:-f(p.x/i)*100,y:f(p.y/i)*100,z:-f(p.z/i)*100},true);this.lastAngular=this.rapier.angvel();
  }
  snapshot(){
    this.syncAngular();const v=this.rapier.linvel();
    return {p:{...this.sync()},v:{x:f(v.x),y:f(-v.y),z:f(v.z)},m:{...this.angularMomentum},inertia:this.inertia,mass:f(this.rapier.mass())};
  }
  commit(ball){
    const p=this.position;if(p.x!==ball.p.x||p.y!==ball.p.y||p.z!==ball.p.z){this.position=ball.p;this.publish();}this.angularMomentum=ball.m;
    this.rapier.setLinvel({x:ball.v.x,y:-ball.v.y,z:ball.v.z},true);
    const m=ball.m,i=this.inertia;this.rapier.setAngvel({x:-f(m.x/i)*100,y:f(m.y/i)*100,z:-f(m.z/i)*100},true);this.lastAngular=this.rapier.angvel();
  }
}
