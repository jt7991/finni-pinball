import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('isolated original bloom draws stay stable with direct and queued readbacks while retaining the historical mismatch',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-isolated-bloom-repeat-native.json.gz',import.meta.url));
 assert.equal(sha(bytes),'03d0b397c5e09079785f6f7d2df88814e6ef31048edf14a314d68f13c61a15f6');
 const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-isolated-bloom-repeat-v1');assert.equal(packet.reports.length,2);
 const parentBytes=fs.readFileSync(new URL('fixtures/vpx-native-bloom-component-hard-round.json.gz',import.meta.url));
 assert.equal(sha(parentBytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
 const parent=JSON.parse(gunzipSync(parentBytes)),program=parent.programs.find(p=>p.name==='fb_blur_horiz39x39');
 const sources=[{bytes:497121,sha:'8400b626ebb6bca978f390d1744f4f37dfe9b267f31f39a2179a3913683896b7'},{bytes:518153,sha:'175256b65008fe6a824b9fd7ed93c12961f03c55e9e0709d667d8331dc887606'}];
 for(const [i,record]of packet.reports.entries()){
  const source=Buffer.from(record.sourceBase64,'base64');assert.equal(source.length,sources[i].bytes);assert.equal(source.length,record.sourceBytes);assert.equal(sha(source),sources[i].sha);assert.equal(sha(source),record.sourceSHA256);
  const r=JSON.parse(source),s=r.state;assert.equal(r.fixtureSHA256,sha(parentBytes));assert.deepEqual(r.source,parent.source);
  assert.equal(r.observerReadback??false,!!i);assert.equal(r.inputSHA256,parent.frame.images.bloomCut.sha256);
  assert.equal(r.nativeExpectedSHA256,parent.frame.images.bloomHorizontal.sha256);
  const installation=Buffer.from(r.instrumentation.sourceBase64,'base64');assert.equal(sha(installation),r.instrumentation.sourceSHA256);
  for(const shader of program.shaders)assert.ok(installation.toString().includes(JSON.stringify(shader.source)),'Complete unchanged original shader source supplied');
  assert.deepEqual(s.shaderSourceHashes,program.shaders.map(p=>({type:p.type,sha256:sha(p.source)})));
  assert.deepEqual(s.loadedResources,[]);assert.equal(s.hasPlayer,false);assert.deepEqual(r.errors,[]);
  assert.equal(s.inputReads,1200);assert.equal(s.outputReads,3600);assert.equal(s.rows.length,1200);assert.equal(s.groups,1);
  if(i)assert.deepEqual(s.imageEncoding,{reads:4800,deferred:4800,encodes:4800,queued:4800,completed:4800});
  else assert.equal(s.imageEncoding,undefined);
  assert.equal(s.renderer.renderer,'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 (0x00002704) Direct3D11 vs_5_0 ps_5_0, D3D11)');
  assert.equal(r.groups.length,1);const group=r.groups[0],pixels=Buffer.from(group.bytes,'base64');
  assert.equal(group.index,0);assert.equal(pixels.length,57*106*16);assert.equal(sha(pixels),group.sha256);
  assert.equal(group.sha256,'842d30140550db5f37befddd3b3a265c3ec5fd0312363e7da9c40e229815b3aa');assert.notEqual(group.sha256,r.nativeExpectedSHA256,'The historical expected image is still different; this is not a whole-frame parity pass');
  assert.equal(group.first,1200);assert.equal(group.second,1200);
  for(const [n,row]of s.rows.entries())assert.deepEqual(row,{sample:n+1,first:0,second:0});
 }
 // Stable isolated samples do not establish determinism in a full scene or
 // identify a driver cause. Live paired-draw variation is retained separately.
});
