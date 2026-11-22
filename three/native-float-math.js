// Float32 atanf used by the pinned VPX WASM libc (musl/FreeBSD s_atanf.c).
// Conversion to float by Ian Lance Taylor, Cygnus Support.
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunPro, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
const f=Math.fround,high=Float32Array.from([.46364760399,.78539812565,.98279368877,1.5707962513]),low=Float32Array.from([5.012158244e-9,3.7748947079e-8,3.447321717e-8,7.5497894159e-8]),polynomial=Float32Array.from([.33333328366,-.19999158382,.14253635705,-.10648017377,.061687607318]),word=new Float32Array(1),bits=new Uint32Array(word.buffer);
export function nativeFloatAtan(value){
 let x=f(value);word[0]=x;const sign=bits[0]>>>31,absolute=bits[0]&0x7fffffff;let id=-1;
 if(absolute>=0x4c800000){if(Number.isNaN(x))return x;return sign?-high[3]:high[3];}
 if(absolute<0x3ee00000){if(absolute<0x39800000)return x;}
 else{x=Math.abs(x);if(absolute<0x3f980000){if(absolute<0x3f300000){id=0;x=f(f(f(2*x)-1)/f(2+x));}else{id=1;x=f(f(x-1)/f(x+1));}}else if(absolute<0x401c0000){id=2;x=f(f(x-1.5)/f(1+f(1.5*x)));}else{id=3;x=f(-1/x);}}
 const z=f(x*x),w=f(z*z),s1=f(z*f(polynomial[0]+f(w*f(polynomial[2]+f(w*polynomial[4]))))),s2=f(w*f(polynomial[1]+f(w*polynomial[3])));
 if(id<0)return f(x-f(x*f(s1+s2)));
 const result=f(high[id]-f(f(f(x*f(s1+s2))-low[id])-x));return sign?-result:result;
}
