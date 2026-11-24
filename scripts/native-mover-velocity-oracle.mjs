// Original pure GateMoverObject/SpinnerMoverObject velocity callbacks. These
// controlled unit inputs live in scratch memory; full-table captures continue
// to use original initialization and never restore native body/RNG state.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export async function nativeMoverVelocities(){
 const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=b=>createHash('sha256').update(b).digest('hex'),module=new WebAssembly.Module(bytes);
 assert.equal(sha(bytes),'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const functions={gate:{index:4418,slot:7238},spinner:{index:4422,slot:7241}},imported=WebAssembly.Module.imports(module).filter(item=>item.kind==='function').length,hashes={};let p=8;
 const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
 while(p<bytes.length){const section=bytes[p++],size=u(),end=p+size;assert.notEqual(section,8);if(section===10){for(let count=u(),i=0;i<count;i++){const length=u(),index=i+imported;if(Object.values(functions).some(item=>item.index===index))hashes[index]=sha(bytes.subarray(p,p+length));p+=length;}}p=end;}
 const imports={};for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected mover oracle import '+item.name);};}
 const {exports:n}=await WebAssembly.instantiate(module,imports),base=64*1024*1024;
 n.memory.grow(Math.ceil((base+65536-n.memory.buffer.byteLength)/65536));const v=new DataView(n.memory.buffer),fp=(offset,value)=>v.setFloat32(base+offset,value,true);
 for(const entry of Object.values(functions)){assert.equal(n.__indirect_function_table.get(entry.slot).name,String(entry.index));assert.equal(n.__indirect_function_table.get(entry.slot).length,1);}
 return {functions,hashes,run(kind,input){
  assert.ok(Object.hasOwn(functions,kind));new Uint8Array(n.memory.buffer,base,64).fill(0);fp(8,input.speed);fp(12,input.angle);
  if(kind==='gate'){fp(16,input.damping);fp(20,input.gravity);fp(24,input.min);v.setUint8(base+32,Number(input.open));}
  else fp(28,input.damping);
  n.__indirect_function_table.get(functions[kind].slot)(base);
  return {angle:v.getFloat32(base+12,true),speed:v.getFloat32(base+8,true)};
 }};
}
