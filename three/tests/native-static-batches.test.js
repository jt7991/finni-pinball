import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeNativeStaticGeometry,createNativeStaticBatches} from '../native-static-batches.js';

function geometry(seed=0){
 const values=new Float32Array(new ArrayBuffer(160),32,24);for(let i=0;i<values.length;i++)values[i]=seed+i/8;
 const data=new THREE.InterleavedBuffer(values,8),result=new THREE.BufferGeometry(),p=new THREE.InterleavedBufferAttribute(data,3,0);
 result.setAttribute('position',p);result.setAttribute('vPosition',p);result.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(data,3,3));result.setAttribute('tc',new THREE.InterleavedBufferAttribute(data,2,6));
 result.setIndex(new THREE.BufferAttribute(new Uint32Array([99,2,0,1,99]).subarray(1,4),1));return result;
}
function part(name,{transform='identity',cull=true,uniform=1,texture=0,program='0',forceSinglePass=true}={}){
 const material=new THREE.RawShaderMaterial({side:cull?THREE.FrontSide:THREE.DoubleSide,transparent:true,forceSinglePass}),mesh=new THREE.Mesh(geometry(),material);mesh.name=name;
 return{source:{record:{transform,textures:{tex_base_color:{id:texture}}}},record:{program,state:{cull},uniforms:{color:[uniform,0,0,1]},samplers:{}},mesh,material};
}
function pass(parts){const scene=new THREE.Scene();parts.forEach((part,index)=>{part.mesh.renderOrder=index;scene.add(part.mesh);});return{scene,parts};}
const restore=pass=>{for(const part of pass.parts)part.mesh.visible=true;};

test('merged static geometry retains every vertex bit and the original triangle sequence',()=>{
 const a=geometry(),b=geometry(8),aVertices=a.getAttribute('vPosition').data.array,bVertices=b.getAttribute('vPosition').data.array,words=new Uint32Array(aVertices.buffer,aVertices.byteOffset,aVertices.length);
 words[0]=0x80000000;words[7]=0x7fc01234;
 const merged=mergeNativeStaticGeometry([a,b]),data=merged.getAttribute('vPosition').data;
 const expected=[...words,...new Uint32Array(bVertices.buffer,bVertices.byteOffset,bVertices.length)];
 assert.deepEqual([...new Uint32Array(data.array.buffer)],expected);
 assert.deepEqual([...merged.index.array],[2,0,1,5,3,4]);
 assert.equal(merged.getAttribute('position'),merged.getAttribute('vPosition'));assert.equal(merged.getAttribute('vNormal').data,data);assert.equal(merged.getAttribute('tc').data,data);
 merged.dispose();a.dispose();b.dispose();
});

test('static batches preserve contiguous draw order and use the original material and matrix callback',()=>{
 const items=pass([part('a'),part('b'),part('c',{texture:1}),part('d',{texture:1}),part('e')]);
 const batches=createNativeStaticBatches(items);
 try{
  assert.deepEqual(batches.groups.map(g=>g.members.map(p=>p.mesh.name)),[['a','b'],['c','d']]);
  let uploaded=0;items.parts[0].material.onBeforeRender=()=>uploaded++;
  assert.equal(batches.groups[0].mesh.material,items.parts[0].material);batches.groups[0].mesh.material.onBeforeRender();assert.equal(uploaded,1);
  batches.updateVisibility();const draws=items.scene.children.filter(m=>m.visible).sort((a,b)=>a.renderOrder-b.renderOrder);
  assert.deepEqual(draws.map(m=>m.renderOrder),[0,2,4]);
 }finally{batches.dispose();for(const p of items.parts){p.mesh.geometry.dispose();p.material.dispose();}}
});

test('mixed visibility, changed vertices, changed indices and replaced geometry retain individual source draws',()=>{
 const changes=[
  p=>{p.mesh.visible=false;},
  p=>{const data=p.mesh.geometry.getAttribute('vPosition').data;data.array[0]=99;data.needsUpdate=true;},
  p=>{p.mesh.geometry.index.setX(0,1);p.mesh.geometry.index.needsUpdate=true;},
  p=>{const original=p.mesh.geometry;p.mesh.geometry=geometry(3);original.dispose();},
 ];
 for(const change of changes){
  const items=pass([part('a'),part('b')]),batches=createNativeStaticBatches(items),group=batches.groups[0];let disposed=0;
  group.mesh.geometry.addEventListener('dispose',()=>disposed++);
  try{
   batches.updateVisibility();assert.equal(group.mesh.visible,true);
   restore(items);change(items.parts[0]);batches.updateVisibility();assert.equal(group.mesh.visible,false);assert.equal(items.parts[1].mesh.visible,true);
   restore(items);batches.updateVisibility(false);assert.equal(group.mesh.visible,false);assert.ok(items.parts.every(p=>p.mesh.visible));
  }finally{batches.dispose();assert.equal(disposed,1);assert.ok(!items.scene.children.includes(group.mesh));for(const p of items.parts){p.mesh.geometry.dispose();p.material.dispose();}}
 }
});

test('transforms, distinct uniform zero bits and texture or shader changes cannot coalesce',()=>{
 for(const difference of [{cull:false},{transform:'primitive'},{uniform:-0},{texture:2},{program:'1'}]){
  const initial=difference.uniform===0?{uniform:0}:{},items=pass([part('first',initial),part('different',difference),part('last',initial)]),batches=createNativeStaticBatches(items);
  assert.equal(batches.groups.length,0,JSON.stringify(difference));batches.dispose();for(const p of items.parts){p.mesh.geometry.dispose();p.material.dispose();}
 }
 for(const forceSinglePass of [false,true]){
  const items=pass([part('a',{cull:false,forceSinglePass}),part('b',{cull:false,forceSinglePass})]),batches=createNativeStaticBatches(items);
  assert.equal(batches.groups.length,forceSinglePass?1:0,'only a single-pass DoubleSide material can preserve source draw order');batches.dispose();for(const p of items.parts){p.mesh.geometry.dispose();p.material.dispose();}
 }
});
