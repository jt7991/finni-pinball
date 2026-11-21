// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' Gate/LineSeg behavior, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {Spinner} from './spinner.js';
const f=Math.fround,degrees=f(180/Math.PI);
export class Gate extends Spinner {
  constructor(spec,height,emit=()=>{}){
    super({...spec,angle_min:0,angle_max:0},height,emit);this.spec=spec;
    this.min=f(Math.min(spec.angle_min,spec.angle_max));this.max=f(Math.max(spec.angle_min,spec.angle_max));
    this.angle=this.min;this.open=false;this.enabled=spec.is_collidable;this.forced=false;this.hitDirection=false;this.lastEvents=new WeakMap();
    this.material={elasticity:spec.elasticity,elasticity_falloff:0,friction:spec.friction,scatter:spec.scatter??0,default_scatter:0,difficulty:0};
  }
  setCollidable(value){this.enabled=!!value;this.min=f(Math.min(this.spec.angle_min,this.spec.angle_max));this.max=f(Math.max(this.spec.angle_min,this.spec.angle_max));if(this.enabled)this.min=0;this.collider.setEnabled(this.enabled);}
  setOpen(value){
    this.hitDirection=false;this.min=f(Math.min(this.spec.angle_min,this.spec.angle_max));this.max=f(Math.max(this.spec.angle_min,this.spec.angle_max));this.forced=true;this.open=!!value;
    this.enabled=this.open?false:this.spec.is_collidable;this.collider.setEnabled(this.enabled);
    if(this.open?this.angle<this.max:this.angle>this.min)this.speed=f(this.open ? .2 : -.2);
  }
  blockHit(p,v,radius,duration){
    if(this.spec.two_way)return null;
    const {a,n,length}=this.lines[1],x=f(p.x*100),y=f(2115-p.y*100),vx=f(v.x),vy=f(-v.y),r=f(radius*100),dt=f(duration*100);
    const vn=f(f(vx*n.x)+f(vy*n.y));if(vn>f(.0001))return null;
    const dx=f(x-a.x),dy=f(y-a.y),distance=f(f(dx*n.x)+f(dy*n.y)),gap=f(distance-r);if(gap< -r||distance<0)return null;
    let time;
    if(gap<=f(.05))time=gap<=0||Math.abs(vn)>f(.099)?0:f(f(gap*10)+.5);
    else if(Math.abs(vn)>f(.0001))time=f(gap/-vn);else return null;
    if(!Number.isFinite(time)||time<0||Object.is(time,-0)||time>dt)return null;
    const along=f(f(f(dx*n.y)-f(dy*n.x))+f(f(f(vx*n.y)-f(vy*n.x))*time)),z=f(f(p.z*100)+f(f(v.z)*time));
    if(along<0||along>length||f(z+r*.5)<this.height*100||f(z-r*.5)>this.height*100+50)return null;
    return {time:time*.01,gap:gap*.01,vn,normal:{x:n.x,y:-n.y,z:0},contact:Math.abs(vn)<=f(.099)&&Math.abs(gap)<=f(.05)};
  }
  collide(body,hit,ball){
    const v=body.linvel(),dot=f(f(hit.normal.x*v.x)+f(hit.normal.y*v.y)),h=f(this.spec.height*.5);
    this.speed=f(Math.abs(h)>1?f(Math.abs(dot)/h):Math.abs(dot));
    if(hit.side===0&&!this.spec.two_way){this.hitDirection=dot>0;this.speed=f(this.speed*f(.02));return;}
    this.hitDirection=false;if(hit.side===1&&this.spec.two_way)this.speed=-this.speed;
    if(body.acceptHitEvent){if(body.acceptHitEvent())this.emit('Hit',ball);return;}
    const p=body.translation(),last=this.lastEvents.get(body);
    if(last&&((p.x-last.x)**2+(p.y-last.y)**2+(p.z-last.z)**2)*10000<=.25)return;
    this.lastEvents.set(body,p);this.emit('Hit',ball);
  }
  updateVelocity(){
    if(this.open)return;
    if(Math.abs(this.angle)<f(this.min+f(.01))&&Math.abs(this.speed)<f(.01)){this.angle=this.min;this.speed=0;}
    if(Math.abs(this.speed)!==0&&this.angle!==this.min){this.speed=f(this.speed-f(f(f(Math.sin(this.angle))*f(this.spec.gravity_factor))*f(.001)));this.speed=f(this.speed*this.damping);}
  }
  displace(duration){
    const direction=this.spec.two_way?(this.angle<0?-1:1):this.hitDirection?-1:1;
    // The native mover rounds the damping factor before multiplying speed.
    if(direction*this.angle>this.max){this.angle=f(direction*this.max);this.emit('EOS',f(Math.abs(this.speed*degrees)));if(!this.forced)this.speed=f(f(this.damping*f(-.8))*this.speed);else if(this.speed>0)this.speed=0;}
    if(direction*this.angle<this.min){this.angle=f(direction*this.min);if(!this.spec.two_way)this.emit('BOS',f(Math.abs(this.speed*degrees)));if(!this.forced)this.speed=f(f(this.damping*f(-.8))*this.speed);else if(this.speed<0)this.speed=0;}
    if(this.speed===0)this.forced=false;
    this.angle=f(this.angle+f(this.speed*f(duration*100)));
  }
}
