// SPDX-License-Identifier: GPL-3.0-or-later
// Original native CPU vertex updates and source plunger mesh frame selection.
import * as THREE from 'three';import {decodeNativeGeometry} from './native-geometry-codec.js';
import {nativeStandupRenderVertices,nativeDropRenderVertices} from './native-target-render.js';
import {nativeSpinnerRenderVertices,nativeGateRenderVertices,nativeBumperSkirtVertices} from './native-mechanism-vertices.js';
const f=Math.fround;
export function nativePlungerFrame(spec,position,frames){const start=f(spec.center.y),end=f(start-f(spec.stroke)),frame=Math.trunc(f(f(f(f(f(position)-start)/f(end-start))*f(frames-1))+.5));return Math.max(0,Math.min(frames-1,frame));}
export async function loadNativeMechanismAnimation(base){
 const read=async file=>{const response=await fetch(base+file);if(!response.ok)throw Error('Native mechanism animation unavailable: '+file);return response;};
 const [templates,standup,plunger]=await Promise.all(['mechanism-templates.json','standup-render-template.json','plunger-render-frames.json'].map(async file=>(await read(file)).json()));
 const [templateBytes,standupBytes,plungerBytes]=await Promise.all([templates.file,standup.file,plunger.geometry.file].map(async file=>(await read(file)).arrayBuffer()));
 return{templates:Object.fromEntries(templates.parts.map(p=>[p.name,new Float32Array(templateBytes,p.byteOffset,p.vertices*8)])),standup:new Float32Array(standupBytes),plunger:{metadata:plunger,vertices:new Float32Array(decodeNativeGeometry(plungerBytes,[plunger.geometry]))}};
}
export function createNativeMechanismAnimation(game,visual,assets){
 const parts=visual.parts.filter(p=>['HitTarget','Gate','Spinner','Trigger','Bumper','Plunger'].includes(p.spec.kind)).map(part=>{
  const attribute=part.mesh.geometry.getAttribute('vPosition').data,rest=attribute.array.slice(),kind=part.spec.kind;
  // Retain exact captured unused attributes; native gates only write positions
  // and normals. Geometry attributes share this dynamic interleaved buffer.
  attribute.array=rest.slice();attribute.setUsage(THREE.DynamicDrawUsage);
  return{part,attribute,rest,last:null,changed:false,kind};
 });
 const objectFor=(items,name)=>items.find(p=>p.spec.name.toLowerCase()===name);
 return{parts,update(){for(const item of parts){const {part,attribute,rest,kind}=item,spec=part.spec,name=spec.name.toLowerCase(),output=attribute.array,surface=spec.surface_height??0;let key;
  if(kind==='HitTarget'){
   const motion=game.targetMotions.get(name);key=motion.revision;if(key===item.last)continue;if(item.last===null&&key===0){item.last=key;continue;}
   if(motion.drop)nativeDropRenderVertices(rest,motion.offset,output);else nativeStandupRenderVertices(spec,assets.standup,motion.offset,{output});
  }else if(kind==='Spinner'){
   key=objectFor(game.spinners,name)?.angle??0;if(key===item.last)continue;nativeSpinnerRenderVertices(spec,assets.templates['spinner-plate'],key,surface,output);
  }else if(kind==='Gate'){
   if(part.record.role!=='wire')continue;key=objectFor(game.gates,name)?.angle??0;if(key===item.last)continue;nativeGateRenderVertices(spec,assets.templates['gate-wire'],key,surface,output);
  }else if(kind==='Trigger'){
   key=game.visualMotions.get(name)?.offset??0;if(key===item.last)continue;nativeDropRenderVertices(rest,key,output);
  }else if(kind==='Bumper'){
   const motion=game.visualMotions.get(name);key=part.record.role==='ring'?(motion?.ringOffset??0):[motion?.rotx??0,motion?.roty??0].join(',');if(key===item.last)continue;
   if(part.record.role==='ring')nativeDropRenderVertices(rest,key,output);else nativeBumperSkirtVertices(spec,assets.templates['bumper-skirt'],motion?.rotx??0,motion?.roty??0,surface,{output});
  }else{
   key=nativePlungerFrame(spec,game.plungerPosition??game.plunger.pos,assets.plunger.metadata.frames);if(key===item.last)continue;const count=assets.plunger.metadata.verticesPerFrame*8;output.set(assets.plunger.vertices.subarray(key*count,(key+1)*count));
  }
  item.last=key;item.changed=true;attribute.needsUpdate=true;
 }} };
}
