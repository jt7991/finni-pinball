import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeClassicLightState,nativeClassicUploadState} from '../native-classic-state.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url))),original=read('vpx-classic-pointer-native.json'),current=read('vpx-main-classic-upload-native.json'),bits=values=>Array.from(new Uint32Array(values.buffer,values.byteOffset,values.length));

test('classic light uploads retain every original floored WASM byte, including the observed preceding Boolean',()=>{
 assert.equal(current.engineSHA256,original.engineSHA256);assert.equal(current.tableSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(original.cases.length,25);assert.equal(current.cases.length,25);let fields=0,reused;
 for(const item of [...original.cases,...current.cases]){
  const state=nativeClassicLightState(item.spec,item.state),previous=reused;
  reused=nativeClassicUploadState(state,item.lightingOff??false,reused);if(previous)assert.equal(reused,previous,'Reuse the upload buffer as live light state changes');
  assert.equal(reused.data.getUint8(0),Number(item.lightingOff??false));
  for(const row of item.uploads){assert.deepEqual(bits(state[row.uniform]),row.intendedBits,item.name+' CPU '+row.uniform);assert.deepEqual(bits(reused[row.uniform]),row.uploadedBits,item.name+' actual GPU '+row.uniform);fields+=4;}
 }
 assert.equal(fields,600);assert.equal(current.cases.filter(row=>row.lightingOff).length,1);
});
