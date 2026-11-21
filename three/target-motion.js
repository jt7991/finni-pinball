// SPDX-License-Identifier: GPL-3.0-or-later
// Drop-target state and animation from Visual Pinball parts/hittarget.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export class TargetMotion {
  constructor(spec,collider,clock,emit){
    this.spec=spec;this.collider=collider;this.clock=clock;this.emit=emit;
    this.dropped=!!spec.is_dropped;this.collidable=!!spec.is_collidable;this.offset=this.dropped?-52:0;this.moving=false;this.down=false;this.waitUntil=0;this.ball=null;
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
    this.down=true;this.moving=true;this.ball=ball;return true;
  }
  update(milliseconds){
    if(!this.moving||!this.spec.is_visible)return;
    let step=f(this.spec.drop_speed);if(this.down)step=-step;else if(this.clock()<this.waitUntil)step=0;
    this.offset=f(this.offset+f(step*milliseconds));
    if(this.down?this.offset<=-52:this.offset>=0){
      const down=this.down;this.offset=down?-52:0;this.dropped=down;this.down=false;this.moving=false;this.refresh();
      if(this.spec.use_hit_event)this.emit(down?'Dropped':'Raised',this.ball);
    }
  }
}
