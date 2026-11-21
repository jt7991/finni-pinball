// SPDX-License-Identifier: GPL-3.0-or-later
// VPX CabinetPhysics / CabModelKeyboardNudge, Visual Pinball contributors at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
const metersToWorld=1/(.0254*1.0625/50)/100;
const f=Math.fround,mass=113,seconds=f(.001),metresToVPU=f(50/(.0254*1.0625));
const oscillator=(frequency,damping)=>{
  const omega=f(f(2*Math.PI)*f(frequency));
  return {spring:f(f(mass*omega)*omega),damping:f(f(2*f(damping))*f(mass*omega)),position:0,velocity:0};
};
export class CabinetNudge {
  constructor(strength=1){
    this.strength=strength;this.impulses=[];this.activeMilliseconds=0;
    this.axes=[oscillator(9.3,.052),oscillator(5.8,.055)];
    this.acceleration={x:0,y:0};this.offset={x:0,y:0};
  }
  nudge(angle,force){
    const a=f(f(angle)*f(Math.PI/180)),strength=f(f(f(force)*f(this.strength))*f(f(.5*f(9.80665))/2));
    this.impulses.push({ms:0,x:f(f(Math.sin(a))*strength),y:f(-f(Math.cos(a))*strength)});
    this.activeMilliseconds=10000;
  }
  step(slope){
    if(this.activeMilliseconds)this.activeMilliseconds--;
    let x=0,y=0;
    for(const impulse of this.impulses){
      impulse.ms++;
      if(impulse.ms<=25){const phase=f(f(2*Math.PI)*f(impulse.ms/25)),factor=f(1-f(Math.cos(phase)));x=f(x+f(f(impulse.x*.5)*factor));y=f(y+f(f(impulse.y*.5)*factor));}
    }
    this.impulses=this.impulses.filter(i=>i.ms<=25);
    const accelerations=[];
    for(const [i,force]of [x,y].entries()){
      const a=this.axes[i],acceleration=f(f(f(f(mass*force)-f(a.damping*a.velocity))-f(a.spring*a.position))/mass);
      a.velocity=f(a.velocity+f(acceleration*seconds));a.position=f(a.position+f(a.velocity*seconds));accelerations.push(acceleration);
    }
    this.acceleration={x:accelerations[0],y:accelerations[1]};
    this.offset={x:f(this.axes[0].position*3.5)*metersToWorld,y:-f(this.axes[1].position*2)*metersToWorld};
    if(!this.activeMilliseconds){this.acceleration={x:0,y:0};this.offset={x:0,y:0};return {x:0,y:0,z:0};}
    // Cabinet acceleration is horizontal; project the fictitious force onto
    // the inclined playfield. Static contacts still use gravity alone in VPX.
    const convert=a=>f(f(a*metresToVPU)*f(f(.01)*f(.01))),dx=f(f(.1)*convert(accelerations[0])),dy=f(f(.1)*convert(accelerations[1])),cos=f(Math.cos(slope)),sin=f(Math.sin(slope));
    return {x:-accelerations[0]*metersToWorld,y:accelerations[1]*cos*metersToWorld,z:-accelerations[1]*sin*metersToWorld,nativeDelta:{x:-dx,y:-f(dy*cos),z:-f(dy*sin)}};
  }
}
