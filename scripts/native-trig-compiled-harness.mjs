// Standalone math oracle. Only exports are added; every compiled instruction
// remains original. Full-table recordings continue to use the unmodified WASM.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export async function nativeTrig(){
 const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm'),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 let p=8;const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;},leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b);}while(n);return Buffer.from(a);},str=s=>Buffer.concat([leb(s.length),Buffer.from(s)]),functions={sin:18857,cos:18714},parts=[bytes.subarray(0,8)],hashes={};
 const imported=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(i=>i.kind==='function').length;
 while(p<bytes.length){const begin=p,k=bytes[p++],size=u(),end=p+size;assert.notEqual(k,8);
  if(k===7){const count=u(),payload=Buffer.concat([leb(count+2),bytes.subarray(p,end),...Object.entries(functions).flatMap(([name,index])=>[str('ref_'+name),Buffer.from([0]),leb(index)])]);parts.push(Buffer.from([7]),leb(payload.length),payload);}
  else{if(k===10){for(let n=u(),i=0;i<n;i++){const length=u();if(Object.values(functions).includes(i+imported))hashes[i+imported]=sha(bytes.subarray(p,p+length));p+=length;}}parts.push(bytes.subarray(begin,end));}p=end;
 }
 const module=new WebAssembly.Module(Buffer.concat(parts)),imports={};for(const item of WebAssembly.Module.imports(module)){assert.equal(item.kind,'function');(imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected math oracle import '+item.name);};}
 const {exports:n}=await WebAssembly.instantiate(module,imports);assert.equal(n.ref_sin(0),0);assert.equal(n.ref_cos(0),1);
 return {sin:n.ref_sin,cos:n.ref_cos,hashes,functions};
}
