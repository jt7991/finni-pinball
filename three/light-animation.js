// SPDX-License-Identifier: GPL-3.0-or-later
// Light state, blink clocks and authored linear fades, Visual Pinball contributors,
// parts/light.cpp / light.h at 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {clampLightState} from './light-sequence.js';
const f=Math.fround;
export function nativeColor(value){
  if(typeof value==='string'&&/^#[\da-f]{6}$/i.test(value))return parseInt(value.slice(1,3),16)|(parseInt(value.slice(3,5),16)<<8)|(parseInt(value.slice(5,7),16)<<16);
  return Number(value)>>>0;
}
export class LightAnimation{
  constructor(spec,clock=()=>0,onAnimate=()=>{}){
    this.spec=spec;this.clock=clock;this.onAnimate=onAnimate;
    this.stored=clampLightState(spec.state??spec.state_u32??0);this.inplay=this.stored;this.locked=false;
    this.base=f(spec.intensity??1);this.scale=1;this.up=f(spec.fade_speed_up??1);this.down=f(spec.fade_speed_down??1);
    this.interval=spec.blink_interval??125;this.pattern=String(spec.blink_pattern??'10')||'0';this.index=0;
    this.fader=spec.fader==='none'?0:spec.fader===undefined||spec.fader==='linear'?1:2;
    if(this.fader===2)throw Error('The authored lamp port requires the table’s linear or none fader');
    this.duration=0;this.end=0;this.final=0;this.next=this.inplay===2?(this.now()+this.interval)>>>0:0;
    this.intensity=f(f(this.base*this.scale)*this.level());
  }
  now(){return this.clock()>>>0;}
  level(){return this.inplay===2?(this.pattern[this.index]==='1'?1:0):this.inplay;}
  getState(){return clampLightState(this.locked?this.stored:this.inplay);}
  setInPlay(value){
    const state=clampLightState(value);
    if(state!==this.inplay){
      this.inplay=state;
      if(state===2){this.index=0;this.next=this.now();}
      if(this.duration>0)this.duration=0;
    }
  }
  setState(value){const state=clampLightState(value);if(!this.locked)this.setInPlay(state);this.stored=state;}
  setLocked(value){
    if(value)this.locked=true;
    else{const state=this.getState();this.locked=false;this.setState(state);}
  }
  restart(){this.index=0;this.next=(this.now()+this.interval)>>>0;this.end=(this.now()+this.duration)>>>0;}
  setPattern(value){this.pattern=String(value)||'0';this.restart();}
  setInterval(value){this.interval=Math.trunc(value);this.next=(this.now()+this.interval)>>>0;}
  setIntensity(value){this.base=Math.max(0,f(value));this.intensity=f(f(this.base*this.scale)*this.level());}
  setScale(value){this.scale=Math.max(0,f(value));this.intensity=f(f(this.base*this.scale)*this.level());}
  setDuration(start,milliseconds,end){
    this.inplay=clampLightState(start);this.duration=Math.trunc(milliseconds);this.final=clampLightState(end);this.end=(this.now()+this.duration)>>>0;
    if(this.inplay===2){this.index=0;this.next=(this.now()+this.interval)>>>0;}
  }
  update(milliseconds){
    const now=this.now(),delta=f(milliseconds);
    if(this.duration>0&&this.end<now){this.inplay=this.final;this.duration=0;if(this.inplay===2)this.restart();}
    // Native advances one pattern position per rendered frame, including
    // catch-up frames; it does not skip directly to the wall-clock phase.
    if(this.inplay===2&&this.next<=now){
      this.index++;if(this.index>=this.pattern.length||this.pattern[this.index]==='\0')this.index=0;
      this.next=(this.next+this.interval)>>>0;
    }
    const previous=this.intensity,target=f(f(this.base*this.scale)*this.level());
    if(previous!==target){
      if(this.fader===0)this.intensity=target;
      else if(previous<target)this.intensity=Math.min(target,f(previous+f(this.up*delta)));
      else this.intensity=Math.max(target,f(previous-f(this.down*delta)));
    }
    if(this.intensity!==previous)this.onAnimate();
  }
  get(key){
    switch(key){
      case 'state':return this.getState();case 'sequenceactive':return this.locked;case 'sequencestate':return this.inplay;
      case 'intensity':return this.base;case 'intensityscale':return this.scale;case 'blinkinterval':return this.interval;case 'blinkpattern':return this.pattern;
      case 'fadespeedup':return this.up;case 'fadespeeddown':return this.down;case 'inplayintensity':return this.intensity;case 'inplayon':return this.level()!==0;
    }
  }
  set(key,value){
    switch(key){
      case 'state':this.setState(value);break;case 'sequenceactive':this.setLocked(value);break;case 'sequencestate':this.setInPlay(value);break;
      case 'intensity':this.setIntensity(value);break;case 'intensityscale':this.setScale(value);break;case 'blinkinterval':this.setInterval(value);break;case 'blinkpattern':this.setPattern(value);break;
      case 'fadespeedup':this.up=f(value);break;case 'fadespeeddown':this.down=f(value);break;
      default:return false;
    }
    return true;
  }
}
