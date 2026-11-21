// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' Trigger/LineSeg/HitCircle/Hit3DPoly behavior,
// revision 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See licenses/VPX-Physics-NOTICE.txt. Queries retain native Float32 VPU units.
import {nativeDragCurve} from './native-curve.js';
import {add,sub,mul,length} from './native-vector.js';
const f=Math.fround;
const dot=(a,b)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const valid=(t,dt)=>Number.isFinite(t)&&t>=0&&!Object.is(t,-0)&&t<=dt;
const bounds=(points,low,high)=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y)),low,high});
export class Trigger {
  constructor(spec,height,emit=()=>{}){
    this.spec=spec;this.emit=emit;this.members=new WeakMap();this.shapes=[];
    const low=f(height*100),high=f(low+f(spec.hit_height));
    if(['star','button'].includes(spec.shape)){
      const c={x:f(spec.center.x),y:f(spec.center.y)},r=f(spec.radius);
      this.shapes.push({kind:'circle',c,r,box:{left:f(c.x-r),right:f(c.x+r),top:f(c.y-r),bottom:f(c.y+r),low,high}});
    }else{
      const points=nativeDragCurve(spec.drag_points??[],true,4,2).map(p=>({x:p.x,y:p.y,z:f(low+50)}));
      for(let i=0;i<points.length;i++){
        const a=points[(i+1)%points.length],b=points[(i+2)%points.length],dx=f(a.x-b.x),dy=f(a.y-b.y),length=f(Math.sqrt(f(f(dx*dx)+f(dy*dy)))),inv=f(1/length);
        if(length)this.shapes.push({kind:'line',a,b,length,n:{x:f(dy*inv),y:f(-dx*inv),z:0},box:bounds([a,b],low,f(low+Math.max(f(spec.hit_height-8),0)))});
      }
      if(points.length>=3){
        let normal={x:0,y:0,z:0};for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];normal=add(normal,{x:f(f(a.y-b.y)*f(a.z+b.z)),y:f(f(a.z-b.z)*f(a.x+b.x)),z:f(f(a.x-b.x)*f(a.y+b.y))});}
        const magnitude=length(normal);normal=mul(normal,magnitude>0?f(-1/magnitude):0);
        this.shapes.push({kind:'poly',points,n:normal,box:bounds(points,f(low+50),f(low+50))});
      }
    }
  }
  hits(p,v,radius,duration,body){
    if(!this.collider.isEnabled())return [];
    const pos={x:f(p.x*100),y:f(2115-p.y*100),z:f(p.z*100)},vel={x:f(v.x),y:f(-v.y),z:f(v.z)},r=f(radius*100),dt=f(duration*100);
    // Native broadphase spans one VPT of speed in every direction. Membership
    // deliberately survives a teleport outside that box; it is not an overlap cache.
    const extent=f(f(f(Math.sqrt(dot(vel,vel)))+r)+f(.05)),hitRadius=f(f(f(pos.x+extent)-f(pos.x-extent))*.5),radiusSquared=f(hitRadius*hitRadius),hits=[];
    for(const shape of this.shapes){
      const b=shape.box;
      if(f(pos.x+extent)<b.left||f(pos.x-extent)>b.right||f(pos.y+extent)<b.top||f(pos.y-extent)>b.bottom||f(pos.z+extent)<b.low||f(pos.z-extent)>b.high)continue;
      const dx=f(Math.max(f(b.left-pos.x),0)+Math.max(f(pos.x-b.right),0)),dy=f(Math.max(f(b.top-pos.y),0)+Math.max(f(pos.y-b.bottom),0)),dz=f(Math.max(f(b.low-pos.z),0)+Math.max(f(pos.z-b.high),0));
      if(f(f(f(dx*dx)+f(dy*dy))+f(dz*dz))>radiusSquared)continue;
      const member=(this.members.get(body)??0)>0;
      const hit=shape.kind==='circle'?this.circle(shape,pos,vel,r,dt,member,body):this.planar(shape,pos,vel,r,dt,member);
      if(hit)hits.push(hit);
    }
    return hits;
  }
  planar(s,p,v,r,dt,member){
    const poly=s.kind==='poly',a=poly?s.points[0]:s.a,n=s.n;
    const dx=f(p.x-a.x),dy=f(p.y-a.y),gap=poly?dot(n,sub(sub(p,mul(n,r)),a)):f(f(f(dx*n.x)+f(dy*n.y))-f(.005)),vn=dot(v,n),inside=gap<=0;
    let unhit=vn>f(.0001),time;
    if(f(vn*gap)>=0){if(Math.abs(gap)>=f(r*.5)||inside!==!member)return null;time=0;unhit=!inside;}else time=f(gap/-vn);
    if(!valid(time,dt))return null;
    if(poly){
      const nearest=add(sub(p,mul(n,r)),mul(v,time)),x=nearest.x,y=nearest.y;let cross=0;
      for(let i=0;i<s.points.length;i++){
        const a=s.points[i],b=s.points[(i+1)%s.points.length],hx1=x>=a.x,hx2=x>=b.x,hy1=y<=a.y,hy2=y<=b.y;
        if(a.y===b.y||hy1===hy2||hx1&&hx2)continue;
        if(!hx1&&!hx2){cross^=1;continue;}
        if(a.x===b.x){if(!hx2)cross^=1;continue;}
        if(f(b.x-f(f(f(b.y-y)*f(a.x-b.x))/f(a.y-b.y)))>x)cross^=1;
      }
      if(!cross)return null;
    }else{
      const along=f(f(f(dx*n.y)-f(dy*n.x))+f(f(f(v.x*n.y)-f(v.y*n.x))*time)),z=f(p.z+f(v.z*time));
      if(along<0||along>s.length||f(z+f(r*.5))<s.box.low||f(z-f(r*.5))>s.box.high)return null;
    }
    return {time:time*.01,gap:gap*.01,vn,unhit,normal:{x:n.x,y:-n.y,z:n.z},contact:!poly&&Math.abs(vn)<=f(.099)&&Math.abs(gap)<=f(.05)};
  }
  circle(s,p,v,r,dt,member,body){
    const capsule=p.z>s.box.high,target=capsule?f(s.r*f(2.6)):s.r,centerZ=capsule?f(s.box.high-f(s.r*f(2.4))):0;
    const d={x:f(p.x-s.c.x),y:f(p.y-s.c.y),z:capsule?f(p.z-centerZ):0},dv={...v,z:capsule?v.z:0},d2=dot(d,d),distance=f(Math.sqrt(d2));
    if(distance<=f(1e-6))return null;
    const b=dot(d,dv),vn=f(b/distance),gap=f(distance-target),a=dot(dv,dv);
    let time=0,unhit=false;
    if((gap<0)===!member){
      // Preserve native generated-ball handling, including its duplicate entry.
      if(Math.abs(f(gap-s.r))<f(.05))this.members.set(body,(this.members.get(body)??0)+1);
      else unhit=gap>0;
    }else{
      if(f(gap*vn)>0||a<f(1e-8))return null;
      const bb=f(2*b),c=f(d2-f(target*target)),discriminant=f(f(bb*bb)-f(f(4*a)*c));if(discriminant<0)return null;
      const root=f(Math.sqrt(discriminant)),inverse=f(-.5/a),t1=f(f(bb+root)*inverse),t2=f(f(bb-root)*inverse);
      unhit=f(t1*t2)<0;time=unhit?Math.max(t1,t2):Math.min(t1,t2);
    }
    if(!valid(time,dt))return null;
    const z=f(p.z+f(v.z*time));if(f(z+f(r*.5))<s.box.low||!capsule&&f(z-f(r*.5))>s.box.high||capsule&&z<s.box.high)return null;
    const x=f(f(p.x+f(v.x*time))-s.c.x),y=f(f(p.y+f(v.y*time))-s.c.y),sq=f(f(x*x)+f(y*y)),inv=sq>f(1e-8)?f(1/f(Math.sqrt(sq))):0;
    return {time:time*.01,gap:gap*.01,vn,unhit,contact:false,normal:inv?{x:f(x*inv),y:-f(y*inv),z:0}:{x:0,y:-1,z:0}};
  }
  collide(body,hit,record){
    const count=this.members.get(body)??0;if((!hit.unhit)!==(count===0))return;
    if(body.advanceTrigger)body.advanceTrigger();
    else{const p=body.translation(),v=body.linvel();body.setTranslation({x:f(f(p.x*100)+f(v.x*f(.02)))*.01,y:(2115-f(f(2115-p.y*100)+f(-v.y*f(.02))))*.01,z:f(f(p.z*100)+f(v.z*f(.02)))*.01},true);}
    this.members.set(body,hit.unhit?count-1:count+1);this.emit(hit.unhit?'UnHit':'Hit',record);
  }
}
