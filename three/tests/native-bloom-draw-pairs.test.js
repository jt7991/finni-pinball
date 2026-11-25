import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('native and Three.js fixed-input consecutive draws vary despite matching recorded state and stable repeated readbacks',()=>{
  const bytes=fs.readFileSync(new URL('fixtures/vpx-three-fixed-bloom-pairs.json.gz',import.meta.url));assert.equal(sha(bytes),'1cff3ae83a91909199ef9e3a734c015e867ff4b1d1777325cdccd98ef46ed291');
  const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-port-bloom-pairs-v1');assert.equal(packet.reports.length,2);assert.equal(sha(packet.stateReaderSource),packet.stateReaderSHA256);assert.equal(packet.stateReaderSHA256,'a75e3f5c863eeecfc679d7a1cf5882a622d891e07476c579184a6518990e8939');
  const originalBytes=fs.readFileSync(new URL('fixtures/vpx-native-bloom-component-hard-round.json.gz',import.meta.url));assert.equal(sha(originalBytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');const original=JSON.parse(gunzipSync(originalBytes)),shaders=original.programs.find(p=>p.name==='fb_blur_horiz39x39').shaders;
  const expected=[{runtime:'vpx',bytes:51397912,sha256:'35ea8fe6bd8484f3ff7c7126749c9a07b8a0a7dbb31190983f393a67c0894c77',different:4},{runtime:'threejs',bytes:37986496,sha256:'1fb46d7e6837c2896024132f53629b3304c40f7ec94ad87a63cd668ba1e540a1',different:30}];
  const known=['842d30140550db5f37befddd3b3a265c3ec5fd0312363e7da9c40e229815b3aa','e8ab64ad3d6ad26053b07fd2f04b6e30ecba235023530b9a81fb50314ba1e163'];
  for(const [i,record]of packet.reports.entries()){
    const reference=expected[i],source=Buffer.from(record.sourceBase64,'base64');assert.equal(source.length,reference.bytes);assert.equal(source.length,record.sourceBytes);assert.equal(sha(source),record.sourceSHA256);assert.equal(record.sourceSHA256,reference.sha256);
    const r=JSON.parse(source);assert.equal(r.playerRuntime,reference.runtime);assert.equal(r.referenceMetadata.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(r.fixtureSHA256,sha(originalBytes));assert.equal(r.source.captureSHA256,'4f3d3a8424e4f6b721401cf115d196bd07af150c27ab5fc3a50b8169c759601d');
    const installation=Buffer.from(r.instrumentation.sourceBase64,'base64');assert.equal(sha(installation),r.instrumentation.sourceSHA256);assert.ok(installation.toString().includes(packet.stateReaderSource));assert.equal(r.diagnostics.stateReaderSHA256,packet.stateReaderSHA256);for(const key of ['observeDrawState','pairedDraws','verifyInput','repeatReadback'])assert.equal(r.diagnostics[key],true);
    assert.equal(r.state.graphicsProfile,'detailed');assert.deepEqual(r.errors,[]);assert.deepEqual(r.state.errors,[]);assert.deepEqual(r.state.restoreErrors,[]);assert.equal(r.rows.length,1200);assert.equal(r.state.rows,1200);assert.deepEqual(r.state.encoding,{reads:4800,deferred:4800,encodes:0,queued:4800,completed:4800});
    if(i===0){assert.equal(r.engineSHA256,original.engineSHA256);assert.deepEqual(r.referenceMetadata.controlledOverrides,{});assert.deepEqual(r.state.priorErrors,[{sample:1,error:1280},{sample:7,error:1280}]);}else{assert.equal(Object.hasOwn(r,'engineSHA256'),false,'Port does not run VPX WASM');assert.equal(r.referenceMetadata.observedEngineSHA256,original.engineSHA256);assert.equal(r.referenceMetadata.visualPackSourceSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.deepEqual(r.state.priorErrors,[]);}
    const actualSources=shaders.map(s=>{assert.doesNotMatch(s.source,/\bSHADER_(?:TYPE|NAME)\b/);const source=i?'#version 300 es\n#define SHADER_TYPE RawShaderMaterial\n#define SHADER_NAME \n'+s.source.replace(/^#version[^\n]*\n/,''):s.source;return{type:s.type,sha256:sha(source)};});assert.deepEqual(r.state.shaderSourceHashes,actualSources,'Original shader bytes, with only the observed unused Three.js name/type prefix');
    let differing=0;const outputs=new Set();
    for(const [index,row]of r.rows.entries()){
      assert.equal(row.sample,index+1);if(index)assert.ok(row.tonemap>r.rows[index-1].tonemap);assert.equal(row.inputSHA256,original.frame.images.bloomCut.sha256);assert.equal(row.sha256,row.repeatSHA256,'Repeated readbacks without a draw in between');assert.equal(row.stateSHA256,sha(JSON.stringify(row.stateBefore)));assert.equal(row.pairedStateSHA256,sha(JSON.stringify(row.statePaired)));assert.deepEqual(row.stateBefore,row.statePaired);assert.equal(row.stateSHA256,row.pairedStateSHA256);assert.deepEqual(row.stateBefore.args,i?[4,6,5123,0]:[5,0,4]);
      assert.equal(row.stateBefore.caps.BLEND,false);assert.equal(row.stateBefore.caps.DEPTH_TEST,false);assert.deepEqual(row.stateBefore.vertices.values,original.frame.draws.find(d=>d.name==='fb_blur_horiz39x39').bloomState.vertices);assert.deepEqual(row.uniforms,original.frame.draws.find(d=>d.name==='fb_blur_horiz39x39').uniforms.w_h_height);
      for(const hash of [row.sha256,row.pairedSHA256]){assert.ok(known.includes(hash));outputs.add(hash);}if(row.sha256!==row.pairedSHA256)differing++;
    }
    assert.equal(outputs.size,2);assert.equal(differing,reference.different);
  }
  // These observations diagnose shared drawing variation. They are never
  // substituted for a historical frame expectation or a production buffer.
});
