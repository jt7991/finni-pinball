import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {configureRenderer} from '../../browser/renderer.js';
import {nativeGraphicsProfile} from '../graphics-profile.js';
import {nativeTextureProfile} from '../native-basic-render.js';
import {nativePostprocessJitter,nativeScreenNudgeOffset,nativeFullscreenGeometry} from '../native-postprocess.js';
import {nativeShaderArray} from '../native-shader-state.js';import {CabinetNudge} from '../cabinet-nudge.js';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
const fixture=readReferenceFixture(new URL('fixtures/vpx-main-graphics-profiles-native.json.gz',import.meta.url));
const textures=readReferenceFixture(new URL('fixtures/vpx-main-profile-textures-native.json.gz',import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url))),metadata=read('native-postprocess/native-postprocess.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('Three.js explicit graphics flags and pixel density agree with main renderer configuration',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
 try{for(const width of [390,960,1800])for(const dpr of [1,2,3])for(const quality of ['performance','detailed']){
  Object.defineProperty(globalThis,'devicePixelRatio',{value:dpr,configurable:true});let ini;
  const engine={canvas:{parentElement:{clientWidth:width,clientHeight:766}},FS:{mkdirTree(){},writeFile(path,value){ini=value;}}};
  configureRenderer(engine,{mobile:width<1024,quality});const actual=nativeGraphicsProfile(quality,width,dpr);
  assert.equal(actual.density,engine.finniRenderDensity??dpr);
  assert.equal(actual.ambientOcclusion,!ini.includes('DisableAO=1'));assert.equal(actual.bloom,!ini.includes('ForceBloomOff=1'));assert.equal(actual.reflections,!ini.includes('PFReflection=0'));
  assert.equal(actual.maxTextureDimension,Number(ini.match(/MaxTexDimension=(\d+)/)?.[1]??0));
 }}finally{if(original)Object.defineProperty(globalThis,'devicePixelRatio',original);else delete globalThis.devicePixelRatio;}
});
test('current profile buffer sizes, shader choices, flags and jitter agree with native GPU observations',()=>{
 assert.equal(fixture.engineSHA256,metadata.engineSHA256);assert.equal(fixture.sourceSha256,metadata.sourceSha256);
 for(const capture of fixture.captures){
  const profile=nativeGraphicsProfile(capture.quality,390,2),tone=capture.stages.at(-1);
  assert.deepEqual(tone.viewport.slice(2),[Math.floor(390*profile.density),Math.floor(766*profile.density)]);
  assert.deepEqual(capture.stages.map(s=>s.name),capture.quality==='detailed'?['fb_blur_horiz19x19','fb_blur_vert19x19','ambient_occlusion','fb_bloom','fb_blur_horiz39x39','fb_blur_vert39x39','fb_rhtonemap_AO_no_filter']:['fb_blur_horiz19x19','fb_blur_vert19x19',capture.nudgeInput?'fb_rhtonemap':'fb_rhtonemap_no_filter']);
  assert.equal(profile.ambientOcclusion,capture.stages.some(s=>s.name==='ambient_occlusion'));assert.equal(profile.bloom,!!tone.uniforms.bloom_dither_colorgrade[0]);
  if(profile.bloom)assert.equal(capture.stages.find(s=>s.name==='fb_bloom').uniforms.w_h_height[2],metadata.settings.bloomStrength);
  for(const sample of capture.clockSamples){const jitter=nativePostprocessJitter(sample.frame);assert.deepEqual(sample.w_h_height.slice(2),Array.from(nativeShaderArray(sample.name==='ambient_occlusion'?jitter.ao:[jitter.dither,jitter.dither])));}
  if(capture.nudgeInput){const cabinet=new CabinetNudge();cabinet.nudge(90,2);for(let i=0;i<tone.cabinet.elapsed;i++)cabinet.step(Math.fround(6*Math.PI/180));assert.deepEqual([cabinet.nativeOffset.x,cabinet.nativeOffset.y],tone.cabinet.position);const geometry=nativeFullscreenGeometry(0,0,nativeScreenNudgeOffset(cabinet.nativeOffset));assert.deepEqual(Array.from(geometry.getAttribute('position').data.array),tone.vertices);geometry.dispose();}
 }
 for(const [name,program]of Object.entries(fixture.programs)){assert.deepEqual(metadata.programs[name],program);for(const descriptor of [program.vertex,program.fragment]){const bytes=fs.readFileSync(new URL('../public/native-postprocess/'+descriptor.file,import.meta.url));assert.equal(bytes.length,descriptor.bytes);assert.equal(sha(bytes),descriptor.sha256);}}
});
test('graphics profiles select the independently associated native image uploads and current playfield for inserts',()=>{
 const table=read('native-table/native-table.json'),classic=read('native-classic/native-classic.json');assert.equal(table.sourceTableSHA256,textures.sourceSha256);
 assert.ok(table.parts.every(part=>!['1','2','9'].includes(String(part.textures.tex_base_color?.id))),'Current authored images also reach hidden wall bottoms');
 for(const quality of ['performance','detailed']){
  const selected=nativeTextureProfile(table,quality);
  for(const variant of textures.variants){const spec=selected.textures[variant.id],expected=variant[quality];assert.equal(spec.width,expected.width);assert.equal(spec.height,expected.height);assert.equal(spec.levels[0].sourceSHA256,expected.sha256);assert.ok(variant.associations.length);const bytes=fs.readFileSync(new URL('../public/native-table/'+spec.levels[0].file,import.meta.url));assert.equal(bytes.length,spec.levels[0].bytes);assert.equal(sha(bytes),spec.levels[0].sha256);}
  for(const part of classic.parts){assert.equal(part.spec.image,'pf');assert.equal(String(part.image.id),'27');assert.equal(selected.textures[part.image.id].levels[0].sourceSHA256,textures.variants.find(v=>v.id==='27')[quality].sha256);}
 }
});
