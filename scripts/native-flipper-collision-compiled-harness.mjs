// Explicit scratch component calls to the original HitFlipper::Collide.
// No engine instructions, native gameplay state, clock or RNG are restored.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export async function nativeFlipperCollisionOracle(){
  const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=b=>createHash('sha256').update(b).digest('hex'),engineSHA256=sha(bytes);
  assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  const module=new WebAssembly.Module(bytes),imports={},imported=WebAssembly.Module.imports(module).length;
  for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected isolated flipper collision import '+item.name);};}
  let p=8,functionSHA256;const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
  while(p<bytes.length){const kind=bytes[p++],size=u(),end=p+size;if(kind===10)for(let count=u(),i=0;i<count;i++){const length=u();if(i+imported===4466)functionSHA256=sha(bytes.subarray(p,p+length));p+=length;}p=end;}
  assert.equal(functionSHA256,'8ec4314512b0d276be9b96b9dbf9e90b144f3e792a0103f718863c362112c7f5');
  const n=(await WebAssembly.instantiate(module,imports)).exports,base=64*1024*1024,size=1024*1024;
  if(n.memory.buffer.byteLength<base+size)n.memory.grow(Math.ceil((base+size-n.memory.buffer.byteLength)/65536));
  const v=new DataView(n.memory.buffer),slot=v.getUint32(1434840+16,true),collide=n.__indirect_function_table.get(slot);
  assert.equal(slot,7260);assert.equal(collide.name,'4466');
  const ball=base+512,event=base+1024,player=base+4096,fp=(at,value)=>v.setFloat32(at,value,true),get=at=>v.getFloat32(at,true),vector=at=>({x:get(at),y:get(at+4),z:get(at+8)});
  return {engineSHA256,functionSHA256,functionIndex:4466,tableSlot:slot,collide(input){
    new Uint8Array(n.memory.buffer,base,size).fill(0);
    // Original event dispatch is suppressed by the explicit zero component
    // clock. The fake player has no live UI; physics functions are unchanged.
    v.setUint32(9191328,player,true);
    for(const [offset,value]of [[44,input.material.elasticity],[48,input.material.elasticity_falloff],[52,input.material.friction],[136,input.center.x],[140,input.center.y],[160,input.flipperMomentum],[168,input.flipperSpeed],[180,input.contactTorque],[192,input.inertia]])fp(base+offset,value);
    v.setUint8(base+212,Number(input.inContact));
    for(const [offset,values]of [[128,input.position],[140,input.velocity],[196,input.momentum]])for(const [i,axis]of ['x','y','z'].entries())fp(ball+offset+i*4,values[axis]);
    fp(ball+152,25);fp(ball+156,1);
    v.setUint32(event,ball,true);fp(event+12,input.gap);
    for(const [i,axis]of ['x','y','z'].entries())fp(event+16+i*4,input.normal[axis]);
    v.setUint8(event+44,Number(input.hitMomentBit));
    collide(base,event);
    return {position:vector(ball+128),velocity:vector(ball+140),momentum:vector(ball+196),flipperMomentum:get(base+160),flipperSpeed:get(base+168)};
  }};
}
