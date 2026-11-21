// SPDX-License-Identifier: GPL-3.0-or-later
// Native-unit position integration from Visual Pinball hitball.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export class NativeBall {
  constructor(body){
    this.rapier=body;this.position=null;this.lastWorld=null;
    this.body={translation:()=>this.translation(),setTranslation:(p,wake)=>this.setTranslation(p,wake),handle:body.handle};
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
    this.position={x:f(start.x+f(v.x*dt)),y:f(start.y+f(-v.y*dt)),z:f(start.z+f(v.z*dt))};this.publish();
  }
}
