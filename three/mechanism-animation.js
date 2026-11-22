// SPDX-License-Identifier: GPL-3.0-or-later
// Trigger::UpdateAnimation and Bumper::UpdateAnimation/UpdateSkirt,
// Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
import {nativeFloatAtan} from './native-float-math.js';
const f=Math.fround;
export class TriggerAnimation{
 constructor(spec,collider,emit){this.spec=spec;this.collider=collider;this.emit=emit;this.offset=0;this.hitPending=false;this.unhitPending=false;this.moving=false;this.down=false;}
 hit(unhit=false){if(unhit)this.unhitPending=true;else this.hitPending=true;}
 update(milliseconds){
  const limit=this.spec.shape==='star'?f(f(this.spec.radius)*f(1/5)):this.spec.shape==='button'?f(f(this.spec.radius)*f(1/10)):this.spec.shape==='wire_c'?60:['wire_d','inder'].includes(this.spec.shape)?25:32;
  if(this.hitPending){this.moving=true;this.hitPending=false;this.offset=0;this.down=true;}
  if(this.unhitPending){this.moving=true;this.unhitPending=false;this.hitPending=false;this.offset=limit;this.down=false;}
  if(!this.moving)return;
  let step=f(f(milliseconds)*f(this.spec.anim_speed));if(this.down)step=-step;this.offset=f(this.offset+step);
  if(this.down&&this.offset<=-limit){this.offset=-limit;this.moving=false;this.down=false;}
  else if(!this.down&&this.offset>=0){this.offset=0;this.moving=false;this.down=true;}
  this.emit();
 }
 snapshot(){return{offset:this.offset};}
}
export class BumperAnimation{
 constructor(spec,collider,emit){this.spec=spec;this.collider=collider;this.emit=emit;this.hitPending=true;this.hitPosition={x:0,y:0};this.ringOffset=0;this.ringMoving=false;this.ringDown=false;this.rotx=0;this.roty=0;this.skirtMoving=false;this.skirtTime=0;this.enableSkirt=true;this.resetSkirt=false;}
 hit(position){this.hitPending=true;if(position)this.hitPosition={x:f(position.x),y:f(position.y)};}
 setSkirtEnabled(value){value=!!value;if(this.enableSkirt!==value){if(!value)this.resetSkirt=true;this.enableSkirt=value;}}
 tilt(active){
  this.rotx=this.roty=0;if(!active)return;
  let dy=Math.abs(f(this.hitPosition.y-f(this.spec.center.y)));if(dy===0)dy=f(.000001);
  const dx=Math.abs(f(this.hitPosition.x-f(this.spec.center.x))),angle=nativeFloatAtan(f(dx/dy));
  this.rotx=f(f(Math.cos(angle))*5);this.roty=f(f(Math.sin(angle))*5);
  if(f(this.spec.center.y)<this.hitPosition.y)this.rotx=-this.rotx;if(f(this.spec.center.x)>this.hitPosition.x)this.roty=-this.roty;
 }
 update(milliseconds){
  const hit=this.hitPending;this.hitPending=false;
  const limit=f(f(this.spec.ring_drop_offset)+f(f(this.spec.height_scale)*f(.5)));
  if(hit){this.ringMoving=true;this.ringDown=true;}
  if(this.ringMoving){const step=this.ringDown?-f(this.spec.ring_speed):f(this.spec.ring_speed);this.ringOffset=f(this.ringOffset+f(step*f(milliseconds)));
   if(this.ringDown&&this.ringOffset<=-limit){this.ringOffset=-limit;this.ringDown=false;}
   else if(!this.ringDown&&this.ringOffset>=0){this.ringOffset=0;this.ringMoving=false;}
  }
  this.emit();
  if(this.enableSkirt){
   if(hit){this.skirtMoving=true;this.tilt(true);this.skirtTime=0;}
   if(this.skirtMoving){this.skirtTime=f(this.skirtTime+f(milliseconds));if(this.skirtTime>160){this.skirtMoving=false;this.tilt(false);}this.emit();}
  }else if(this.resetSkirt){this.resetSkirt=false;this.tilt(false);this.emit();}
 }
 snapshot(){return{ringOffset:this.ringOffset,rotx:this.rotx,roty:this.roty};}
}
