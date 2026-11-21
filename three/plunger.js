// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors, hitplunger.cpp at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {wallHit,roundHit} from './mesh-contact.js';

// Position stays in authored VPU; speed uses native VPU/10ms, numerically equal
// to world units/s. Displacements are split at the same TOIs as balls/flippers.
export class Plunger {
  constructor(spec){
    this.spec=spec;this.mass=30;this.end=spec.center.y-spec.stroke;
    this.start=spec.center.y;this.rest=spec.park_position;this.pos=this.end+this.rest*spec.stroke;
    this.speed=0;this.pullForce=0;this.fireTimer=0;this.fireSpeed=0;this.fireBounce=0;
    this.reverseImpulse=0;this.travelLimit=this.end;
    const left=(spec.center.x-spec.width)*.01,right=(spec.center.x+spec.width)*.01;
    this.base=(2115-spec.center.y-spec.height)*.01;
    const wall=(x,y,nx,ny,ax,ay,length)=>({kind:'wall',a:{x,y,z:0},normal:{x:nx,y:ny,z:0},axis:{x:ax,y:ay,z:0},length,low:0,high:.5});
    const joint=(x,y)=>({kind:'edge',a:{x,y,z:0},axis:{x:0,y:0,z:1},length:.5});
    this.fixed=[wall(left,this.base,0,-1,1,0,right-left),wall(left,this.base,-1,0,0,1,0),joint(left,this.base),wall(right,this.base,1,0,0,1,0),joint(right,this.base)];
    this.moving=[wall(left,0,0,1,1,0,right-left),joint(left,0),joint(right,0)];
  }
  get fraction(){return (this.pos-this.end)/this.spec.stroke;}
  get position(){return 25*this.fraction;}
  get charge(){return Math.max(0,(this.fraction-this.rest)/(1-this.rest));}
  pull(){this.cancelled=false;this.speed=0;this.pullForce=this.spec.speed_pull;}
  fire(){
    this.cancelled=false;
    this.pullForce=0;
    const start=Math.max(this.rest,this.fraction),dx=start-this.rest;
    this.pos=this.end+start*this.spec.stroke;
    this.fireSpeed=-(this.spec.speed_fire/100)*this.spec.stroke*dx*(100/13)/this.mass;
    this.fireBounce=-Math.min(1,dx/.5)*this.rest;this.fireTimer=200;
  }
  cancel(){this.cancelled=true;this.pullForce=0;this.fireTimer=0;this.fireSpeed=0;this.speed=0;}
  updateVelocity(){
    if(this.fireTimer>0){this.speed=this.fireSpeed;this.fireTimer--;}
    else if(this.pullForce){
      this.speed+=this.pullForce/this.mass;
      if(this.pos>this.start){this.speed=0;this.pos=this.start;}
      if(this.pos<this.end+this.rest*this.spec.stroke){this.speed=0;this.pos=this.end+this.rest*this.spec.stroke;}
    }else if(this.spec.is_mech_plunger){
      this.speed*=.95;
      this.speed+=.1*this.spec.mech_strength*(this.rest-this.fraction)*this.spec.stroke/(this.mass*13)+this.reverseImpulse;
    }
    this.reverseImpulse=0;
  }
  displace(seconds){
    this.pos=Math.max(this.travelLimit,this.pos+this.speed*seconds*100);
    const bounce=this.rest+this.fireBounce;
    if(this.fireTimer&&seconds&&(this.fireSpeed<0?this.fraction<=bounce:this.fraction>=bounce)){
      this.pos=this.end+bounce*this.spec.stroke;this.fireSpeed*=-.4;this.fireBounce*=-.4;
    }
    this.pos=Math.max(this.pos,this.travelLimit);
    if(seconds){if(this.pos<this.end){this.pos=this.end;this.speed=0;}else if(this.pos>this.start){this.pos=this.start;this.speed=0;}}
    this.pos=Math.max(this.pos,this.travelLimit);this.travelLimit=this.end;
    // Focus/pointer cancellation returns to park without crossing it. It must
    // not turn an interrupted gesture into a launch under the tracking spring.
    if(this.cancelled&&this.fraction<this.rest){this.pos=this.end+this.rest*this.spec.stroke;this.speed=0;}
  }
  hit(p,v,mass,radius,duration){
    const left=this.fixed[0].a.x,right=left+this.fixed[0].length,top=(2115-this.pos)*.01;
    if(p.x+radius<left||p.x-radius>right||p.y+radius<this.base||p.y-radius>(2115-this.end)*.01||p.z+radius<0||p.z-radius>.5)return null;
    this.fixed[1].length=this.fixed[3].length=top-this.base;
    for(const shape of this.moving)shape.a.y=top;
    let result=null;
    const relative={x:v.x,y:v.y+this.speed,z:v.z};
    for(const [index,shape]of [...this.fixed,...this.moving].entries()){
      const moving=index>=this.fixed.length,velocity=moving?relative:v;
      const hit=shape.kind==='wall'?wallHit(p,velocity,radius,duration,shape):roundHit(p,velocity,radius,duration,shape);
      if(hit&&(!result||hit.time<=result.time))result={...hit,id:index,tipVelocity:moving?-this.speed*this.spec.momentum_xfer/Math.max(.05,mass):0};
    }
    if(result){
      this.travelLimit=Math.max(this.travelLimit,this.pos);
      if(result.gap<=0&&result.id>=this.fixed.length&&Math.abs(result.tipVelocity)<Math.abs(result.gap*100))result.tipVelocity=Math.abs(result.gap*100);
    }
    return result;
  }
  collide(body,hit){
    const n=hit.normal,v=body.linvel();let dot=v.x*n.x+(v.y-hit.tipVelocity)*n.y;
    if(dot>=-.0001){if(dot>.0001||hit.gap>=0)return;dot=-.05;}
    const correction=Math.min(.05,-.9875*hit.gap);
    if(correction>.000001){const p=body.translation();body.setTranslation({x:p.x+n.x*correction,y:p.y+n.y*correction,z:p.z},true);}
    const impulse=-1.45*dot/(1+1/this.mass);this.fireBounce*=.6;
    if(hit.tipVelocity!==0)this.reverseImpulse=-v.y*impulse*body.mass()/this.mass*.22;
    body.setLinvel({x:(v.x+impulse*n.x)*.999,y:(v.y+impulse*n.y)*.999,z:v.z*.999},true);
  }
}
