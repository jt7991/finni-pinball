// SPDX-License-Identifier: GPL-3.0-or-later
// Target state and animation from Visual Pinball parts/hittarget.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export class TargetMotion {
  constructor(spec,collider,clock,emit){
    this.revision=0;this.spec=spec;this.collider=collider;this.clock=clock;this.emit=emit;
    this.drop=spec.target_type?.startsWith('drop')??true;
    this.dropped=!!spec.is_dropped;this.collidable=!!spec.is_collidable;this.fireEvents=!!spec.use_hit_event;this.visible=!!spec.is_visible;this.offset=this.drop&&this.dropped?-52:0;this.moving=false;this.down=!(this.drop&&this.dropped);this.hitPending=false;this.waitUntil=0;this.ball=null;
    this.refresh();
  }
  refresh(){this.collider.setEnabled(this.collidable&&!this.dropped);}
  setCollidable(value){this.collidable=!!value;this.refresh();}
  setDropped(value,ball){
    const dropped=!!value;if(dropped===this.dropped)return;
    this.dropped=dropped;this.down=dropped;this.offset=dropped?0:-52;this.moving=true;this.ball=ball;
    if(!dropped)this.waitUntil=this.clock()+(this.spec.raise_delay??0);
    this.refresh();
  }
  hit(ball){
    if(this.dropped||!this.spec.use_hit_event)return false;
    this.hitPending=true;this.ball=ball;return true;
  }
  update(milliseconds){
    if(!this.visible)return;
    // Collision arms a hit; native UpdateAnimation consumes it after script
    // setters, at the next visible frame. Hidden targets retain the pending hit.
    if(this.hitPending){if(!this.dropped)this.down=true;this.moving=true;this.hitPending=false;}
    if(!this.moving)return;
    if(!this.drop){
      const step=this.down?f(this.spec.drop_speed):-f(this.spec.drop_speed);
      this.offset=f(this.offset+f(step*milliseconds));
      if(this.down){if(this.offset>=13){this.offset=13;this.down=false;}}
      else if(this.offset<=0){this.offset=0;this.moving=false;}
      this.revision++;this.emit('Animate',this.ball);return;
    }
    let step=f(this.spec.drop_speed);if(this.down)step=-step;else if(this.clock()<this.waitUntil)step=0;
    this.offset=f(this.offset+f(step*milliseconds));
    if(this.down?this.offset<=-52:this.offset>=0){
      const down=this.down;this.offset=down?-52:0;this.dropped=down;this.down=false;this.moving=false;this.refresh();
      if(this.fireEvents)this.emit(down?'Dropped':'Raised',this.ball);
    }
    this.revision++;this.emit('Animate',this.ball);
  }
}
