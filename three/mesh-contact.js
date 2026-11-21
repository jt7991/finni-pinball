// SPDX-License-Identifier: GPL-3.0-or-later
// Native triangle/line/point collision and static response adapted from Visual
// Pinball contributors, 195f214dd4849b8ef6113fd377258b78d0dec3bf, collide.cpp,
// collideex.cpp and hitball.cpp. See public/licenses/VPX-Physics-NOTICE.txt.
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=a=>mul(a,1/Math.hypot(a.x,a.y,a.z));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class ContactMesh{
  constructor(mesh,options={}){
    const points=[];for(let i=0;i<mesh.vertices.length;i+=3)points.push({x:mesh.vertices[i],y:mesh.vertices[i+1],z:mesh.vertices[i+2]});
    this.grid=new Map();const edges=new Map();this.shapes=[];
    this.bounds={minZ:Infinity,maxZ:-Infinity};
    const insert=shape=>{
      shape.id=this.shapes.length;this.shapes.push(shape);
      for(const point of shape.points){this.bounds.minZ=Math.min(this.bounds.minZ,point.z);this.bounds.maxZ=Math.max(this.bounds.maxZ,point.z);}
      const p=shape.points,minX=Math.floor(Math.min(...p.map(v=>v.x))),maxX=Math.floor(Math.max(...p.map(v=>v.x))),minY=Math.floor(Math.min(...p.map(v=>v.y))),maxY=Math.floor(Math.max(...p.map(v=>v.y)));
      for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const key=`${x},${y}`;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(shape);}
    };
    this.insert=insert;
    for(let i=0;i<mesh.indices.length;i+=3){
      const ids=mesh.indices.slice(i,i+3),[a,b,c]=ids.map(i=>points[i]),ab=sub(b,a),ac=sub(c,a),raw=cross(ab,ac);
      // This is the upward-facing playfield, including its authored holes.
      const n=dot(raw,raw)>=1e-10?unit(raw):null;
      if(n){if(options.invertNormals||(!options.preserveNormals&&n.z<0))Object.assign(n,mul(n,-1));insert({kind:'triangle',points:[a,b,c],a,ab,ac,n});if(options.twoSided)insert({kind:'triangle',points:[a,b,c],a,ab,ac,n:mul(n,-1)});}
      for(let j=0;j<3;j++){
        const k=ids[j],l=ids[(j+1)%3],key=[Math.min(k,l),Math.max(k,l)].join(':');
        if(edges.has(key)){edges.get(key).normals.push(n);continue;}
        const a=points[k],b=points[l];edges.set(key,{a,b,normals:[n]});
      }
    }
    for(const {a,b,normals}of edges.values()){
      if(options.coplanarJoints===false&&normals.length>1&&normals.every(n=>!n||!normals[0]||dot(cross(n,normals[0]),cross(n,normals[0]))<1e-8))continue;
      const delta=sub(b,a),length=Math.hypot(delta.x,delta.y,delta.z);if(length>1e-9)insert({kind:'edge',points:[a,b],a,axis:mul(delta,1/length),length});
    }
    if(options.points!==false)for(const a of points)insert({kind:'point',points:[a],a});
  }
  hits(body,radius,duration){
    return this.hitsAt(body.translation(),body.linvel(),radius,duration);
  }
  hitsAt(p,v,radius,duration){
    const q=add(p,mul(v,duration)),seen=new Set(),hits=[];
    if(Math.min(p.z,q.z)-radius>this.bounds.maxZ+.0005||Math.max(p.z,q.z)+radius<this.bounds.minZ-.0005)return hits;
    for(let x=Math.floor(Math.min(p.x,q.x)-radius);x<=Math.floor(Math.max(p.x,q.x)+radius);x++)for(let y=Math.floor(Math.min(p.y,q.y)-radius);y<=Math.floor(Math.max(p.y,q.y)+radius);y++){
      for(const shape of this.grid.get(`${x},${y}`)??[]){
        if(seen.has(shape.id))continue;seen.add(shape.id);
        const hit=shape.kind==='triangle'?triangleHit(p,v,radius,duration,shape):shape.kind==='wall'?wallHit(p,v,radius,duration,shape):roundHit(p,v,radius,duration,shape);
        if(hit)hits.push({...hit,id:shape.id});
      }
    }
    return hits;
  }
  addWall(a,b,low,high,height,slingshot){
    if(high-low>.5){const m=mul(add(a,b),.5),h=(low+high)*.5;this.addWall(a,m,low,h,height);this.addWall(m,b,h,high,height);return;}
    const d=sub(b,a),length=Math.hypot(d.x,d.y);if(length<1e-9)return;
    const normal={x:d.y/length,y:-d.x/length,z:0};
    this.insert({kind:'wall',points:[a,b],a,axis:{x:d.x/length,y:d.y/length,z:0},length,normal,low,high:high+height,slingshot});
  }
  addVertical(a,low,high){if(high<=low)return;this.insert({kind:'edge',points:[{...a,z:low},{...a,z:high}],a:{...a,z:low},axis:{x:0,y:0,z:1},length:high-low});}
  addCircle(center,radius,low,high){this.insert({kind:'circle',points:[{x:center.x-radius,y:center.y-radius,z:low},{x:center.x+radius,y:center.y+radius,z:high}],a:{...center,z:low},axis:{x:0,y:0,z:1},length:high-low,radius});}
}
function wallHit(p,v,radius,duration,s){
  const vn=dot(v,s.normal);if(vn>.0001)return null;
  const distance=dot(sub(p,s.a),s.normal),gap=distance-radius;if(gap< -radius||distance<0)return null;
  let time;
  if(gap<=.0005)time=gap<=0||Math.abs(vn)>.099?0:(gap/.001+.5)*.01;
  else if(Math.abs(vn)>.0001)time=gap/-vn;else return null;
  if(!Number.isFinite(time)||time<0||time>duration)return null;
  const at=add(p,mul(v,time)),along=dot(sub(at,s.a),s.axis);
  if(along<0||along>s.length||at.z+radius*.5<s.low||at.z-radius*.5>s.high)return null;
  return {time,gap,vn,normal:s.normal,contact:Math.abs(vn)<=.099&&Math.abs(gap)<=.0005};
}
function triangleHit(p,v,radius,duration,s){
  const vn=dot(s.n,v);if(vn>.099)return null;
  const nearest=sub(p,mul(s.n,radius)),gap=dot(s.n,sub(nearest,s.a));if(gap< -radius)return null;
  let contact=false,time;
  if(gap<=.0005){if(Math.abs(vn)<=.099){time=0;contact=true;}else time=gap<=0?0:gap/-vn;}
  else if(Math.abs(vn)>.0001)time=gap/-vn;else return null;
  if(!Number.isFinite(time)||time<0||time>duration)return null;
  const d=sub(add(nearest,mul(v,time)),s.a),aa=dot(s.ab,s.ab),bb=dot(s.ac,s.ac),ab=dot(s.ab,s.ac),ad=dot(s.ab,d),bd=dot(s.ac,d),den=aa*bb-ab*ab;
  const u=(bb*ad-ab*bd)/den,w=(aa*bd-ab*ad)/den;
  if(u<0||w<0||u+w>1)return null;
  return {time,contact,gap,vn,normal:s.n};
}
function roundHit(p,v,radius,duration,s){
  const totalRadius=radius+(s.radius??0);
  let d=sub(p,s.a),dv=v;
  if(s.axis){d=sub(d,mul(s.axis,dot(d,s.axis)));dv=sub(v,mul(s.axis,dot(v,s.axis)));}
  const squared=dot(d,d),distance=Math.sqrt(squared);if(distance<=1e-8)return null;
  const b=dot(d,dv),vn=b/distance,gap=distance-totalRadius;if(vn>.099||s.kind==='circle'&&gap< -radius)return null;
  let contact=false,time=0;
  if(gap<.0005){
    if(Math.abs(vn)<=.099)contact=true;
    else time=s.axis&&s.kind!=='circle'?-gap/vn:Math.max(0,-gap/vn);
  }else{
    const a=dot(dv,dv),disc=b*b-a*(squared-totalRadius*totalRadius);if(a<1e-8||disc<0)return null;
    const root=Math.sqrt(disc),t1=(-b-root)/a,t2=(-b+root)/a;time=t1*t2<0?Math.max(t1,t2):Math.min(t1,t2);
  }
  if(!Number.isFinite(time)||time<0||time>duration)return null;
  const at=add(p,mul(v,time));
  if(s.axis){const along=dot(sub(at,s.a),s.axis),skin=s.kind==='circle'?radius*.5:0;if(along< -skin||along>s.length+skin)return null;}
  return {time,contact,gap,vn,normal:unit(add(d,mul(dv,time)))};
}
export function collideSurface(body,hit,material,radius,random=Math.random){
  const n=hit.normal;let v=body.linvel(),vn=dot(v,n);
  if(vn>=-.0001){if(vn>.0001||hit.gap>=0)return;vn=-.05;}
  const correction=Math.min(.05,-hit.gap*.9875);if(correction>.000001)body.setTranslation(add(body.translation(),mul(n,correction)),true);
  const e=material.elasticity/(1+material.elasticity_falloff*Math.abs(vn)/18.53),delta=-(1+e)*vn;
  body.applyImpulse(mul(n,delta*body.mass()),true);
  const r=mul(n,-radius),surface=add(body.linvel(),cross(body.angvel(),r)),tangent=sub(surface,mul(n,dot(surface,n))),speed=Math.hypot(tangent.x,tangent.y,tangent.z);
  if(speed>.001){
    const t=mul(tangent,1/speed),j=clamp(-speed*body.mass()/3.5,-material.friction*body.mass()*Math.abs(vn),material.friction*body.mass()*Math.abs(vn));
    body.applyImpulse(mul(t,j),true);body.applyTorqueImpulse(mul(cross(r,t),j),true);
  }
  const scatter=(material.scatter<0?material.default_scatter:material.scatter)*material.difficulty;
  if(delta>1&&scatter>1e-5){
    const a=random()*2-1,angle=a*(1-a*a)*2.59808*scatter*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);v=body.linvel();
    body.setLinvel({x:v.x*c+v.y*s,y:v.y*c-v.x*s,z:v.z},true);
  }
}
export function supportSurface(body,hit,gravity,material,radius,duration){
  const n=hit.normal,vn=dot(body.linvel(),n);if(vn>.099)return;
  const force=Math.max(0,-(dot(gravity,n)*duration+hit.vn));body.applyImpulse(mul(n,force*body.mass()),true);
  const r=mul(n,-radius),w=body.angvel(),surfVel=add(body.linvel(),cross(w,r)),slip=sub(surfVel,mul(n,dot(surfVel,n))),speed=Math.hypot(slip.x,slip.y,slip.z);
  let t,numerator;
  if(dot(body.linvel(),n)<=.025||speed<.01){
    const acceleration=add(gravity,cross(w,cross(w,r))),slipAcc=sub(acceleration,mul(n,dot(acceleration,n))),length=Math.hypot(slipAcc.x,slipAcc.y,slipAcc.z);if(length*length<.01)return;
    t=mul(slipAcc,1/length);numerator=-dot(t,acceleration)*.01;
  }else{t=mul(slip,1/speed);numerator=-dot(t,surfVel);}
  const maximum=material.friction*body.mass()*-dot(gravity,n)*.01,j=clamp(numerator*body.mass()/3.5,-maximum,maximum)*duration/.01;
  body.applyImpulse(mul(t,j),true);body.applyTorqueImpulse(mul(cross(r,t),j),true);
}
