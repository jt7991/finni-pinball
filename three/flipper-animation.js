// SPDX-License-Identifier: GPL-3.0-or-later
// Flipper::UpdateAnimation, Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
export class FlipperAnimation {
  constructor(spec,angle,emit){this.spec=spec;this.angle=angle;this.emit=emit;this.previous=123486;}
  update(){const angle=this.angle();if(this.previous!==angle){this.previous=angle;this.emit();}}
}
