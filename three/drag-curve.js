// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' MeshUtils.h / IHaveDragPoints::GetRgVertex,
// adapted to .01 VPU positions. See public/licenses/VPX-Physics-NOTICE.txt.
export function dragCurve(points,loop=false,accuracy=400){
  const result=[],count=points.length,end=loop?count:count-1,at=i=>points[loop?(i+count)%count:Math.max(0,Math.min(count-1,i))];
  for(let i=0;i<end;i++){
    const a=at(i),b=at(i+1),p=at(a.smooth?i-1:i),q=at(b.smooth?i+2:i+1);
    if(a.x===b.x&&a.y===b.y&&a.z===b.z)continue;
    const distance=(u,v)=>Math.sqrt(Math.hypot(u.x-v.x,u.y-v.y,(u.z??0)-(v.z??0)));
    let d1=distance(a,b);if(d1<.00001)d1=.1;
    let d0=distance(p,a),d2=distance(b,q);if(d0<.00001)d0=d1;if(d2<.00001)d2=d1;
    const coeff={};
    for(const k of ['x','y','z']){
      const x0=p[k]??0,x1=a[k]??0,x2=b[k]??0,x3=q[k]??0;
      const t1=((x1-x0)/d0-(x2-x0)/(d0+d1)+(x2-x1)/d1)*d1;
      const t2=((x2-x1)/d1-(x3-x1)/(d1+d2)+(x3-x2)/d2)*d1;
      coeff[k]=[x1,t1,-3*x1+3*x2-2*t1-t2,2*x1-2*x2+t1+t2];
    }
    const point=t=>Object.fromEntries(['x','y','z'].map(k=>{const c=coeff[k];return [k,c[0]+t*(c[1]+t*(c[2]+t*c[3]))];}));
    const recurse=(t0,t1,start,finish,depth=0)=>{
      const t=(t0+t1)*.5,middle=point(t),u={x:middle.x-start.x,y:middle.y-start.y,z:middle.z-(start.z??0)},v={x:finish.x-start.x,y:finish.y-start.y,z:(finish.z??0)-(start.z??0)};
      const area=(u.y*v.z-u.z*v.y)**2+(u.z*v.x-u.x*v.z)**2+(u.x*v.y-u.y*v.x)**2;
      if(area<accuracy*1e-8||depth>=20)result.push({...start});
      else{recurse(t0,t,start,middle,depth+1);recurse(t,t1,middle,finish,depth+1);}
    };
    recurse(0,1,a,b);
  }
  if(!loop)result.push({...points.at(-1)});
  return result;
}
