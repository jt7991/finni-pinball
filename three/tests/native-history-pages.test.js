import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';import{NativeHistoryPageWriter,readNativeHistoryCapture,hashNativeHistoryJSON}from'../../scripts/native-history-pages.mjs';
import{gunzipSync}from'node:zlib';import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';import{nativeHistoryArrayPaths}from'../../scripts/native-history-pages.mjs';
test('paged native transport reconstructs every original JSON byte across boundaries and bodies',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-history-pages-'));try{
  const body={id:3,owner:100,address:388,position:[1.25,-2,25],velocity:[0,1,2],momentum:[3,4,5],orientation:[1,0,0,0,1,0,0,0,1],locked:false},original={frames:[{frameIndex:1,snapshot:{balls:[body]}},{frameIndex:2,snapshot:{balls:[{...body,position:[1.5,-2,25]}]}}],startup:{boundaries:[{ms:1,balls:[body]},{ms:2,balls:[body]}]},playerInputs:[{ms:1,script:'ordinary input'}],scope:'Original \u2603',errors:[]},writer=new NativeHistoryPageWriter(dir);
  for(const keys of [['frames'],['startup','boundaries'],['playerInputs']]){const rows=keys.reduce((v,k)=>v[k],original);for(const row of rows)writer.add(keys,Buffer.from(JSON.stringify([row])));}
  const manifest=writer.finish({...original,frames:[],startup:{boundaries:[]},playerInputs:[]}),loaded=readNativeHistoryCapture(path.join(dir,'capture-pages.json')),expected=Buffer.from(JSON.stringify(original));assert.deepEqual([...loaded.frames],original.frames);assert.deepEqual([...loaded.startup.boundaries],original.startup.boundaries);assert.deepEqual(loaded.playerInputs,original.playerInputs);assert.deepEqual(loaded.frames.at(-1),original.frames.at(-1));assert.deepEqual(hashNativeHistoryJSON(loaded),{logicalJSONBytes:expected.length,logicalJSONSHA256:createHash('sha256').update(expected).digest('hex')});assert.equal(manifest.arrays[0].count,2);
  const page=path.join(dir,manifest.arrays[0].pages[0].file),bytes=fs.readFileSync(page);bytes[bytes.length-1]^=1;fs.writeFileSync(page,bytes);assert.throws(()=>readNativeHistoryCapture(path.join(dir,'capture-pages.json')),/Compressed native page changed/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('paged native input reproduces all original launch/control boundaries without changing replay checks',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-history-replay-'));try{
  const bytes=gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-launched-controls-state-native.json.gz',import.meta.url)));assert.equal(createHash('sha256').update(bytes).digest('hex'),'607cd21e81a1df7c6de4363dada3ed2a1b3016f51fa116332f5ab298c7783161');
  const original=JSON.parse(bytes),metadata=structuredClone(original),writer=new NativeHistoryPageWriter(dir);
  for(const keys of nativeHistoryArrayPaths){const parent=keys.slice(0,-1).reduce((v,k)=>v?.[k],metadata),rows=parent?.[keys.at(-1)];if(!rows?.length)continue;for(let i=0;i<rows.length;i+=113)writer.add(keys,Buffer.from(JSON.stringify(rows.slice(i,i+113))));parent[keys.at(-1)]=[];}
  const manifest=writer.finish(metadata);assert.deepEqual(hashNativeHistoryJSON(original),{logicalJSONBytes:manifest.logicalJSONBytes,logicalJSONSHA256:manifest.logicalJSONSHA256});
  const loaded=readNativeHistoryCapture(path.join(dir,'capture-pages.json'));assert.equal(loaded.frames.length,64);assert.equal(loaded.startup.boundaries.length,10000);
  assert.deepEqual(await compareNativeHistoryState(loaded),{framesChecked:64,intervalsChecked:10000,ticks:10230,randomizeClockSamples:2,timerClockSamples:4});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
