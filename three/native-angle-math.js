/* Conversion to float by Ian Lance Taylor, Cygnus Support.
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * Adapted from Emscripten musl src/math/{sinf,cosf,__sindf,__cosdf}.c.
 */
const f=Math.fround,memory=new ArrayBuffer(4),floats=new Float32Array(memory),words=new Uint32Array(memory),bits=x=>{floats[0]=x;return words[0];},halfPi=Math.PI/2;
const sindf=x=>{const z=x*x,w=z*z,r=-0x1a00f9e2cae774*2**-65+z*(0x16cd878c3b46a7*2**-71),s=z*x;return f((x+s*(-0x15555554cbac77*2**-55+z*(0x111110896efbb2*2**-59)))+s*w*r);};
const cosdf=x=>{const z=x*x,w=z*z,r=-0x16c087e80f1e27*2**-62+z*(0x199342e0ee5069*2**-68);return f(((1+z*(-0x1ffffffd0c5e81*2**-54))+w*(0x155553e1053a42*2**-57))+(w*z)*r);};
// Native normalized mechanism angles fit within +/-9pi/4. The original musl
// polynomial can differ from rounding Math.sin/Math.cos by one Float32 step,
// changing contact normals or the weak gravity torque during coasting.
// This bounded implementation rejects unrelated large-angle reduction.
export function nativeAngleSin(x){
 x=f(x);const word=bits(x),negative=word>>>31,abs=word&0x7fffffff;
 if(abs<=0x3f490fda)return abs<0x39800000?x:sindf(x);
 if(abs<=0x407b53d1){if(abs<=0x4016cbe3)return negative?-cosdf(x+halfPi):cosdf(x-halfPi);return sindf(negative?-(x+2*halfPi):-(x-2*halfPi));}
 if(abs<=0x40e231d5){if(abs<=0x40afeddf)return negative?cosdf(x+3*halfPi):-cosdf(x-3*halfPi);return sindf(negative?x+4*halfPi:x-4*halfPi);}
 throw new RangeError('Native sine angle exceeds the normalized mechanism range');
}
export function nativeAngleCos(x){
 x=f(x);const word=bits(x),negative=word>>>31,abs=word&0x7fffffff;
 if(abs<=0x3f490fda)return abs<0x39800000?1:cosdf(x);
 if(abs<=0x407b53d1){if(abs>0x4016cbe3)return -cosdf(negative?x+2*halfPi:x-2*halfPi);return negative?sindf(x+halfPi):sindf(halfPi-x);}
 if(abs<=0x40e231d5){if(abs>0x40afeddf)return cosdf(negative?x+4*halfPi:x-4*halfPi);return negative?sindf(-x-3*halfPi):sindf(x-3*halfPi);}
 throw new RangeError('Native cosine angle exceeds the normalized mechanism range');
}
