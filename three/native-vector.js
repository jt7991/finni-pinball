// SPDX-License-Identifier: GPL-3.0-or-later
// Float32 vector operations used by the Visual Pinball physics adaptation.
export const f=Math.fround;
export const add=(a,b)=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
export const sub=(a,b)=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
export const mul=(a,s)=>({x:f(a.x*s),y:f(a.y*s),z:f(a.z*s)});
// VPX vector division rounds the reciprocal once, then multiplies components.
export const div=(a,s)=>mul(a,f(1/s));
export const dot=(a,b)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
export const cross=(a,b)=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
export const length=a=>f(Math.sqrt(dot(a,a)));
export const unit=a=>mul(a,f(1/length(a)));
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const nativeNormal=n=>({x:f(n.x),y:f(-n.y),z:f(n.z)});
export const nativeGravity=g=>({x:f(g.x*.01),y:f(-g.y*.01),z:f(g.z*.01)});
export const elasticityAtSpeed=(elasticity,falloff,velocity)=>falloff>0?f(f(elasticity)/f(1+f(f(f(falloff)*Math.abs(velocity))*f(1/18.53)))):f(elasticity);
