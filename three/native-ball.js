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
    for(const method of ['linvel','setLinvel','angvel','setAngvel','mass','applyImpulse','applyTorqueImpulse','collider'])this.body[method]=(...args)=>body[method](...args);
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
}
