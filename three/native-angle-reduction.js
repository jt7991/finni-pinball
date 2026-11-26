/* Conversion to float by Ian Lance Taylor, Cygnus Support.
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 * Adapted from musl __rem_pio2f.c and __rem_pio2_large.c, specializing the
 * latter's one-word input and precision=0 path used by binary32 sinf/cosf.
 */
const memory=new ArrayBuffer(4),floats=new Float32Array(memory),words=new Uint32Array(memory);
const inversePiOverTwo=.636619772367581382433,piOverTwoHigh=1.57079631090164184570,piOverTwoLow=1.58932547735281966916e-8,toInteger=1.5/Number.EPSILON,quarterPi=.7853981852531433;
const inversePiWords=[
 0xA2F983,0x6E4E44,0x1529FC,0x2757D1,0xF534DD,0xC0DB62,
 0x95993C,0x439041,0xFE5163,0xABDEBB,0xC561B7,0x246E3A,
 0x424DD2,0xE00649,0x2EEA09,0xD1921C,0xFE1DEB,0x1CB129,
 0xA73EE8,0x8235F5,0x2EBB44,0x84E99C,0x7026B4,0x5F7E41,
 0x3991D6,0x398353,0x39F49C,0x845F8B,0xBDF928,0x3B1FF8,
 0x97FFDE,0x05980F,0xEF2F11,0x8B5A0A,0x6D1F6D,0x367ECF,
 0x27CB09,0xB74F46,0x3F669E,0x5FEA2D,0x7527BA,0xC7EBE5,
 0xF17B3D,0x0739F7,0x8A5292,0xEA6BFB,0x5FB11F,0x8D5D08,
 0x560330,0x46FC7B,0x6BABF0,0xCFBC20,0x9AF436,0x1DA9E3,
 0x91615E,0xE61B08,0x659985,0x5F14A0,0x68408D,0xFFD880,
 0x4D7327,0x310606,0x1556CA,0x73A8C9,0x60E27B,0xC08C6B,
];
const piOverTwoWords=[1.57079625129699707031,7.54978941586159635335e-8,5.39030252995776476554e-15,3.28200341580791294123e-22];
function largeReduction(x,exponent){
 const initialTerms=3,tableIndex=Math.max(0,Math.trunc((exponent-3)/24)),q=[],integer=[],fraction=[];let scale=exponent-24*(tableIndex+1),last=initialTerms,n,z,upper;
 for(let i=0;i<=initialTerms;i++)q[i]=x*inversePiWords[tableIndex+i];
 for(;;){
  z=q[last];
  for(let i=0,j=last;j>0;i++,j--){const carry=Math.trunc(2**-24*z);integer[i]=Math.trunc(z-2**24*carry);z=q[j-1]+carry;}
  z*=2**scale;z-=8*Math.floor(z*.125);n=Math.trunc(z);z-=n;upper=0;
  if(scale>0){const i=integer[last-1]>>(24-scale);n+=i;integer[last-1]-=i<<(24-scale);upper=integer[last-1]>>(23-scale);}
  else if(scale===0)upper=integer[last-1]>>23;
  else if(z>=.5)upper=2;
  if(upper>0){
   n++;let carry=0;
   for(let i=0;i<last;i++){const value=integer[i];if(!carry){if(value!==0){carry=1;integer[i]=0x1000000-value;}}else integer[i]=0xffffff-value;}
   if(scale===1)integer[last-1]&=0x7fffff;else if(scale===2)integer[last-1]&=0x3fffff;
   if(upper===2){z=1-z;if(carry)z-=2**scale;}
  }
  if(z===0){
   let combined=0;for(let i=last-1;i>=initialTerms;i--)combined|=integer[i];
   if(combined===0){let extra=1;while(integer[initialTerms-extra]===0)extra++;for(let i=last+1;i<=last+extra;i++)q[i]=x*inversePiWords[tableIndex+i];last+=extra;continue;}
  }
  break;
 }
 if(z===0){last--;scale-=24;while(integer[last]===0){last--;scale-=24;}}
 else{z*=2**-scale;if(z>=2**24){const carry=Math.trunc(2**-24*z);integer[last]=Math.trunc(z-2**24*carry);last++;scale+=24;integer[last]=carry;}else integer[last]=Math.trunc(z);}
 let weight=2**scale;for(let i=last;i>=0;i--){q[i]=weight*integer[i];weight*=2**-24;}
 for(let i=last;i>=0;i--){let value=0;for(let k=0;k<=initialTerms&&k<=last-i;k++)value+=piOverTwoWords[k]*q[i+k];fraction[last-i]=value;}
 let remainder=0;for(let i=last;i>=0;i--)remainder+=fraction[i];
 return {quadrant:n&7,remainder:upper===0?remainder:-remainder};
}
export function nativeReduceAngle(x){
 floats[0]=x;const word=words[0],absolute=word&0x7fffffff;
 if(absolute<0x4dc90fdb){
  let count=x*inversePiOverTwo+toInteger-toInteger,remainder=x-count*piOverTwoHigh-count*piOverTwoLow;
  if(remainder< -quarterPi){count--;remainder=x-count*piOverTwoHigh-count*piOverTwoLow;}
  else if(remainder>quarterPi){count++;remainder=x-count*piOverTwoHigh-count*piOverTwoLow;}
  return {quadrant:count|0,remainder};
 }
 const exponent=(absolute>>>23)-(127+23);words[0]=absolute-(exponent<<23);
 const result=largeReduction(floats[0],exponent);
 return word>>>31?{quadrant:-result.quadrant,remainder:-result.remainder}:result;
}
