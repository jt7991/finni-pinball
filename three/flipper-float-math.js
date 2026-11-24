/* Conversion to float by Ian Lance Taylor, Cygnus Support.
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * Adapted from Emscripten musl src/math/atanf.c and atan2f.c for mesh math.
 */
export {nativeAngleSin as flipperSin,nativeAngleCos as flipperCos} from './native-angle-math.js';
const f=Math.fround,hi=[.46364760399,.78539812565,.98279368877,1.5707962513].map(f),lo=[5.012158244e-9,3.7748947079e-8,3.447321717e-8,7.5497894159e-8].map(f),a=[.33333328366,-.19999158382,.14253635705,-.10648017377,.061687607318].map(f),pi=f(3.141592741),piLo=f(-8.7422776573e-8);
const memory=new ArrayBuffer(4),floats=new Float32Array(memory),words=new Uint32Array(memory),bits=x=>{floats[0]=x;return words[0];};
function atan(x){
  x=f(x);const word=bits(x),negative=word>>>31,abs=word&0x7fffffff;let id;
  if(abs>=0x4c800000){if(Number.isNaN(x))return x;return negative?-hi[3]:hi[3];}
  if(abs<0x3ee00000){if(abs<0x39800000)return x;id=-1;}
  else{x=Math.abs(x);if(abs<0x3f980000){if(abs<0x3f300000){id=0;x=f(f(f(2*x)-1)/f(2+x));}else{id=1;x=f(f(x-1)/f(x+1));}}
    else if(abs<0x401c0000){id=2;x=f(f(x-1.5)/f(1+f(1.5*x)));}else{id=3;x=f(-1/x);}}
  const z=f(x*x),w=f(z*z),s1=f(z*f(a[0]+f(w*f(a[2]+f(w*a[4]))))),s2=f(w*f(a[1]+f(w*a[3]))),sum=f(s1+s2);
  if(id<0)return f(x-f(x*sum));const result=f(hi[id]-f(f(f(x*sum)-lo[id])-x));return negative?-result:result;
}
export function meshAtan2(y,x){
  y=f(y);x=f(x);if(Number.isNaN(x)||Number.isNaN(y))return f(x+y);let ix=bits(x),iy=bits(y);if(ix===0x3f800000)return atan(y);
  const m=(iy>>>31&1)|(ix>>>30&2);ix&=0x7fffffff;iy&=0x7fffffff;
  if(iy===0)return m<2?y:m===2?pi:-pi;if(ix===0)return m&1?-f(pi/2):f(pi/2);
  if(ix===0x7f800000){if(iy===0x7f800000)return[f(pi/4),-f(pi/4),f(f(3*pi)/4),-f(f(3*pi)/4)][m];return m<2?m===0?0:-0:m===2?pi:-pi;}
  if(ix+(26<<23)<iy||iy===0x7f800000)return m&1?-f(pi/2):f(pi/2);
  const z=(m&2)&&iy+(26<<23)<ix?0:atan(Math.abs(f(y/x)));return m===0?z:m===1?-z:m===2?f(pi-f(z-piLo)):f(f(z-piLo)-pi);
}
