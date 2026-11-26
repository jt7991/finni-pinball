// SPDX-License-Identifier: GPL-3.0-or-later
// Consecutive static draws can share one mesh without changing their vertex
// bytes, triangle order, shader inputs or raster state.
import * as THREE from 'three';

function supportedGeometry(geometry){
 const p=geometry.getAttribute('vPosition'),n=geometry.getAttribute('vNormal'),t=geometry.getAttribute('tc');
 return p?.isInterleavedBufferAttribute&&p.itemSize===3&&p.offset===0&&p.data.stride===8&&p.data.array instanceof Float32Array
  &&n?.data===p.data&&n.itemSize===3&&n.offset===3&&t?.data===p.data&&t.itemSize===2&&t.offset===6
  &&geometry.getAttribute('position')===p&&geometry.index?.array instanceof Uint32Array&&geometry.index.itemSize===1
  &&geometry.groups.length===0&&geometry.drawRange.start===0&&geometry.drawRange.count===Infinity;
}

export function mergeNativeStaticGeometry(geometries){
 if(!geometries.length||geometries.some(g=>!supportedGeometry(g)))throw Error('Unsupported native static batch geometry');
 const vertices=new Float32Array(geometries.reduce((sum,g)=>sum+g.getAttribute('vPosition').data.array.length,0));
 const indices=new Uint32Array(geometries.reduce((sum,g)=>sum+g.index.count,0));let vertexOffset=0,indexOffset=0;
 for(const geometry of geometries){
  const source=geometry.getAttribute('vPosition').data.array;vertices.set(source,vertexOffset*8);
  for(let i=0;i<geometry.index.count;i++)indices[indexOffset+i]=geometry.index.array[i]+vertexOffset;
  vertexOffset+=source.length/8;indexOffset+=geometry.index.count;
 }
 const interleaved=new THREE.InterleavedBuffer(vertices,8),geometry=new THREE.BufferGeometry(),position=new THREE.InterleavedBufferAttribute(interleaved,3,0);
 geometry.setAttribute('position',position);geometry.setAttribute('vPosition',position);
 geometry.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(interleaved,3,3));geometry.setAttribute('tc',new THREE.InterleavedBufferAttribute(interleaved,2,6));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));return geometry;
}

function batchKey(part){
 const {record,source}=part;
 // A transparent DoubleSide material with forceSinglePass=false renders twice.
 // Combining those would reorder back/front passes across source meshes.
 if(source.record.transform!=='identity'||!supportedGeometry(part.mesh.geometry))return null;
 if(part.material.transparent&&part.material.side===THREE.DoubleSide&&!part.material.forceSinglePass)return null;
 // JSON alone loses signed zero. Uniform equality must retain that bit too.
 return JSON.stringify([record.program,record.state,record.uniforms,record.samplers,source.record.textures,part.material.side,part.material.transparent,part.material.forceSinglePass],(_key,value)=>Object.is(value,-0)?'native-negative-zero':value);
}

export function createNativeStaticBatches(pass){
 const groups=[];let members=[],previous;
 function flush(){
  if(members.length>1){
   const geometry=mergeNativeStaticGeometry(members.map(part=>part.mesh.geometry)),first=members[0],mesh=new THREE.Mesh(geometry,first.material);
   mesh.name='NativeStaticBatch:'+first.mesh.name;mesh.frustumCulled=false;mesh.renderOrder=first.mesh.renderOrder;mesh.visible=false;
   const sources=members.map(part=>{const geometry=part.mesh.geometry,vertices=geometry.getAttribute('vPosition').data,index=geometry.index;return{geometry,vertices,vertexArray:vertices.array,vertexVersion:vertices.version,index,indexArray:index.array,indexVersion:index.version};});
   pass.scene.add(mesh);groups.push({members,mesh,sources});
  }
  members=[];
 }
 for(const part of pass.parts){const key=batchKey(part);if(key===null||key!==previous)flush();if(key!==null)members.push(part);previous=key;}flush();
 return{groups,updateVisibility(enabled=true){
  // The caller restores source visibility before each build. A mixed group
  // keeps its original individual draws, including their original order.
  for(const group of groups){
   group.mesh.visible=enabled&&group.members.every((part,i)=>{
    const source=group.sources[i],geometry=part.mesh.geometry;
    return part.mesh.visible&&geometry===source.geometry&&supportedGeometry(geometry)
     &&geometry.getAttribute('vPosition').data===source.vertices&&source.vertices.array===source.vertexArray&&source.vertices.version===source.vertexVersion
     &&geometry.index===source.index&&source.index.array===source.indexArray&&source.index.version===source.indexVersion;
   });
   if(group.mesh.visible)for(const part of group.members)part.mesh.visible=false;
  }
 },dispose(){for(const group of groups){pass.scene.remove(group.mesh);group.mesh.geometry.dispose();}}};
}
