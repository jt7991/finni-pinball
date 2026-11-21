// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' CatmullCurve/GetRgVertex/RecurseSmoothLine,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {f,sub,dot,cross} from './native-vector.js';
export function nativeDragCurve(raw,loop=false,accuracy=400,dimensions=3){
  const points=raw.map(p=>({...p,x:f(p.x),y:f(p.y),z:f(p.z??0)})),count=points.length,result=[];
  if(count<2)return points;
  const at=i=>points[loop?(i+count)%count:Math.max(0,Math.min(count-1,i))],keys=dimensions===2?['x','y']:['x','y','z'];
  const parameter=(a,b)=>{const d=sub(a,b);if(dimensions===2)d.z=0;return f(Math.sqrt(f(Math.sqrt(dot(d,d)))));};
  for(let i=0;i<(loop?count:count-1);i++){
    const a=at(i),b=at(i+1);if(a.x===b.x&&a.y===b.y&&a.z===b.z)continue;
    const p=at(a.smooth?i-1:i),q=at(b.smooth?i+2:i+1);let d0=parameter(p,a),d1=parameter(a,b),d2=parameter(b,q);
    if(d1<f(.0001))d1=1;if(d0<f(.0001))d0=d1;if(d2<f(.0001))d2=d1;
    const coefficients={};
    for(const key of keys){
      const x0=p[key],x1=a[key],x2=b[key],x3=q[key];
      const t1=f(f(f(f(f(x1-x0)/d0)-f(f(x2-x0)/f(d0+d1)))+f(f(x2-x1)/d1))*d1);
      const t2=f(f(f(f(f(x2-x1)/d1)-f(f(x3-x1)/f(d1+d2)))+f(f(x3-x2)/d2))*d1);
      coefficients[key]=[x1,t1,f(f(f(f(-3*x1)+f(3*x2))-f(2*t1))-t2),f(f(f(f(2*x1)-f(2*x2))+t1)+t2)];
    }
    const evaluate=t=>{
      const t2=f(t*t),t3=f(t2*t),point={z:0,smooth:true,slingshot:false,controlPoint:false};
      for(const key of keys){const c=coefficients[key];point[key]=f(f(f(f(c[3]*t3)+f(c[2]*t2))+f(c[1]*t))+c[0]);}
      return point;
    };
    const recurse=(t1,t2,start,end,depth=0)=>{
      const middleTime=f(f(t1+t2)*.5),middle=evaluate(middleTime),u=sub(middle,start),v=sub(end,start);
      const area=dimensions===2?f(f(f(u.x*v.y)-f(v.x*u.y))**2):dot(cross(u,v),cross(u,v));
      if(area<accuracy||depth>=32)result.push({...start});
      else{recurse(t1,middleTime,start,middle,depth+1);recurse(middleTime,t2,middle,end,depth+1);}
    };
    recurse(0,1,{...a,slingshot:a.slingshot??a.is_slingshot,controlPoint:true},b);
  }
  if(!loop)result.push({...points.at(-1),smooth:true,slingshot:false,controlPoint:false});
  return result;
}
