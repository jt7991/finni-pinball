import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createNativeVorbisCodec} from '../native-vorbis.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-vorbis-native.json',import.meta.url))),wasm=fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url)),metadata=JSON.parse(fs.readFileSync(new URL('../public/native-audio/vorbis.json',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
const source=clip=>{const bytes=fs.readFileSync(new URL('../public/native-audio/music/'+clip.file,import.meta.url));assert.equal(sha(bytes),clip.sourceSHA256);return bytes;};
test('standalone codec exposes only the pinned native audio ABI and heap growth import',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceTableSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.clips.length,7);
 const music=Object.values(JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url)))).filter(e=>e.music);assert.equal(music.length,24);assert.deepEqual([...new Set(music.map(e=>e.sourceSHA256))].sort(),fixture.clips.map(c=>c.sourceSHA256).sort(),'Every authored music source has a native PCM expectation');
 for(const entry of music){const clip=fixture.clips.find(c=>c.sourceSHA256===entry.sourceSHA256);assert.deepEqual(entry.nativeSource,{file:'native-audio/music/'+clip.file,channels:clip.channels,sampleRate:clip.sampleRate,granuleFrames:clip.sourceGranuleFrames,nativeFrames:clip.frames});}
 assert.equal(sha(wasm),metadata.sha256);assert.equal(wasm.length,metadata.bytes);assert.equal(metadata.engineSHA256,fixture.engineSHA256);assert.equal(metadata.retainedFunctions,93);assert.equal(metadata.toolchain.binaryen,'132.0.0');assert.equal(metadata.bodyProof.length,92);
 const module=new WebAssembly.Module(wasm);assert.deepEqual(WebAssembly.Module.imports(module),[{module:'env',name:'emscripten_resize_heap',kind:'function'}]);assert.deepEqual(WebAssembly.Module.exports(module).map(e=>e.name).sort(),['memory','open','read','seek','format','cursor','length','close','malloc','free'].sort());
});
test('all original music streams and rewinds retain every compiled-native PCM bit under varying read chunks',async()=>{
 const codec=await createNativeVorbisCodec(wasm);try{
  for(const clip of fixture.clips){
   assert.deepEqual(codec.open(source(clip)),{channels:clip.channels,sampleRate:clip.sampleRate,granuleFrames:clip.sourceGranuleFrames});
   for(let pass=0;pass<2;pass++){
    if(pass)codec.seek(0);const hash=createHash('sha256');let frames=0,index=0;
    for(;;){const block=codec.read([127,8192,4096,511][index++%4]);assert.equal(block.pcm.length,block.frames*clip.channels);hash.update(new Uint8Array(block.pcm.buffer));frames+=block.frames;if(block.eof)break;assert.ok(frames<=clip.sourceGranuleFrames+8192);}
    assert.equal(frames,clip.frames,clip.name+' complete original EOF');assert.equal(hash.digest('hex'),clip.pcmSHA256,clip.name+' pass '+pass);
   }
   codec.close();assert.equal(codec.opened,false);assert.ok(codec.memoryBytes<=64*1024*1024);
  }
 }finally{codec.close();}
});
test('rapid source replacements and invalid bytes release decoder ownership and remain reusable',async()=>{
 const codec=await createNativeVorbisCodec(wasm);try{
  assert.throws(()=>codec.open(new Uint8Array([1,2,3])),/rejected/);assert.equal(codec.opened,false);
  for(let i=0;i<42;i++){const clip=fixture.clips[i%fixture.clips.length];codec.open(source(clip));assert.equal(codec.read(64).frames,64);codec.close();codec.close();assert.ok(codec.memoryBytes<=64*1024*1024);}
  assert.throws(()=>codec.read(1),/No native/);assert.throws(()=>codec.open(new Uint8Array()),/required/);codec.open(source(fixture.clips[0]));assert.throws(()=>codec.read(0),/read size/);assert.throws(()=>codec.read(65537),/read size/);assert.throws(()=>codec.seek(-1),/seek/);assert.equal(codec.read(64).frames,64);
 }finally{codec.close();}
});
