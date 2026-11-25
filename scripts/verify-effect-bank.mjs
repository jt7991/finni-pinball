import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{effectCatalogue,openEffectBank}from'../three/effect-bank.js';import{indexAuthoredFLAC}from'../three/flac-source.js';
export function verifyEffectBank(publicDirectory,source={}){
 const manifest=source.manifest??JSON.parse(fs.readFileSync(path.join(publicDirectory,'audio.json'))),metadata=source.index??JSON.parse(fs.readFileSync(path.join(publicDirectory,'native-audio/effects.json')));assert.match(metadata.file,/^effects-[a-f0-9]{24}\.bank$/);
 const bytes=fs.readFileSync(path.join(publicDirectory,'native-audio',metadata.file)),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),metadata.sha256,'Encoded bank changed');const opened=openEffectBank(manifest,metadata,bytes);
 for(const entry of effectCatalogue(manifest)){
  const name=Object.keys(manifest).find(name=>manifest[name].file===entry.file),source=opened.get(name),original=fs.readFileSync(path.join(publicDirectory,'audio',entry.file));assert.equal(sha(source.encoded),entry.encodedSHA256);assert.equal(sha(original),entry.encodedSHA256);assert.deepEqual(source.index,indexAuthoredFLAC(source.encoded,entry),'Encoded frame boundaries changed');
 }
 return{sources:opened.size,bytes:opened.byteLength,sha256:metadata.sha256};
}
