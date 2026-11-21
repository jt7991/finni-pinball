// SPDX-License-Identifier: GPL-3.0-or-later
// Flipper angular-momentum integration from Visual Pinball hitflipper.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export function nativeFlipperInertia(mass,length){return f(f(f(1/3)*f(mass))*f(f(length)*f(length)));}
export class NativeAngular {
  constructor(body,inertia){
    this.rapier=body;this.inertia=inertia;this.momentum=0;this.speed=0;
    this.body={angvel:()=>({x:0,y:0,z:this.speed*100}),applyTorqueImpulse:impulse=>this.impulse(impulse.z)};
  }
  publish(){this.speed=f(this.momentum/this.inertia);this.rapier.setAngvel({x:0,y:0,z:this.speed*100},true);}
  impulse(worldImpulse){this.momentum=f(this.momentum+f(worldImpulse*100));this.publish();}
  torque(value){this.momentum=f(this.momentum+f(value*f(.1)));this.publish();}
  stop(){this.momentum=0;this.publish();}
  bounce(){this.momentum=f(this.momentum*f(-.3));this.publish();}
}
