// Call the original HitFlipper virtual HitTest in an isolated scratch arena.
// No compiled instruction, global clock, random state or live table is changed.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export async function nativeFlipperHitOracle(){
 const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),engineSHA256=sha(bytes);
 assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const module=new WebAssembly.Module(bytes),imports={};for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected HitFlipper oracle import '+item.name);};}
 const n=(await WebAssembly.instantiate(module,imports)).exports,base=64*1024*1024;
 if(n.memory.buffer.byteLength<base+65536)n.memory.grow(Math.ceil((base+65536-n.memory.buffer.byteLength)/65536));
 const v=new DataView(n.memory.buffer),fp=(offset,value)=>v.setFloat32(base+offset,value,true),get=offset=>v.getFloat32(base+offset,true),slot=v.getUint32(1434840+8,true),callback=n.__indirect_function_table.get(slot),f=Math.fround;
 assert.equal(slot,7258);assert.equal(callback.name,'4464');
 // Pin the original HitTest and its face helper, not just the table slot.
 const functions={hit:4464,face:4465},functionSHA256={},imported=WebAssembly.Module.imports(module).length;let p=8;
 const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
 while(p<bytes.length){const section=bytes[p++],size=u(),end=p+size;if(section===10)for(let count=u(),i=0;i<count;i++){const length=u();if(Object.values(functions).includes(i+imported))functionSHA256[i+imported]=sha(bytes.subarray(p,p+length));p+=length;}p=end;}
 return {engineSHA256,functions,functionSHA256,hit({flipper,position,velocity,radius,duration}){
  new Uint8Array(n.memory.buffer,base,1024).fill(0);
  fp(36,0);fp(40,flipper.height*100);fp(108,0);fp(112,flipper.height*100);v.setUint8(base+133,1);
  fp(136,flipper.p.x*100);fp(140,2115-flipper.p.y*100);fp(144,flipper.baseRadius*100);fp(152,flipper.endRadius*100);fp(156,flipper.length*100);
  fp(168,-flipper.nativeMotion.speed);fp(172,flipper.nativeAngle);fp(184,flipper.nativeRestAngle);fp(188,flipper.nativeRaisedAngle);fp(192,flipper.nativeMotion.inertia);
  const ratio=f(f(get(144)-get(152))/get(156));fp(200,f(Math.sqrt(f(1-f(ratio*ratio)))));fp(204,-ratio);v.setUint8(base+213,1);v.setUint8(base+214,Number(flipper.lastHitFace??false));
  [position.x*100,2115-position.y*100,position.z*100].forEach((value,i)=>fp(512+i*4,value));[velocity.x,-velocity.y,velocity.z].forEach((value,i)=>fp(524+i*4,value));fp(536,radius*100);fp(540,1);
  const time=callback(base,base+512,f(duration*100),base+256);
  if(time<0)return null;
  return {time:time*.01,gap:get(268)*.01,normal:{x:get(272),y:-get(276),z:get(280)},contact:!!v.getUint8(base+302),hitMomentBit:!!v.getUint8(base+300),...(v.getUint8(base+302)?{vn:get(296)}:{})};
 }};
}
