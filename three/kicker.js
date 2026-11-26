// SPDX-License-Identifier: GPL-3.0-or-later
// Legacy KickerHitCircle, Visual Pinball contributors, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf, parts/kicker.cpp.
// See public/licenses/VPX-Physics-NOTICE.txt.
import RAPIER from '@dimforge/rapier3d-compat';
import {Trigger} from './trigger.js';
const f=Math.fround;

// Every kicker in the authored table uses legacy mode. Its hit circle has the
// same capsule and volume tests as Trigger, with a smaller capture radius.
export class Kicker extends Trigger {
  constructor(spec,height,capture,emit,{nativeDisplacements=false}={}){
    if(!spec.legacy_mode)throw Error('Nonlegacy kicker bevel geometry is required');
    super({...spec,shape:'star',radius:f(f(spec.radius)*f(spec.fall_through?.75:.6))},height,emit);
    this.spec=spec;this.capture=capture;this.captured=null;this.key=spec.name.toLowerCase();this.nativeDisplacements=nativeDisplacements;
  }
  circle(shape,p,v,r,dt,member,body){
    const capsule=p.z>shape.box.high,target=capsule?f(shape.r*f(2.6)):shape.r;
    const dx=f(p.x-shape.c.x),dy=f(p.y-shape.c.y),dz=capsule?f(p.z-f(shape.box.high-f(shape.r*f(2.4)))):0;
    const squared=f(f(f(dx*dx)+f(dy*dy))+f(dz*dz)),gap=f(f(Math.sqrt(squared))-target),speed=f(f(f(v.x*v.x)+f(v.y*v.y))+f(capsule?f(v.z*v.z):0));
    // Native deliberately recaptures a ball stalled inside the pocket even
    // when an earlier kick left that ball in this kicker's volume list.
    if(gap<=0&&gap>=-shape.r&&speed<f(f(.099)*f(.099))){this.members.delete(body);member=false;}
    return super.circle(shape,p,v,r,dt,member,body);
  }
  collide(body,hit,record){
    if(this.captured)return;
    const count=this.members.get(body)??0;if((!hit.unhit)!==(count===0))return;
    body.advanceTrigger();
    if(count){this.members.delete(body);this.emit('UnHit',record);return;}
    if(!this.spec.fall_through){
      this.members.set(body,count+1);this.captured=record;record.held=this.key;this.capture(record);
    }
    // Hit sees incoming velocity. Native then resets a captured ball even if
    // the callback destroyed it; a ball kicked by the callback stays released.
    this.emit('Hit',record);
    if(record.removed&&!record.detachedNative){
      const shape=this.shapes[0];Object.assign(record.lastState,{x:shape.c.x,y:shape.c.y,z:f(shape.box.low+rSize(record)),velx:0,vely:0,velz:0,angmomx:0,angmomy:0,angmomz:0,angvelx:0,angvely:0,angvelz:0});return;
    }
    if(record.held===this.key||this.spec.fall_through){
      const shape=this.shapes[0],z=this.spec.fall_through?f(f(shape.box.low-rSize(record))-5):f(shape.box.low+rSize(record));
      if(body.native){
        // DoCollide explicitly zeroes native velocity and angular momentum.
        // A world-space angular/linear zero can acquire negative-zero bits
        // during sign conversion. A retained, destroyed Ball is reset too.
        const state=body.native.snapshot();
        body.native.commit({...state,p:{x:shape.c.x,y:shape.c.y,z},v:{x:0,y:0,z:0},m:{x:0,y:0,z:0}});
      }else{
        body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
        body.setTranslation({x:shape.c.x*.01,y:(2115-shape.c.y)*.01,z:z*.01},true);
      }
      // Native locking suppresses integration, but contacts already collected
      // for this pass may still change velocity after capture. Rapier rejects
      // those writes on position-based kinematic bodies. The complete native
      // integrator already skips held balls; retain writable body storage.
      if(record.held&&!record.removed&&!this.nativeDisplacements)record.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    }else this.captured=null;
  }
  release(record){if(this.captured===record)this.captured=null;}
}
const rSize=record=>f(record.proxy.radius);
