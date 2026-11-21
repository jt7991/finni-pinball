// SPDX-License-Identifier: GPL-3.0-or-later
// Spinner crossing tests, motion and events adapted from Visual Pinball
// collide.cpp/collideex.cpp and parts/spinner.cpp, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround,pi=f(Math.PI),tau=f(2*Math.PI),degrees=f(180/Math.PI);
export class Spinner {
  constructor(spec,height,emit=()=>{}){
    this.spec=spec;this.height=height;this.emit=emit;
    const a=f(f(spec.rotation)*f(Math.PI/180)),sn=f(Math.sin(a)),cs=f(Math.cos(a)),half=f(f(spec.length*.5)+25);
    this.center={x:spec.center.x*.01,y:(2115-spec.center.y)*.01};
    this.tangent={x:cs,y:-sn};
    const ends=[-1,1].map(sign=>({x:f(f(spec.center.x)+sign*f(cs*half)),y:f(f(spec.center.y)+sign*f(sn*half))}));
    this.lines=[ends,[ends[1],ends[0]]].map(([a,b])=>{
      const x=f(a.x-b.x),y=f(a.y-b.y),length=f(Math.sqrt(f(f(x*x)+f(y*y)))),inverse=f(1/length);
      return {a,length,n:{x:f(y*inverse),y:f(-x*inverse)}};
    });
    this.halfLength=spec.length*.005+.25;
    this.min=f(Math.min(spec.angle_min,spec.angle_max)*Math.PI/180);
    this.max=f(Math.max(spec.angle_min,spec.angle_max)*Math.PI/180);
    this.limited=spec.angle_min!==spec.angle_max;
    this.angle=f(Math.max(this.min,Math.min(this.max,0)));this.speed=0;
    this.damping=f(Math.pow(f(spec.damping),f(.1)));
    this.elasticity=f(spec.elasticity);this.spins=0;
  }
  get currentAngle(){return f(this.angle*degrees);}
  hit(p,v,radius,duration){
    const x=f(p.x*100),y=f(2115-p.y*100),z=f(p.z*100),vx=f(v.x),vy=f(-v.y),vz=f(v.z),r=f(radius*100),dt=f(duration*100);
    for(let side=0;side<2;side++){
      const {a,n,length}=this.lines[side],vn=f(f(vx*n.x)+f(vy*n.y)),dx=f(x-a.x),dy=f(y-a.y),gap=f(f(f(dx*n.x)+f(dy*n.y))+r);
      if(f(vn*gap)>=0)continue;
      const time=f(gap/-vn);if(!Number.isFinite(time)||time<0||Object.is(time,-0)||time>dt)continue;
      const along=f(f(f(dx*n.y)-f(dy*n.x))+f(f(f(vx*n.y)-f(vy*n.x))*time)),atZ=f(z+f(vz*time));
      if(along<0||along>length||f(atZ+r*.5)<this.height*100||f(atZ-r*.5)>this.height*100+50)continue;
      return {time:time*.01,normal:{x:n.x,y:-n.y,z:0},gap:gap*.01,vn,side,contact:Math.abs(vn)<=.099&&Math.abs(gap)<=.05};
    }
    return null;
  }
  collide(body,hit){
    const v=body.linvel(),dot=f(f(hit.normal.x*v.x)+f(hit.normal.y*v.y));if(dot<0)return;
    const half=f(this.spec.height*.5);
    this.speed=f(f(Math.abs(half)>1?Math.abs(dot)/half:Math.abs(dot))*this.damping);
    if(hit.side===0)this.speed=-this.speed;
  }
  updateVelocity(){
    this.speed=f(this.speed-f(f(Math.sin(this.angle))*f(.00025)));
    this.speed=f(this.speed*this.damping);
  }
  displace(duration){
    const target=this.speed>0?(this.angle<pi?pi:f(3*Math.PI)):(this.angle<pi?-pi:pi);
    this.angle=f(this.angle+f(this.speed*f(duration*100)));
    if(this.limited){
      if(this.angle>this.max){this.angle=this.max;this.emit('EOS',f(Math.abs(this.speed*degrees)));if(this.speed>0)this.speed=f(this.speed*f(-.005-this.elasticity));}
      if(this.angle<this.min){this.angle=this.min;this.emit('BOS',f(Math.abs(this.speed*degrees)));if(this.speed<0)this.speed=f(this.speed*f(-.005-this.elasticity));}
    }else{
      if(this.speed>0?this.angle>target:this.angle<target){this.spins++;this.emit('Spin');}
      while(this.angle>tau)this.angle=f(this.angle-tau);
      while(this.angle<0)this.angle=f(this.angle+tau);
    }
  }
}
