// SPDX-License-Identifier: GPL-3.0-or-later
// Resting-ball spin heuristic from Visual Pinball PhysicsEngine.cpp, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
export class BallSpin {
  constructor(){this.states=new WeakMap();}
  state(body){
    let state=this.states.get(body);
    if(!state){state={positions:Array(10),gap:0};this.states.set(body,state);}
    return state;
  }
  impact(body,gap){this.state(body).gap=gap;}
  apply(body,ms){
    const state=this.state(body);if(state.gap>=.0005)return;
    const index=offset=>((Math.floor((ms-offset)/10)%10)+10)%10;
    const a=state.positions[index(90)],b=state.positions[index(80)];if(!a||!b)return;
    if(body.native){
      const f=Math.fround,native=body.native,p=native.sync();native.syncAngular();const m=native.angularMomentum;
      const distance=q=>{const dx=f(f(q.x*100)-p.x),dy=f(f(2115-q.y*100)-p.y);return f(f(dx*dx)+f(dy*dy));};
      const threshold=f(f(f(m.x*m.x)+f(m.y*m.y))/Math.max(distance(a),distance(b)));
      if(Number.isFinite(threshold)&&threshold>666)native.dampAngular(Math.max(f(.23),Math.min(1,f(1-f(f(threshold-666)/10000)))));
      return;
    }
    const p=body.translation(),w=body.angvel(),distance=q=>(q.x-p.x)**2+(q.y-p.y)**2;
    // Native angular momentum is 2.5 * mass * world angular velocity; native
    // squared travel is 10000 times the squared distance in these world units.
    const threshold=.000625*body.mass()**2*(w.x*w.x+w.y*w.y)/Math.max(distance(a),distance(b));
    if(Number.isFinite(threshold)&&threshold>666){
      const damp=Math.max(.23,Math.min(1,1-(threshold-666)/10000));
      body.setAngvel({x:w.x*damp,y:w.y*damp,z:w.z*damp},true);
    }
  }
  record(body,ms){this.state(body).positions[Math.floor(ms/10)%10]=body.translation();}
}
