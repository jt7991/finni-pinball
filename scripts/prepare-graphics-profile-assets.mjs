// Preserve the original reference assets and add only independently observed
// native programs/settings. Captured frame inputs/outputs stay in .work.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const root='three/public/native-postprocess/',archive='three/tests/fixtures/source-render-6300.json.gz';
const engine='c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8',source='3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=name=>JSON.parse(fs.readFileSync('.work/three-review/'+name));
const metadata=JSON.parse(fs.readFileSync(root+'native-postprocess.json'));
const original=JSON.parse(gunzipSync(fs.readFileSync(archive)));
if(!original.assets['native-postprocess/native-postprocess.json']){
  assert.equal(metadata.settings.bloomStrength,.3);
  assert.equal(Object.keys(metadata.programs).length,6);
  original.assets['native-postprocess/native-postprocess.json']=structuredClone(metadata);
  fs.writeFileSync(archive,gzipSync(Buffer.from(JSON.stringify(original)),{level:9}));
}
const captures=[read('current-main-performance-postprocess.json'),read('current-main-performance-nudged-postprocess-r2.json'),read('current-main-detailed-postprocess.json')];
const settings=JSON.parse(fs.readFileSync('.work/main-99eff88-assets/table-update.json'));
assert.equal(settings.sourceSha256,source);
const fixtures=[];
for(const capture of captures){
  assert.equal(capture.engineSHA256,engine);assert.equal(capture.reference.sourceSha256,source);assert.deepEqual(capture.errors,[]);
  assert.equal(capture.clockSamples.length,64);
  const tone=capture.stages.at(-1);
  assert.deepEqual(tone.uniforms.bloom_dither_colorgrade,[Number(capture.quality==='detailed'),1,1,0]);
  if(capture.quality==='performance'){
    assert.equal(capture.stages.length,3);
    assert.equal(tone.name,capture.nudgeInput?'fb_rhtonemap':'fb_rhtonemap_no_filter');
    const shaders=capture.programs[tone.program].shaders;
    const write=(suffix,type)=>{const bytes=Buffer.from(shaders.find(s=>s.type===type).source),file=tone.name+suffix;fs.writeFileSync(root+file,bytes);return{file,bytes:bytes.length,sha256:sha(bytes)};};
    metadata.programs[tone.name]={vertex:write('.vert.glsl',35633),fragment:write('.frag.glsl',35632),samplers:Object.fromEntries(Object.entries(tone.inputs).map(([name,input])=>[name,input.parameters]))};
  }else{
    const bloom=capture.stages.find(s=>s.name==='fb_bloom');
    assert.equal(bloom.uniforms.w_h_height[2],Math.fround(settings.globals.bloom_strength));
    assert.equal(capture.stages.find(s=>s.name==='ambient_occlusion').uniforms.AO_scale_timeblur[0],metadata.settings.aoScale);
    metadata.settings.bloomStrength=settings.globals.bloom_strength;
  }
  fixtures.push({quality:capture.quality,nudgeInput:capture.nudgeInput,reference:capture.reference,stages:capture.stages.map(({name,viewport,uniforms,vertices,nativeFrameIndex,inputs,cabinet})=>({name,viewport,uniforms,vertices,nativeFrameIndex,cabinet,samplers:Object.fromEntries(Object.entries(inputs).map(([key,value])=>[key,value.parameters]))})),clockSamples:capture.clockSamples});
}
metadata.sourceSha256=source;
metadata.profiles={performance:{ambientOcclusion:false,bloom:false,reflections:false,maxPixelRatio:1.5,maxBufferWidth:720},detailed:{ambientOcclusion:true,bloom:true,reflections:true}};
fs.writeFileSync(root+'native-postprocess.json',JSON.stringify(metadata));
fs.writeFileSync('three/tests/fixtures/vpx-main-graphics-profiles-native.json.gz',gzipSync(Buffer.from(JSON.stringify({engineSHA256:engine,sourceSha256:source,captures:fixtures,programs:Object.fromEntries(['fb_rhtonemap_no_filter','fb_rhtonemap'].map(name=>[name,metadata.programs[name]])),scope:'Read-only native pass/uniform/quad observations after ordinary Start and optional KeyZ input. Actual native FrameIndex is observed synchronously; no output fitting or renderer state replacement.'})),{level:9}));
console.log(JSON.stringify({programs:Object.keys(metadata.programs),settings:metadata.settings,profiles:metadata.profiles}));
