// Isolated original FlipperMoverObject::UpdateVelocities. Only an export is
// added; the compiled instructions are unchanged. Inputs are explicit component
// states, not observations injected into a running game.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export async function nativeFlipperVelocity() {
  const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm');
  const sha=value=>createHash('sha256').update(value).digest('hex');
  const engineSHA256=sha(bytes);
  assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  const index=4463,imported=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).length;
  let p=8,functionSHA256;
  const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
  const leb=n=>{const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return Buffer.from(out);};
  const label=Buffer.from('ref_velocity'),parts=[bytes.subarray(0,8)];
  while(p<bytes.length){
    const begin=p,kind=bytes[p++],size=u(),end=p+size;assert.notEqual(kind,8);
    if(kind===7){const count=u(),payload=Buffer.concat([leb(count+1),bytes.subarray(p,end),leb(label.length),label,Buffer.from([0]),leb(index)]);parts.push(Buffer.from([7]),leb(payload.length),payload);}
    else{if(kind===10)for(let count=u(),i=0;i<count;i++){const length=u();if(i+imported===index)functionSHA256=sha(bytes.subarray(p,p+length));p+=length;}parts.push(bytes.subarray(begin,end));}
    p=end;
  }
  assert.equal(functionSHA256,'15295c3d687dc67673a1fa86e8c3644937b478c7d0df2a93a1d509c076b5c80f');
  const module=new WebAssembly.Module(Buffer.concat(parts)),imports={};
  for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected isolated velocity import '+item.name);};}
  const {exports:n}=await WebAssembly.instantiate(module,imports),base=64*1024*1024;
  if(n.memory.buffer.byteLength<base+16384)n.memory.grow(Math.ceil((base+16384-n.memory.buffer.byteLength)/65536));
  const v=new DataView(n.memory.buffer),owner=base+4096,table=base+8192;
  const fp=(at,value)=>v.setFloat32(at,value,true),get=offset=>v.getFloat32(base+offset,true);
  return {engineSHA256,index,functionSHA256,update(input){
    new Uint8Array(n.memory.buffer,base,16384).fill(0);
    v.setUint32(base+4,owner,true);v.setUint32(owner+96,table,true);
    for(const [offset,value]of [[352,input.strength],[360,input.returnStrength],[364,0],[368,input.eos],[372,input.eosAngle]])fp(owner+offset,value);
    for(const [offset,value]of [[96,input.momentum],[104,input.speed],[108,input.angle],[112,0],[116,0],[120,input.rest],[124,input.raised],[128,input.inertia]])fp(base+offset,value);
    v.setUint8(base+146,Number(input.raised>input.rest));v.setUint8(base+147,Number(input.pressed));
    n.ref_velocity(base);
    return {angle:get(108),momentum:get(96),speed:get(104),acceleration:get(100),torque:get(112),contactTorque:get(116),contact:!!v.getUint8(base+148)};
  }};
}
