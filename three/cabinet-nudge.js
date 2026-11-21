// SPDX-License-Identifier: GPL-3.0-or-later
// VPX CabinetPhysics / CabModelKeyboardNudge, Visual Pinball contributors at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
const metersToWorld=1/(.0254*1.0625/50)/100;
export class CabinetNudge {
  constructor(strength=1){
    this.strength=strength;this.impulses=[];this.activeMilliseconds=0;
    this.axes=[{frequency:9.3,damping:.052,position:0,velocity:0},{frequency:5.8,damping:.055,position:0,velocity:0}];
    this.acceleration={x:0,y:0};this.offset={x:0,y:0};
  }
  nudge(angle,force){
    const a=angle*Math.PI/180,strength=force*this.strength*.5*9.80665/2;
    this.impulses.push({ms:0,x:Math.sin(a)*strength,y:-Math.cos(a)*strength});
    this.activeMilliseconds=10000;
  }
  step(slope){
    if(this.activeMilliseconds)this.activeMilliseconds--;
    let x=0,y=0;
    for(const impulse of this.impulses){
      impulse.ms++;
      if(impulse.ms<=25){const factor=.5*(1-Math.cos(2*Math.PI*impulse.ms/25));x+=impulse.x*factor;y+=impulse.y*factor;}
    }
    this.impulses=this.impulses.filter(i=>i.ms<=25);
    const accelerations=[];
    for(const [i,force]of [x,y].entries()){
      const a=this.axes[i],omega=2*Math.PI*a.frequency;
      const acceleration=force-2*a.damping*omega*a.velocity-omega*omega*a.position;
      a.velocity+=acceleration*.001;a.position+=a.velocity*.001;accelerations.push(acceleration);
    }
    this.acceleration={x:accelerations[0],y:accelerations[1]};
    this.offset={x:this.axes[0].position*3.5*metersToWorld,y:-this.axes[1].position*2*metersToWorld};
    if(!this.activeMilliseconds){this.acceleration={x:0,y:0};this.offset={x:0,y:0};return {x:0,y:0,z:0};}
    // Cabinet acceleration is horizontal; project the fictitious force onto
    // the inclined playfield. Static contacts still use gravity alone in VPX.
    return {x:-accelerations[0]*metersToWorld,y:accelerations[1]*Math.cos(slope)*metersToWorld,z:-accelerations[1]*Math.sin(slope)*metersToWorld};
  }
}
