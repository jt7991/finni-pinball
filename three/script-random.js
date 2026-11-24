// SPDX-License-Identifier: LGPL-2.1-or-later
// Adapted from libwinevbs/Wine global.c and vbdisp.c.
// Copyright 2011 Jacek Caban for CodeWeavers.
// See public/licenses/Wine-Script-Random-NOTICE.txt.

// Each script context owns this stream; it never draws physics randomness.
export function createScriptRandom({clock=()=>Date.now()}={}){
  const bits=new DataView(new ArrayBuffer(8));let state=0x50000;
  const next=value=>(Math.imul(value,0x43fd43fd)+0xc39ec3)&0xffffff;
  return {
    rnd(argument){
      const value=Math.fround(argument);
      if(value<0){bits.setFloat32(0,value,true);const seed=bits.getUint32(0,true);state=next((seed+(seed>>>24))>>>0);}
      else if(argument===undefined||value!==0)state=next(state);
      return state/16777216;
    },
    randomize(argument){
      // The pinned WASM GetTickCount uses gettimeofday's epoch milliseconds,
      // narrowed to a DWORD. It does not use the page's performance origin.
      // Randomize preserves the previous state's low byte, even for equal seeds.
      bits.setFloat64(0,argument===undefined?(Math.trunc(clock())>>>0)*.001:argument,true);
      let seed=bits.getUint32(4,true);seed^=seed>>>16;
      state=((seed&0xffff)<<8)|(state&0xff);
    },
    getState(){return state;},
    // Native reference replay restores the observed initial stream in place:
    // the interpreter and impulse-plunger closure must keep the same stream.
    restoreState(value){
      if(!Number.isInteger(value)||value<0||value>=16777216)throw Error('Invalid 24-bit script random state');
      state=value;
    },
  };
}

export function registerScriptRandom(engine,random){
  const registry=engine._getContext().functionRegistry;
  // Keep the interpreter's Variant conversions and its arity/type errors.
  engine._registerFunction('Rnd',argument=>({type:'Single',value:random.rnd(argument===undefined?undefined:registry.call('CSng',[argument]).value)}));
  registry.register('Randomize',argument=>{random.randomize(argument===undefined?undefined:registry.call('CDbl',[argument]).value);},{isSub:true});
}
