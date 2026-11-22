// SPDX-License-Identifier: GPL-3.0-or-later
// Matrix3D, Visual Pinball 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// Native row-vector storage is also the column-major GLSL upload layout.
const f=Math.fround;
export const nativeIdentity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function nativeMultiply(a,b){const m=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)m[i*4+j]=f(f(f(f(b[j]*a[i*4])+f(b[4+j]*a[i*4+1]))+f(b[8+j]*a[i*4+2]))+f(b[12+j]*a[i*4+3]));return m;}
export const nativeChain=(...matrices)=>matrices.reduce(nativeMultiply);
export function nativeTranslate(x,y,z){const m=nativeIdentity();m.set([x,y,z,1],12);return m;}
export function nativeScale(x,y=x,z=x){const m=nativeIdentity();m[0]=x;m[5]=y;m[10]=z;return m;}
export function nativeRotate(axis,angle){const m=nativeIdentity(),s=f(Math.sin(f(angle))),c=f(Math.cos(f(angle))),[i,j]=({x:[1,2],y:[2,0],z:[0,1]})[axis];m[i*4+i]=m[j*4+j]=c;m[i*4+j]=s;m[j*4+i]=-s;return m;}
export function nativeTransform(m,p){const [x,y,z]=p;return[0,1,2].map(j=>f(f(f(f(m[j]*x)+f(m[4+j]*y))+f(m[8+j]*z))+m[12+j]));}
export function nativeInverse(source){const m=new Float32Array(source),pivot=[0,1,2,3];for(let k=0;k<4;k++){let temp=0,l=k;for(let i=k;i<4;i++){const d=Math.abs(m[k*4+i]);if(d>temp){temp=d;l=i;}}if(l!==k){[pivot[k],pivot[l]]=[pivot[l],pivot[k]];for(let j=0;j<4;j++)[m[j*4+k],m[j*4+l]]=[m[j*4+l],m[j*4+k]];}
 const d=f(1/m[k*4+k]);for(let j=0;j<4;j++)if(j!==k){const c=f(m[j*4+k]*d);for(let i=0;i<4;i++)m[j*4+i]=f(m[j*4+i]-f(m[k*4+i]*c));m[j*4+k]=c;}for(let i=0;i<4;i++)m[k*4+i]=f(-m[k*4+i]*d);m[k*4+k]=d;}
 const result=new Float32Array(16);for(let i=0;i<4;i++)result.set(m.subarray(i*4,i*4+4),pivot[i]*4);return result;}
export function nativePerspective(left,right,bottom,top,near,far){const m=new Float32Array(16),dx=f(right-left),dy=f(top-bottom);m[0]=f(f(2*near)/dx);m[5]=f(f(2*near)/dy);m[8]=f(-f(right+left)/dx);m[9]=f(-f(top+bottom)/dy);m[10]=f(-far/f(near-far));m[11]=1;m[14]=f(near*-m[10]);return m;}
