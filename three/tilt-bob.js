// SPDX-License-Identifier: GPL-3.0-or-later
// VPX PlumbHandler angular pendulum, pinned revision 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {f,add,sub,mul,div,dot,cross,length} from './native-vector.js';
import {meshAtan2 as atan2} from './flipper-float-math.js';
export class TiltBob {
  constructor(onChange=()=>{},{enabled=true,damping=1,thresholdDegrees=1}={}){
    this.enabled=enabled;this.pole=f(.1);this.damping0=f(f(1.25)*f(damping));this.damping1=f(f(.75)*f(damping));this.threshold=f(f(thresholdDegrees)*f(Math.PI/180));
    this.position={x:0,y:0,z:-this.pole};this.omega={x:0,y:0,z:0};this.high=false;this.index=0;this.percent=0;this.onChange=onChange;
  }
  step(acceleration){
    if(!this.enabled||this.threshold<=0)return;
    // Exact equilibrium remains unchanged by the native integration.
    if(acceleration.x===0&&acceleration.y===0&&this.position.x===0&&this.position.y===0&&this.position.z===-this.pole&&this.omega.x===0&&this.omega.y===0&&this.omega.z===0){this.percent=0;if(this.high){this.high=false;this.onChange(false);}return;}
    const dt=f(.001),square=f(this.pole*this.pole);let axis=div(this.position,this.pole);
    const force={x:f(-acceleration.x),y:f(-acceleration.y),z:f(-9.80665)},torque=cross(this.position,force),damping=f(this.damping0+f(this.damping1*length(this.omega))),alpha=sub(div(torque,square),mul(this.omega,damping));
    this.omega=add(this.omega,mul(alpha,dt));this.omega=sub(this.omega,mul(axis,dot(this.omega,axis)));
    this.position=add(this.position,mul(cross(this.omega,this.position),dt));const size=length(this.position);
    this.position=size>f(1e-8)?mul(this.position,f(this.pole/size)):{x:0,y:0,z:-this.pole};axis=div(this.position,this.pole);this.omega=sub(this.omega,mul(axis,dot(this.omega,axis)));
    const psi=atan2(f(Math.sqrt(f(f(this.position.x*this.position.x)+f(this.position.y*this.position.y)))),-this.position.z);this.percent=f(f(100*psi)/this.threshold);const high=this.percent>100;
    if(high){
      const limit=f(this.threshold-f(.001)),xy=f(this.pole*f(Math.sin(limit))),theta=atan2(this.position.x,this.position.y);
      this.position={x:f(xy*f(Math.sin(theta))),y:f(xy*f(Math.cos(theta))),z:f(-this.pole*f(Math.cos(limit)))};
      const velocity=cross(this.omega,this.position),reflected=sub(velocity,mul(axis,f(2*dot(velocity,axis))));this.omega=mul(div(cross(this.position,reflected),square),f(.8));
    }
    if(high!==this.high){this.high=high;if(high)this.index++;this.onChange(high);}
  }
}
