// Isolated original HitBall::Collide3DWall. Only an export is added; every
// compiled instruction remains original. Scratch component inputs are explicit.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
export async function nativeWall(){
 const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=x=>createHash('sha256').update(x).digest('hex');assert.equal(sha(bytes),'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 let p=8;const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;},leb=n=>{const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return Buffer.from(out);},str=s=>Buffer.concat([leb(s.length),Buffer.from(s)]),index=4452,parts=[bytes.subarray(0,8)],imported=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(x=>x.kind==='function').length;let functionSHA256;
 while(p<bytes.length){const begin=p,kind=bytes[p++],size=u(),end=p+size;assert.notEqual(kind,8);
  if(kind===7){const count=u(),payload=Buffer.concat([leb(count+1),bytes.subarray(p,end),str('ref_collide'),Buffer.from([0]),leb(index)]);parts.push(Buffer.from([7]),leb(payload.length),payload);}
  else{if(kind===10)for(let count=u(),i=0;i<count;i++){const length=u();if(i+imported===index)functionSHA256=sha(bytes.subarray(p,p+length));p+=length;}parts.push(bytes.subarray(begin,end));}p=end;
 }
 assert.equal(functionSHA256,'aa706fb6bc33224dd51be5b28a86e8c72ce33f61a58f8df1e308b1ec5e292dea');
 const module=new WebAssembly.Module(Buffer.concat(parts)),imports={};for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected isolated collision import '+item.name);};}
 const {exports:n}=await WebAssembly.instantiate(module,imports),base=64*1024*1024,needed=base+16384;if(n.memory.buffer.byteLength<needed)n.memory.grow(Math.ceil((needed-n.memory.buffer.byteLength)/65536));const view=new DataView(n.memory.buffer),normal=base+512,player=base+4096,table=base+8192,vector=(at,values)=>values.forEach((value,i)=>view.setFloat32(at+i*4,value,true)),read=at=>[0,4,8].map(i=>view.getFloat32(at+i,true));
 view.setUint32(9191328,player,true);view.setUint32(player+8,table,true);const randomWords=()=>[view.getUint32(7661264,true),view.getUint32(7661268,true)],initialRandomWords=randomWords();
 return{index,functionSHA256,initialRandomWords,randomWords,collide(input){
  new Uint8Array(n.memory.buffer,base,384).fill(0);vector(base+128,input.p);vector(base+140,input.v);vector(base+196,input.m);vector(normal,input.normal);view.setFloat32(base+84,input.gap,true);view.setFloat32(base+152,input.radius,true);view.setFloat32(base+156,input.mass,true);view.setFloat32(table+952,input.difficulty,true);view.setFloat32(9198648,input.defaultScatterRadians??0,true);
  n.ref_collide(base,normal,input.elasticity,input.falloff,input.friction,input.scatterRadians);return{p:read(base+128),v:read(base+140),m:read(base+196),random:randomWords()};
 }};
}
