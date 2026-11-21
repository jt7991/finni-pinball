// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors, hitplunger.cpp at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {wallHit,roundHit} from './mesh-contact.js';
import {nativeShapeHit} from './native-mesh-contact.js';
import {add,mul} from './native-vector.js';
const f=Math.fround;

// Position stays in authored VPU; speed uses native VPU/10ms, numerically equal
// to world units/s. Displacements are split at the same TOIs as balls/flippers.
export class Plunger {
  constructor(spec){
    this.spec=spec;this.mass=30;this.end=f(f(spec.center.y)-f(spec.stroke));
    this.start=f(spec.center.y);this.rest=f(spec.park_position);this.pos=f(this.end+f(this.rest*f(spec.stroke)));
    this.speed=0;this.pullForce=0;this.fireTimer=0;this.fireSpeed=0;this.fireBounce=0;
    this.reverseImpulse=0;this.travelLimit=this.end;
    const left=(spec.center.x-spec.width)*.01,right=(spec.center.x+spec.width)*.01;
    this.base=(2115-spec.center.y-spec.height)*.01;
    const wall=(x,y,nx,ny,ax,ay,length)=>({kind:'wall',a:{x,y,z:0},normal:{x:nx,y:ny,z:0},axis:{x:ax,y:ay,z:0},length,low:0,high:.5});
    const joint=(x,y)=>({kind:'edge',a:{x,y,z:0},axis:{x:0,y:0,z:1},length:.5});
    this.fixed=[wall(left,this.base,0,-1,1,0,right-left),wall(left,this.base,-1,0,0,1,0),joint(left,this.base),wall(right,this.base,1,0,0,1,0),joint(right,this.base)];
    this.moving=[wall(left,0,0,1,1,0,right-left),joint(left,0),joint(right,0)];
    this.nativeLeft=f(f(spec.center.x)-f(spec.width));this.nativeRight=f(f(spec.center.x)+f(spec.width));this.nativeBase=f(f(spec.center.y)+f(spec.height));
    this.updateNativeShapes();
  }
  get fraction(){return f(f(this.pos-this.end)/f(this.spec.stroke));}
  get position(){return f(25*Math.max(0,Math.min(1,this.fraction)));}
  get charge(){return Math.max(0,(this.fraction-this.rest)/(1-this.rest));}
  pull(){this.cancelled=false;this.speed=0;this.pullForce=this.spec.speed_pull;}
  fire(){
    this.cancelled=false;
    this.pullForce=0;
    const start=Math.max(this.rest,this.fraction),dx=f(start-this.rest);
    this.pos=f(this.end+f(start*f(this.spec.stroke)));
    this.fireSpeed=f(f(f(-f(f(this.spec.speed_fire)/100)*f(this.spec.stroke))*f(dx*f(100/13)))/this.mass);
    this.fireBounce=f(-Math.min(1,f(dx/.5))*this.rest);this.fireTimer=200;
  }
  cancel(){this.cancelled=true;this.pullForce=0;this.fireTimer=0;this.fireSpeed=0;this.speed=0;}
  updateVelocity(){
    if(this.fireTimer>0){this.speed=this.fireSpeed;this.fireTimer--;}
    else if(this.pullForce){
      this.speed=f(this.speed+f(f(this.pullForce)/this.mass));
      if(this.pos>this.start){this.speed=0;this.pos=this.start;}
      if(this.pos<f(this.end+f(this.rest*f(this.spec.stroke)))){this.speed=0;this.pos=f(this.end+f(this.rest*f(this.spec.stroke)));}
    }else if(this.spec.is_mech_plunger){
      this.speed=f(this.speed*f(.95));
      const dx=f(this.rest-this.fraction);
      this.speed=f(this.speed+f(f(f(f(f(.1)*f(this.spec.mech_strength))*dx)*f(this.spec.stroke))/(this.mass*13)));
      this.speed=f(this.speed+this.reverseImpulse);
    }
    this.reverseImpulse=0;
  }
  displace(seconds){
    this.pos=Math.max(this.travelLimit,f(this.pos+f(this.speed*f(seconds*100))));
    const bounce=f(this.rest+this.fireBounce);
    if(this.fireTimer&&seconds&&(this.fireSpeed<0?this.fraction<=bounce:this.fraction>=bounce)){
      this.pos=f(this.end+f(bounce*f(this.spec.stroke)));this.fireSpeed=f(-this.fireSpeed*f(.4));this.fireBounce=f(this.fireBounce*f(-.4));
    }
    this.pos=Math.max(this.pos,this.travelLimit);
    if(seconds){if(this.pos<this.end){this.pos=this.end;this.speed=0;}else if(this.pos>this.start){this.pos=this.start;this.speed=0;}}
    this.pos=Math.max(this.pos,this.travelLimit);this.travelLimit=this.end;
    // Focus/pointer cancellation returns to park without crossing it. It must
    // not turn an interrupted gesture into a launch under the tracking spring.
    if(this.cancelled&&this.fraction<this.rest){this.pos=this.end+this.rest*this.spec.stroke;this.speed=0;}
    this.updateNativeShapes();
  }
  updateNativeShapes(){
    if(this.nativeShapePosition===this.pos)return;this.nativeShapePosition=this.pos;
    const left=this.nativeLeft,right=this.nativeRight,base=this.nativeBase,tip=this.pos;
    this.nativeShapes??=Array.from({length:8},(_,id)=>id===2||id===4||id>=6?{kind:'edge',vertical:true,a:{x:0,y:0,z:0},low:0,high:50,radius:0}:{kind:'wall',a:{x:0,y:0,z:0},n:{x:0,y:0,z:0},low:0,high:50});
    const line=(id,x,y,x2,y2)=>{
      const dx=f(x-x2),dy=f(y-y2),length=f(Math.sqrt(f(f(dx*dx)+f(dy*dy)))),inverse=f(1/length);
      const s=this.nativeShapes[id];s.a.x=x;s.a.y=y;s.n.x=f(dy*inverse);s.n.y=f(-dx*inverse);s.length=length;
    };
    const joint=(id,x,y)=>{const s=this.nativeShapes[id];s.a.x=x;s.a.y=y;};
    line(0,left,base,right,base);line(1,f(left+f(.0001)),tip,left,base);joint(2,left,base);line(3,right,base,f(right+f(.0001)),tip);joint(4,right,base);line(5,right,tip,left,tip);joint(6,left,tip);joint(7,right,tip);
  }
  nativeHit(query,mass,duration){
    const transfer=f(f(this.spec.momentum_xfer)/Math.max(f(.05),f(mass))),impulse=f(this.speed*transfer);let result=null,time=f(duration*100);
    const relative={...query.v,y:f(query.v.y-this.speed)};
    for(const [id,shape]of this.nativeShapes.entries()){
      const moving=id>=5,hit=nativeShapeHit(shape,{...query,v:moving?relative:query.v,dt:time});
      if(hit&&f(hit.time*100)<=time){time=f(hit.time*100);result={...hit,id,tipVelocity:moving?-impulse:0};}
    }
    if(result){
      this.travelLimit=Math.max(this.travelLimit,this.pos);
      // Native compares the selected hit velocity with the moving impulse.
      // With a stationary rod that also includes fixed edges (both are zero).
      if(result.gap<=0&&f(-result.tipVelocity)===impulse&&Math.abs(impulse)<Math.abs(f(result.gap*100)))result.tipVelocity=Math.abs(f(result.gap*100));
    }
    return result;
  }
  hit(p,v,mass,radius,duration,query){
    if(query)return this.nativeHit(query,mass,duration);
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
  collide(body,hit,random=Math.random,difficulty=.5){
    if(body.native){
      const native=body.native,ball=native.snapshot(),n={x:f(hit.normal.x),y:f(-hit.normal.y),z:0},gap=f(hit.gap*100),tip=f(-hit.tipVelocity);
      let dot=f(f(ball.v.x*n.x)+f(f(ball.v.y-tip)*n.y));
      if(dot>=-f(.0001)){if(dot>f(.0001)||gap>=0)return;dot=-f(.05);}
      const correction=Math.min(5,f(-f(.9875)*gap));if(correction>f(.0001))ball.p=add(ball.p,mul(n,correction));
      const impulse=f(f(dot*f(-1.45))/f(1+f(1/this.mass)));this.fireBounce=f(this.fireBounce*f(.6));
      if(tip!==0)this.reverseImpulse=f(f(f(ball.v.y*impulse)*f(ball.mass/this.mass))*f(.22));
      ball.v=mul(add(ball.v,mul(n,impulse)),f(.999));
      const scatter=f(f(this.spec.scatter_velocity)*f(difficulty));
      if(scatter>0&&Math.abs(ball.v.y)>scatter){let noise=random.signed?random.signed():f(random()*2-1);noise=f(noise*f(f(f(1-f(noise*noise))*f(2.59808))*scatter));ball.v.y=f(ball.v.y+noise);}
      native.commit(ball);return;
    }
    const n=hit.normal,v=body.linvel();let dot=v.x*n.x+(v.y-hit.tipVelocity)*n.y;
    if(dot>=-.0001){if(dot>.0001||hit.gap>=0)return;dot=-.05;}
    const correction=Math.min(.05,-.9875*hit.gap);
    if(correction>.000001){const p=body.translation();body.setTranslation({x:p.x+n.x*correction,y:p.y+n.y*correction,z:p.z},true);}
    const impulse=-1.45*dot/(1+1/this.mass);this.fireBounce*=.6;
    if(hit.tipVelocity!==0)this.reverseImpulse=-v.y*impulse*body.mass()/this.mass*.22;
    body.setLinvel({x:(v.x+impulse*n.x)*.999,y:(v.y+impulse*n.y)*.999,z:v.z*.999},true);
  }
}
