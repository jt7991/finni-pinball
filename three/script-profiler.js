// SPDX-License-Identifier: GPL-3.0-or-later
// FrameProfiler script-section accounting and PhysicsEngine timer gate,
// Visual Pinball195f214dd4849b8ef6113fd377258b78d0dec3bf, utils/wintimer.h.
export const NATIVE_SCRIPT_BUDGET_MICROSECONDS=5000;
export const NATIVE_FRAME_PACING_MODE=3;
// The pinned SDL clock ultimately imports emscripten_date_now, not the
// higher-resolution performance clock used by the worker's physical pump.
export const nativeScriptMicroseconds=()=>Date.now()*1000;

export class ScriptProfiler{
 constructor({videoSyncMode=2,clock=nativeScriptMicroseconds}={}){
  if(!Number.isInteger(videoSyncMode)||videoSyncMode<0||videoSyncMode>3)throw Error('Invalid native video synchronization mode');
  this.videoSyncMode=videoSyncMode;this.clock=clock;this.stack=[];this.script=false;this.microseconds=0;this.frames=0;this.timerDeferrals=0;this.at=this.read();
 }
 read(){const value=this.clock();if(!Number.isSafeInteger(value))throw Error('Script profiler clock must return integer microseconds');return value;}
 enter(){const now=this.read();if(this.script)this.add(now-this.at);this.at=now;this.stack.push(this.script);this.script=true;}
 exit(){if(!this.stack.length)throw Error('Script profiler section stack is empty');const now=this.read();if(this.script)this.add(now-this.at);this.at=now;this.script=this.stack.pop();}
 add(elapsed){this.microseconds=(this.microseconds+elapsed)>>>0;}
 measure(callback){this.enter();try{return callback();}finally{this.exit();}}
 beginFrame(){if(this.stack.length)throw Error('Cannot prepare a frame inside a script section');this.at=this.read();this.microseconds=0;this.script=false;this.frames++;}
 get timersAllowed(){return this.videoSyncMode===NATIVE_FRAME_PACING_MODE||this.microseconds<=NATIVE_SCRIPT_BUDGET_MICROSECONDS;}
 deferTimers(){this.timerDeferrals++;}
 snapshot(){return{videoSyncMode:this.videoSyncMode,budgetMicroseconds:NATIVE_SCRIPT_BUDGET_MICROSECONDS,elapsedMicroseconds:this.microseconds,frames:this.frames,timerDeferrals:this.timerDeferrals};}
}
