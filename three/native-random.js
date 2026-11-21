// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' MWC64X and float mapping, core/def.h,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export function runtimeNativeRandom(){
  const words=new Uint32Array(2);
  // Independent entropy, once per engine lifetime. Never derive physical
  // randomness from script Rnd, decorative effects or a trajectory seed.
  do{globalThis.crypto.getRandomValues(words);}while((words[0]===0&&words[1]===0)||(words[0]===0xffffffff&&words[1]===4294883354));
  return nativeRandom(words[0],words[1]);
}
export function nativeRandom(low,high){
  let x=low>>>0,c=high>>>0,calls=0;
  const output=()=>{
    const result=(x^c)>>>0;
    // Exact 32x32 -> 64 multiplication without converting the product to a
    // double (which would drop low bits) or allocating a BigInt per draw.
    const a=x&65535,b=x>>>16,p0=a*47131,p1=b*47131+a*65534,p2=b*65534;
    const sum=p0+(p1&65535)*65536+c;
    x=sum>>>0;c=(p2+Math.floor(p1/65536)+Math.floor(sum/4294967296))>>>0;calls++;
    return result;
  };
  const random=()=>{const u=output();return f(f((u&~(u>>>24))>>>0)*2.3283064365386963e-10);};
  random.signed=()=>f((output()>>7)*5.960464477539063e-8);
  random.getState=()=>[x,c];random.setState=(low,high)=>{x=low>>>0;c=high>>>0;};
  Object.defineProperty(random,'calls',{get:()=>calls});return random;
}
