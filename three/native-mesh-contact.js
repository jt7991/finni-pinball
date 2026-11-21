// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' collide.cpp/collideex.cpp, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {f,add,sub,mul,div,dot,cross,length,unit,nativeNormal} from './native-vector.js';
const position=p=>({x:f(p.x*100),y:f(2115-p.y*100),z:f(p.z*100)});
export const nativeMeshQuery=(p,v,radius,duration)=>({p:position(p),v:{x:f(v.x),y:f(-v.y),z:f(v.z)},r:f(radius*100),dt:f(duration*100)});
const valid=(t,dt)=>Number.isFinite(t)&&t>=0&&!Object.is(t,-0)&&t<=dt;
const transform=(m,v)=>({x:dot(m[0],v),y:dot(m[1],v),z:dot(m[2],v)});
function lineMatrix(direction){
  let axis={x:direction.y,y:-direction.x,z:0};const squared=dot(axis,axis);
  axis=squared<=f(1e-6)?{x:1,y:0,z:0}:div(axis,f(Math.sqrt(squared)));
  const {x,y,z}=axis,c=direction.z,s=-f(Math.sqrt(f(1-f(c*c)))),t=f(1-c),xx=f(x*x),yy=f(y*y),zz=f(z*z),xy=f(f(x*y)*t),zx=f(f(z*x)*t),yz=f(f(y*z)*t);
  return [{x:f(xx+f(c*f(1-xx))),y:f(xy+f(z*s)),z:f(zx-f(y*s))},{x:f(xy-f(z*s)),y:f(yy+f(c*f(1-yy))),z:f(yz+f(x*s))},{x:f(zx+f(y*s)),y:f(yz-f(x*s)),z:f(zz+f(c*f(1-zz)))}];
}
function shapeData(s){
  if(s.native)return s.native;
  const n={kind:s.kind,a:s.a?position(s.a):null};
  if(s.kind==='triangle'){
    n.points=s.points.map(position);n.ab=sub(n.points[1],n.points[0]);n.ac=sub(n.points[2],n.points[0]);
    const raw=cross(n.ab,n.ac);if(dot(raw,raw)<f(.01))n.degenerate=true;
    else{n.n=unit(raw);if(dot(n.n,nativeNormal(s.n))<0)n.n=mul(n.n,-1);}
  }else if(s.kind==='polygon'){
    n.points=s.points.map(position);let raw={x:0,y:0,z:0};
    for(let i=0;i<n.points.length;i++){const a=n.points[i],b=n.points[(i+1)%n.points.length];raw=add(raw,{x:f(f(a.y-b.y)*f(a.z+b.z)),y:f(f(a.z-b.z)*f(a.x+b.x)),z:f(f(a.x-b.x)*f(a.y+b.y))});}
    if(dot(raw,raw)===0)n.degenerate=true;else{n.n=unit(raw);if(dot(n.n,nativeNormal(s.n))<0)n.n=mul(n.n,-1);}
  }else if(s.kind==='wall'){
    const b=position(s.points[1]),d=sub(n.a,b),len=length({...d,z:0}),inverse=f(1/len);
    n.n={x:f(d.y*inverse),y:f(-d.x*inverse),z:0};n.length=len;n.low=f(s.low*100);n.high=f(s.high*100);
  }else if(s.kind==='plane'){n.n=nativeNormal(s.normal);n.d=f(s.d*100-s.normal.y*2115);}
  else{
    if(s.axis){
      const b=s.kind==='circle'?add(n.a,mul(nativeNormal(s.axis),f(s.length*100))):position(s.points[1]),d=sub(b,n.a);n.length=length(d);n.axis=unit(d);
      if(s.kind==='edge'){
        n.matrix=lineMatrix(n.axis);const a=transform(n.matrix,n.a),endZ=transform(n.matrix,b).z;
        n.xy={x:a.x,y:a.y,z:0};n.low=Math.min(a.z,endZ);n.high=Math.max(a.z,endZ);
      }
    }
    n.radius=f((s.radius??0)*100);
  }
  s.native=n;return n;
}
export function nativeMeshHit(shape,worldP,worldV,radius,duration,query){
  const s=shapeData(shape);if(s.degenerate)return null;
  const {p,v,r,dt}=query??nativeMeshQuery(worldP,worldV,radius,duration);
  let time=0,contact=false,gap,vn,normal=s.n;
  if(['triangle','polygon','wall','plane'].includes(s.kind)){
    vn=dot(v,normal);if(vn>f(s.kind==='triangle'||s.kind==='plane'?.099:.0001))return null;
    const nearest=sub(p,mul(normal,r)),difference=s.kind==='plane'?dot(p,normal):dot(sub(nearest,s.a),normal);
    gap=s.kind==='plane'?f(f(difference-r)-s.d):difference;
    if(gap< -f(s.kind==='plane'?r*2:r)||s.kind==='wall'&&f(gap+r)<0)return null;
    if(s.kind==='plane'){
      if(Math.abs(vn)<=f(.099)){if(Math.abs(gap)>f(.05))return null;contact=true;}
      else time=Math.max(0,f(gap/-vn));
    }else if(gap<=f(.05)){
      if(s.kind==='triangle'&&Math.abs(vn)<=f(.099))contact=true;
      else if(s.kind==='triangle')time=gap<=0?0:f(gap/-vn);
      else time=gap<=0||Math.abs(vn)>f(.099)?0:f(f(gap*10)+f(.5));
    }else if(Math.abs(vn)>f(.0001))time=f(gap/-vn);else return null;
    if(!valid(time,dt))return null;
    const at=add(nearest,mul(v,time));
    if(s.kind==='wall'){
      const d=sub(p,s.a),along=f(f(f(d.x*normal.y)-f(d.y*normal.x))+f(f(f(v.x*normal.y)-f(v.y*normal.x))*time)),z=f(p.z+f(v.z*time));
      if(along<0||along>s.length||f(z+f(r*.5))<s.low||f(z-f(r*.5))>s.high)return null;
      contact=Math.abs(vn)<=f(.099)&&Math.abs(gap)<=f(.05);
    }else if(s.kind==='triangle'){
      const d=sub(at,s.a),aa=dot(s.ac,s.ac),ab=dot(s.ac,s.ab),ad=dot(s.ac,d),bb=dot(s.ab,s.ab),bd=dot(s.ab,d),inverse=f(1/f(f(aa*bb)-f(ab*ab))),u=f(f(f(bb*ad)-f(ab*bd))*inverse),w=f(f(f(aa*bd)-f(ab*ad))*inverse);
      if(u<0||w<0||f(u+w)>1)return null;
    }else if(s.kind==='polygon'){
      let crossings=0;
      for(let i=0;i<s.points.length;i++){
        const a=s.points[i],b=s.points[(i+1)%s.points.length],hx1=at.x>=a.x,hx2=at.x>=b.x,hy1=at.y<=a.y,hy2=at.y<=b.y;
        if(a.y===b.y||hy1===hy2||hx1&&hx2)continue;
        if(!hx1&&!hx2){crossings^=1;continue;}if(a.x===b.x){if(!hx2)crossings^=1;continue;}
        if(f(b.x-f(f(f(b.y-at.y)*f(a.x-b.x))/f(a.y-b.y)))>at.x)crossings^=1;
      }
      if(!crossings)return null;
    }
  }else{
    let d=sub(p,s.a),dv=v,localP,localV;const total=f(r+s.radius);
    if(s.matrix){localP=transform(s.matrix,p);localV=transform(s.matrix,v);d={x:f(localP.x-s.xy.x),y:f(localP.y-s.xy.y),z:0};dv={...localV,z:0};}
    else if(s.axis){d=sub(d,mul(s.axis,dot(d,s.axis)));dv=sub(v,mul(s.axis,dot(v,s.axis)));}
    const squared=dot(d,d),distance=f(Math.sqrt(squared));if(distance<=f(1e-6))return null;
    const b=dot(d,dv);vn=f(b/distance);gap=f(distance-total);if(vn>f(s.kind==='circle'?.0001:.099)||s.kind==='circle'&&gap< -r)return null;
    if(gap<f(.05)){if(Math.abs(vn)<=f(.099))contact=true;else time=s.axis&&s.kind!=='circle'?f(-gap/vn):Math.max(0,f(-gap/vn));}
    else{
      const a=dot(dv,dv);if(a<f(1e-8))return null;
      const bb=f(2*b),c=f(squared-f(total*total)),disc=f(f(bb*bb)-f(f(4*a)*c));if(disc<0)return null;
      const root=f(Math.sqrt(disc)),inverse=f(-.5/a),t1=f(f(bb+root)*inverse),t2=f(f(bb-root)*inverse);time=f(t1*t2)<0?Math.max(t1,t2):Math.min(t1,t2);
    }
    if(!valid(time,dt))return null;
    if(s.matrix){const z=f(localP.z+f(localV.z*time));if(z<s.low||z>s.high)return null;}
    else if(s.axis){const at=add(p,mul(v,time)),along=dot(sub(at,s.a),s.axis),skin=s.kind==='circle'?f(r*.5):0;if(along< -skin||along>f(s.length+skin))return null;}
    normal=unit(add(d,mul(dv,time)));
    if(s.matrix)normal={x:f(f(f(s.matrix[0].x*normal.x)+f(s.matrix[1].x*normal.y))+f(s.matrix[2].x*normal.z)),y:f(f(f(s.matrix[0].y*normal.x)+f(s.matrix[1].y*normal.y))+f(s.matrix[2].y*normal.z)),z:f(f(f(s.matrix[0].z*normal.x)+f(s.matrix[1].z*normal.y))+f(s.matrix[2].z*normal.z))};
  }
  return {time:time*.01,gap:gap*.01,vn,contact,normal:{x:normal.x,y:-normal.y,z:normal.z}};
}
