// SPDX-License-Identifier: GPL-3.0-or-later
// Flipper::ApplyFix/GenerateBaseMesh, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf; see VPX-Physics-NOTICE.txt.
import {vertices,indices,circles} from './flipper-mesh-data.js';
import {meshAtan2} from './flipper-float-math.js';
const f=Math.fround,pi=f(Math.PI),halfPi=f(Math.PI*.5),twoPi=f(Math.PI*2),cos=f(Math.cos(pi)),sin=f(Math.sin(pi));
export function nativeFlipperMesh(spec,surfaceHeight=0){
  const result=new Float32Array(vertices.length*(spec.rubber_thickness>0?2:1)),length=f(spec.flipper_radius_max),height=f(surfaceHeight),thickness=f(spec.rubber_thickness);
  const fix=f(f(Math.asin(Math.max(-1,Math.min(1,f(f(f(spec.base_radius)-f(spec.end_radius))/length)))))*f(1/(Math.PI*.5)));
  for(let part=0;part<result.length/vertices.length;part++){
    const temp=vertices.slice(),base=f(f(spec.base_radius)-thickness),tip=f(f(spec.end_radius)-thickness),baseRadius=part?f(base+thickness):base,endRadius=part?f(tip+thickness):tip;
    for(let t=0;t<13;t++)for(let i=0;i<temp.length;i+=8)for(let group=0;group<4;group++){
      const circle=circles[group],j=t*3;if(temp[i]!==circle[j]||temp[i+1]!==circle[j+1]||temp[i+2]!==circle[j+2])continue;
      const center=circles[group<2?0:2],mid=group<2?-halfPi:halfPi,radius=group<2?baseRadius:endRadius;
      let angle=meshAtan2(f(temp[i+1]-center[1]),f(temp[i]-center[18]));if(mid<0&&angle>0)angle=f(angle-twoPi);else if(mid>=0&&angle<0)angle=f(angle+twoPi);
      angle=f(angle-f(f(f(angle-mid)*fix)*(mid<0?-1:1)));
      temp[i]=f(f(Math.cos(angle))*radius);temp[i+1]=f(f(f(Math.sin(angle))*radius)+(group<2?0:length));
    }
    for(let i=0;i<temp.length;i+=8){const o=part*vertices.length+i;
      result[o]=f(f(cos*temp[i])-f(sin*temp[i+1]));result[o+1]=f(f(sin*temp[i])+f(cos*temp[i+1]));result[o+2]=part?f(f(temp[i+2]*f(spec.rubber_width))+f(height+f(spec.rubber_height))):f(f(temp[i+2]*f(spec.height))+height);
      result[o+3]=f(f(f(cos*vertices[i+3])+f(-sin*vertices[i+4]))+f(0*vertices[i+5]));result[o+4]=f(f(f(sin*vertices[i+3])+f(cos*vertices[i+4]))+f(0*vertices[i+5]));result[o+5]=f(f(f(0*vertices[i+3])+f(0*vertices[i+4]))+vertices[i+5]);result[o+6]=vertices[i+6];result[o+7]=part?f(vertices[i+7]+f(.5)):vertices[i+7];
    }
  }
  return{vertices:result,indices};
}
