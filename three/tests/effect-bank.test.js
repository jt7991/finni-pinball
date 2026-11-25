import fs from'node:fs';import test from'node:test';import assert from'node:assert/strict';import{verifyEffectBank}from'../../scripts/verify-effect-bank.mjs';import{crc32,openEffectBank}from'../effect-bank.js';
import{fileURLToPath}from'node:url';
import{nativeSourceAssets}from'../../scripts/native-source-assets.mjs';
const root=new URL('../public/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('audio.json',root))),index=JSON.parse(fs.readFileSync(new URL('native-audio/effects.json',root))),bytes=fs.readFileSync(new URL('native-audio/'+index.file,root));
test('the current source bank retains all original files and every independently checked frame boundary',()=>{const report=verifyEffectBank(fileURLToPath(root));assert.equal(report.sources,322);assert.equal(report.bytes,11512404);assert.equal(report.sha256,'f8cd0b147f5b4ddf7f87b55a5c757b077e05a0a0272b79a074f79df591fab7ad');});
test('the preceding native source bank remains independently verifiable for its original recordings',()=>{const old=nativeSourceAssets('3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14'),report=verifyEffectBank(fileURLToPath(root),{manifest:old.json('audio.json'),index:old.json('native-audio/effects.json')});assert.equal(report.sources,322);assert.equal(report.bytes,11530018);assert.equal(report.sha256,'b30043752476bb0be40acb3efa9325b1898452fa841f453c11414067a716823e');});
test('corrupt payloads, stale source formats and inconsistent frame spans cannot become ready',()=>{
 assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);const changed=Buffer.from(bytes);changed[100]^=1;assert.throws(()=>openEffectBank(manifest,index,changed),/differs/);
 const stale=structuredClone(index),file=manifest.fx_flipperup.file;stale.sources[file].frames++;assert.throws(()=>openEffectBank(manifest,stale,bytes),/manifest/);
 const badIndex=structuredClone(index);badIndex.sources[file].blocks[0][0]++;assert.throws(()=>openEffectBank(manifest,badIndex,bytes),/incomplete/);
});
