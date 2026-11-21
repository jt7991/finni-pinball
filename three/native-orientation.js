// SPDX-License-Identifier: GPL-3.0-or-later
// HitBall::UpdateDisplacements and Matrix3::OrthoNormalize, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {f,cross,unit,div} from './native-vector.js';

export class NativeOrientation {
  constructor(){this.matrix=new Float32Array([1,0,0,0,1,0,0,0,1]);this.scratch=new Float32Array(9);this.quaternion={x:0,y:0,z:0,w:1};this.dirty=true;}
  set(values){this.matrix.set(values);this.dirty=true;}
  advance(momentum,inertia,duration){
    const {x,y,z}=div(momentum,inertia),dt=f(duration*100),m=this.matrix,next=this.scratch;
    // Scalar wasm32 float multiply/add order, including zero entries in the
    // skew matrix. Do not replace this with a quaternion/exponential step.
    const skew=[0,-z,y,z,0,-x,-y,x,0];
    for(let row=0;row<3;row++)for(let column=0;column<3;column++){
      const value=f(f(f(skew[row*3]*m[column])+f(skew[row*3+1]*m[3+column]))+f(skew[row*3+2]*m[6+column]));
      next[row*3+column]=f(m[row*3+column]+f(value*dt));
    }
    const first={x:next[0],y:next[3],z:next[6]},second={x:next[1],y:next[4],z:next[7]},third=unit(cross(first,second)),normalizedFirst=unit(first),normalizedSecond=cross(third,normalizedFirst);
    for(const [column,v]of [normalizedFirst,normalizedSecond,third].entries()){m[column]=v.x;m[3+column]=v.y;m[6+column]=v.z;}
    this.dirty=true;
  }
  rotation(){
    if(!this.dirty)return this.quaternion;
    // Reflect both basis and coordinates from VPX's downward table Y into the
    // Three.js world. The orientation matrix remains the authoritative state.
    const m=this.matrix,a=m[0],b=-m[1],c=m[2],d=-m[3],e=m[4],g=-m[5],h=m[6],i=-m[7],j=m[8],trace=a+e+j;
    let x,y,z,w;
    if(trace>0){const s=.5/Math.sqrt(trace+1);w=.25/s;x=(i-g)*s;y=(c-h)*s;z=(d-b)*s;}
    else if(a>e&&a>j){const s=2*Math.sqrt(1+a-e-j);w=(i-g)/s;x=.25*s;y=(b+d)/s;z=(c+h)/s;}
    else if(e>j){const s=2*Math.sqrt(1+e-a-j);w=(c-h)/s;x=(b+d)/s;y=.25*s;z=(g+i)/s;}
    else{const s=2*Math.sqrt(1+j-a-e);w=(d-b)/s;x=(c+h)/s;y=(g+i)/s;z=.25*s;}
    const inverse=1/Math.hypot(x,y,z,w);Object.assign(this.quaternion,{x:x*inverse,y:y*inverse,z:z*inverse,w:w*inverse});this.dirty=false;return this.quaternion;
  }
}
