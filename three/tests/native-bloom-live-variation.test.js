import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the original VPX program exhibits both retained bloom hashes under a checked fixed-input live component',()=>{
  const bytes=fs.readFileSync(new URL('fixtures/vpx-native-fixed-bloom-live.json.gz',import.meta.url));
  assert.equal(sha(bytes),'3dd3b9c535eed839c7b625a58e93b6757a3c5e57dffa8ef912faa2d64554635f');
  const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-fixed-bloom-live-v1');
  const source=Buffer.from(packet.sourceBase64,'base64');assert.equal(source.length,336759);assert.equal(source.length,packet.sourceBytes);assert.equal(sha(source),packet.sourceSHA256);assert.equal(packet.sourceSHA256,'314ebb1ea46a6316d4e0e147f1547e8bc7f67ea569a5c672a24026532a8b713e');
  assert.equal(sha(Buffer.from(packet.producer.probeBase64,'base64')),packet.producer.probeSHA256);assert.equal(packet.producer.probeSHA256,'8ef089c3bcfae5ececf09024afc525e86767e005740c0594d4941040d5ba8006');
  assert.equal(sha(Buffer.from(packet.producer.readbackHelperBase64,'base64')),packet.producer.readbackHelperSHA256);assert.equal(packet.producer.readbackHelperSHA256,'ae474c1d74d1ab2422d311fd9fc3fbd9deab9a050a94d02f53b92796a7c520c5');
  const r=JSON.parse(source),originalBytes=fs.readFileSync(new URL('fixtures/vpx-native-bloom-component-hard-round.json.gz',import.meta.url));assert.equal(sha(originalBytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');const original=JSON.parse(gunzipSync(originalBytes));
  assert.equal(r.fixtureSHA256,'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
  assert.equal(r.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(r.referenceMetadata.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(r.referenceMetadata.controlledSha256,r.referenceMetadata.sourceSha256);assert.deepEqual(r.referenceMetadata.controlledOverrides,{});
  assert.equal(r.source.captureSHA256,'4f3d3a8424e4f6b721401cf115d196bd07af150c27ab5fc3a50b8169c759601d');
  assert.equal(r.state.graphicsProfile,'detailed');assert.equal(r.state.rows,1200);assert.equal(r.rows.length,1200);assert.deepEqual(r.errors,[]);assert.deepEqual(r.state.errors,[]);assert.deepEqual(r.state.restoreErrors,[]);
  assert.deepEqual(r.state.priorErrors,[{sample:1,error:1280},{sample:23,error:1280}],'Prior GL errors stay explicit; the component does not erase them');
  assert.deepEqual(r.state.encoding,{reads:1200,deferred:1200,encodes:0,queued:1200,completed:1200},'All snapshots complete after the bounded draw window and before encoding/hashing');
  assert.deepEqual(r.state.shaderSourceHashes,original.programs.find(p=>p.name==='fb_blur_horiz39x39').shaders.map(s=>({type:s.type,sha256:sha(s.source)})));
  const baseline='842d30140550db5f37befddd3b3a265c3ec5fd0312363e7da9c40e229815b3aa',alternate=original.frame.images.bloomHorizontal.sha256;
  assert.equal(alternate,'e8ab64ad3d6ad26053b07fd2f04b6e30ecba235023530b9a81fb50314ba1e163');assert.equal(r.nativeExpectedSHA256,alternate);
  assert.deepEqual(Object.keys(r.groups).sort(),[baseline,alternate].sort());assert.equal(r.groups[baseline].length,1199);assert.deepEqual(r.groups[alternate],[508]);
  const uniforms=original.frame.draws.find(d=>d.name==='fb_blur_horiz39x39').uniforms.w_h_height;
  for(const [i,row]of r.rows.entries()){assert.equal(row.sample,i+1);assert.deepEqual(row.uniforms,uniforms);assert.ok(Number.isInteger(row.unit)&&row.unit>=0&&row.unit<16);if(i)assert.ok(row.tonemap>r.rows[i-1].tonemap);assert.equal(row.sha256,row.sample===508?alternate:baseline);}
  assert.equal(r.rows[506].unit,r.rows[507].unit,'Adjacent baseline and alternate samples both use sampler unit 15');
  // This is evidence about a declared native component, not an acceptance
  // envelope for production. The historical failing-frame gate stays strict.
});
