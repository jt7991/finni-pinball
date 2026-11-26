// Lossless storage only: native body vectors are Float32, so keep their bits
// instead of decimal text. XOR with the prior body of the same ID compresses
// slow changes without quantization, omitted observations or replay inputs.
import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from 'node:url';import{gzipSync}from 'node:zlib';
const columns=[['position',3],['velocity',3],['momentum',3],['orientation',9]],keys=['id','owner','address',...columns.map(([name])=>name),'locked'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function packNativeHistoryState(bytes){
 const original=JSON.parse(bytes),words=[],previous=new Map(),scratch=new DataView(new ArrayBuffer(4));
 const walk=value=>{
  if(Array.isArray(value))return value.map(walk);
  if(value===null||typeof value!=='object')return value;
  if(Object.keys(value).join(',')===keys.join(',')){
   const old=previous.get(value.id)??new Uint32Array(18),offset=words.length;
   let index=0;
   for(const [name,length]of columns){assert.equal(value[name].length,length);for(const number of value[name]){assert.ok(Number.isFinite(number));assert.equal(Math.fround(number),number);scratch.setFloat32(0,number,true);const word=scratch.getUint32(0,true);words.push((word^old[index])>>>0);old[index++]=word;}}
   previous.set(value.id,old);return {id:value.id,owner:value.owner,address:value.address,$body:offset,locked:value.locked};
  }
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,walk(item)]));
 };
 const source=walk(original),data=Buffer.alloc(words.length*4);words.forEach((word,index)=>data.writeUInt32LE(word,index*4));
 const packaged={format:'native-history-state-xor-v1',sourceSHA256:sha(bytes),sourceBytes:bytes.length,source,data:data.toString('base64')};
 // Require exact reconstruction of the entire original capture, including
 // external clocks, provenance and diagnostics, before publishing a package.
 unpackNativeHistoryState(packaged);return packaged;
}
export function unpackNativeHistoryState(packaged){
 assert.equal(packaged.format,'native-history-state-xor-v1');const data=Buffer.from(packaged.data,'base64'),previous=new Map(),scratch=new DataView(new ArrayBuffer(4));let consumed=0;
 const walk=value=>{
  if(Array.isArray(value))return value.map(walk);
  if(value===null||typeof value!=='object')return value;
  if(Object.hasOwn(value,'$body')){
   assert.equal(value.$body,consumed);const old=previous.get(value.id)??new Uint32Array(18),result={id:value.id,owner:value.owner,address:value.address};let index=0;
   for(const [name,length]of columns)result[name]=Array.from({length},()=>{const word=(data.readUInt32LE(consumed++*4)^old[index])>>>0;old[index++]=word;scratch.setUint32(0,word,true);return scratch.getFloat32(0,true);});
   previous.set(value.id,old);result.locked=value.locked;return result;
  }
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,walk(item)]));
 };
 const result=walk(packaged.source),bytes=Buffer.from(JSON.stringify(result));assert.equal(consumed*4,data.length);assert.equal(bytes.length,packaged.sourceBytes);assert.equal(sha(bytes),packaged.sourceSHA256,'Every original capture byte is reconstructed');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2);assert.ok(input&&output,'Usage: node scripts/native-history-state-package.mjs <capture.json> <new.json.gz>');
 const packet=packNativeHistoryState(fs.readFileSync(input)),bytes=gzipSync(JSON.stringify(packet),{level:9});fs.writeFileSync(output,bytes,{flag:'wx'});
 console.log(JSON.stringify({file:output,bytes:bytes.length,sha256:sha(bytes),sourceSHA256:packet.sourceSHA256,sourceBytes:packet.sourceBytes}));
}
