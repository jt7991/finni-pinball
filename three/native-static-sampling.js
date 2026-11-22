// SPDX-License-Identifier: GPL-3.0-or-later
// Renderer::RenderStaticPrepass and gaussianDistribution(lump3), pinned VPX.
import {nativeStaticSamples} from './native-static-sample-data.js';
const f=Math.fround;
export function nativeStaticJitter(index,width,height){
 if(!Number.isInteger(index)||index<0||index>=128||!(width>0&&height>0))throw Error('Invalid native prerender sample');
 const u=nativeStaticSamples[index*2],v=nativeStaticSamples[index*2+1],root=f(Math.sqrt(f(Math.sqrt(f(1-u))))),radius=f(.5*f(Math.sqrt(f(9-f(9*root))))),angle=f(f(2*Math.PI)*v);
 return{x:f(f(f(radius*f(Math.cos(angle)))+0)/f(width)),y:f(f(f(radius*f(Math.sin(angle)))+0)/f(height))};
}
