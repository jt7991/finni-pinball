// SPDX-License-Identifier: GPL-3.0-or-later
// LightSeq grid, queue and tracers, Visual Pinball contributors, parts/lightseq.cpp
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
import {SEQ,sequenceTracers} from './light-sequence-patterns.js';
import {nativeDragCurve} from './native-curve.js';
export {SEQ};
const f=Math.fround,GRID_RECIPROCAL=f(1/20),DEGREES=f(Math.PI/180);
const circleRays=Array.from({length:720},(_,i)=>{const angle=f((Math.PI/180)*(i/2));return[f(Math.sin(angle)),f(Math.cos(angle))];});
const supported=new Set(['Light','Flasher','Primitive']);
export function clampLightState(value){const s=f(Number(value));return s<0?1:s===2?2:s>1?1:s;}

export class LightSequence{
  constructor(spec,elements,{width=952,height=2115,random,onDone=()=>{},available=true}={}){
    this.spec=spec;this.elements=elements;this.random=random;this.onDone=onDone;
    this.available=available;
    this.width=Math.trunc(Math.trunc(width)/20);this.height=Math.trunc(Math.trunc(height)/20);
    this.centerX=f(spec.pos_x??0);this.centerY=f(spec.pos_y??0);
    this.updateInterval=Math.max(1,Math.trunc(spec.update_interval??25));
    this.grid=new Int16Array(this.width*this.height);
    elements.forEach(({spec:member,state},index)=>{
      if(!supported.has(member.kind))return;
      let x=state.x,y=state.y;
      // Flasher::get_X/Y recomputes the bounding center of its rendered outline;
      // its saved pos_x/pos_y can still contain an old editor position.
      if(member.kind==='Flasher'&&member.drag_points?.length){
        const vertices=nativeDragCurve(member.drag_points,true,4,2);
        if(vertices.length){x=f(.5*f(Math.min(...vertices.map(p=>p.x))+Math.max(...vertices.map(p=>p.x))));y=f(.5*f(Math.min(...vertices.map(p=>p.y))+Math.max(...vertices.map(p=>p.y))));}
      }
      if(member.kind==='Light'&&member.is_backglass)y=f(f(y)*f(2.666));
      const ix=Math.trunc(f(f(x)*GRID_RECIPROCAL)),iy=Math.trunc(f(f(y)*GRID_RECIPROCAL));
      if(ix>=0&&ix<this.width&&iy>=0&&iy<this.height)this.grid[iy*this.width+ix]=index+1;
    });
    this.queue=[];this.playing=false;this.paused=false;this.next=0;this.now=0;this.tracers=[];
  }
  setCenter(axis,value){
    const v=f(value);if(v<0||v>=(axis==='x'?1000:2000))return;
    this[axis==='x'?'centerX':'centerY']=v;
  }
  play(animation,tail=0,repeat=1,pause=0){
    if(animation===SEQ.SeqAllOn||animation===SEQ.SeqAllOff){this.setAll(animation===SEQ.SeqAllOn?1:0);return 0;}
    // The native 100-slot ring reserves one slot; the current item stays queued.
    if(this.queue.length===99)return -2147467259;
    this.queue.push({animation,tail:Math.max(0,Math.trunc(tail)),repeat:Math.max(1,Math.trunc(repeat)),pause:Math.max(0,Math.trunc(pause)),rate:this.updateInterval});return 0;
  }
  stop(){
    this.playing=false;this.paused=false;this.tracers=[];this.queue=[];
    for(const {spec,state}of this.elements)if(supported.has(spec.kind))state.sequenceactive=false;
    return 0;
  }
  set(index,value){
    const item=this.elements[index];if(!item||!supported.has(item.spec.kind))return;
    item.state.sequenceactive=true;item.state.sequencestate=value;
  }
  setAll(value){for(let i=0;i<this.elements.length;i++)this.set(i,value);}
  state(index){
    const item=this.elements[index];if(!item||!supported.has(item.spec.kind))return 0;
    const s=item.state,value=item.spec.kind==='Light'&&!s.sequenceactive?s.state:s.sequencestate;
    return value===0?0:value===2&&item.spec.kind==='Light'?2:1;
  }
  setGrid(x,y,value){
    const ix=Math.trunc(x),iy=Math.trunc(y);
    if(ix>=0&&ix<this.width&&iy>=0&&iy<this.height){const index=this.grid[iy*this.width+ix];if(index!==0)this.set(index-1,value);}
  }
  setup(item){
    this.current={...item};this.paused=false;
    const cx=Math.floor(f(this.centerX*GRID_RECIPROCAL)),cy=Math.floor(f(this.centerY*GRID_RECIPROCAL));
    this.tracers=sequenceTracers(item.animation,item.tail,item.repeat,item.pause,item.rate,this.width,this.height,cx,cy).tracers;
    if(item.animation===SEQ.SeqRandom){this.current.tail=0;this.current.repeat=1;this.current.pause=0;}
    this.next=this.now+item.rate;this.playing=true;
  }
  update(milliseconds){
    this.now=milliseconds>>>0;
    if(this.playing){
      while(this.now>=this.next&&this.playing){
        if(!this.paused){
          this.next+=this.current.rate;
          // All four tracers run even when an earlier one has not finished.
          const finished=this.tracers.map((t,i)=>this.process(t,i<2?1:0));
          if(finished.every(Boolean)){this.next=this.now+Math.max(this.current.rate,this.current.pause);this.paused=true;}
        }else if(--this.current.repeat!==0)this.setup(this.current);
        else{
          this.queue.shift();this.playing=false;
          if(!this.queue.length){this.stop();this.onDone();}
        }
      }
    }else if(this.queue.length)this.setup(this.queue[0]);
  }
  process(t,state){
    if(t.type===0||!this.available)return true;
    if(t.delay!==0){t.delay--;return false;}
    if(t.type===1){
      const count=t.frameCount--;
      if(count===2||count===1){this.setAll(count===2?(t.length<=0?1:0):(t.length<=0?0:1));this.next=this.now+this.current.pause;}
      return count===0;
    }
    if(t.type===2){
      for(let i=0;i<t.length;i++){const index=Math.trunc(f(f(this.elements.length)*this.random()));this.set(index,this.state(index)===1?0:1);}
    }else if(t.type===3){
      let x=t.x,y=t.y;for(let i=0;i<t.length;i++){this.setGrid(x,y,state);x=f(x+t.processStepX);y=f(y+t.processStepY);}
    }else if(t.type===4){
      for(const [sn,cs]of circleRays){
        this.setGrid(f(t.x+f(sn*t.radius)),f(t.y-f(cs*t.radius)),state);
      }
    }else if(t.type===5){
      const rays=[0,.25,.5,.75].map(step=>{const angle=f(f(t.angle+f(t.stepAngle*step))*DEGREES);return[f(Math.sin(angle)),f(Math.cos(angle))];});
      for(let i=0;i<t.length;i++)for(const [sn,cs]of rays){
        const radius=this.tracers[0].processRadiusNeg?-i:i;
        this.setGrid(f(t.x+f(sn*radius)),f(t.y-f(cs*radius)),state);
      }
    }else return true;
    if(--t.frameCount===0){t.type=0;return true;}
    if(t.type===3){t.x=f(t.x+t.stepX);t.y=f(t.y+t.stepY);}
    else if(t.type===4)t.radius=f(t.radius+t.stepRadius);
    else if(t.type===5){t.angle=f(t.angle+t.stepAngle);if(t.angle>=360)t.angle=f(t.angle-360);if(t.angle<0)t.angle=f(t.angle+360);}
    return false;
  }
}
