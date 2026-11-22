// SPDX-License-Identifier: GPL-3.0-or-later
// Ball::Render and Renderer::UpdateBallShaderMatrix, pinned VPX revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See VPX-Physics-NOTICE.txt.
import {nativeIdentity,nativeInverse,nativeMultiply,nativeChain,nativeScale,nativeTranslate} from './native-matrix.js';
import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround;
export function nativeBallMatrices(camera){const worldView=nativeMultiply(nativeIdentity(),camera.view);return nativeShaderArray([...camera.view,...worldView,...nativeInverse(worldView),...nativeMultiply(worldView,camera.projection)]);}
export function nativeBallOrientation(position,orientation,radius=25,stretch=[1,1]){
 const rotation=nativeIdentity();for(let row=0;row<3;row++)for(let column=0;column<3;column++)rotation[row*4+column]=orientation[column*3+row];
 return nativeShaderArray(nativeChain(rotation,nativeScale(f(f(radius)*f(stretch[0])),f(f(radius)*f(stretch[1])),f(f(radius)*f(stretch[1]))),nativeTranslate(position.x,position.y,position.z)));
}
const color=(value,intensity=1)=>{const c=typeof value==='string'?Number.parseInt(value.replace('#',''),16):Number(value)>>>0;return [f(f((c&255)*f(1/255))*intensity),f(f((c&65280)*f(1/65280))*intensity),f(f((c&16711680)*f(1/16711680))*intensity)];};
export function nativeBallLightState(metadata,lighting,position,stateFor=()=>null,bulbScale=metadata.table.default_bulb_intensity_scale_on_ball){
 const globals=lighting.globals??lighting,positions=new Float32Array(40),emissions=new Float32Array(40);positions.set(globals.positions);emissions.set(globals.emissions);
 const nearest=metadata.lights.map((spec,index)=>{const dx=f(f(spec.center.x)-f(position.x)),dy=f(f(spec.center.y)-f(position.y)),dz=f(f(f(spec.mesh_radius)+f(spec.surface_height))-f(position.z));return{spec,index,distance:f(f(f(dx*dx)+f(dy*dy))+f(dz*dz))};}).sort((a,b)=>a.distance-b.distance);
 for(let i=0;i<8;i++){
  const light=nearest[i],offset=(i+2)*4;if(!light){positions.set([-100000,-100000,-100000,0],offset);continue;}
  const {spec}=light,state=stateFor(spec.name),intensity=f(state?.inplayintensity??f(f(spec.intensity)*f(spec.intensity_scale??1))),mapped=f(intensity*f(Math.max(0,Math.min(23000,f(Math.pow(f(f(spec.falloff_radius)*f(.6)),f(f(spec.falloff_power)*f(.6)))))))),strength=f(mapped*f(bulbScale));
  positions.set([f(spec.center.x),f(spec.center.y),f(f(spec.surface_height)+f(spec.height)),0],offset);emissions.set([...color(state?.color??spec.color,strength),0],offset);
 }
 const roughness=nearest.length?Math.min(.8,Math.max(f(.4),f(f(Math.sqrt(nearest[0].distance))*f(.006)))):f(.8);
 return{positions:nativeShaderArray(positions),emissions:nativeShaderArray(emissions),roughness:nativeShaderArray([f(Math.pow(2,f(f(10*f(roughness))+1))),0,1,.05]),nearest:nearest.slice(0,8).map(l=>l.spec.name)};
}
