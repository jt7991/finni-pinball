import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import test from'node:test';import assert from'node:assert/strict';
import{indexAuthoredFLAC,decodeAuthoredFLAC,createAuthoredFLACSource,createFLACFrameCache}from'../flac-source.js';import{decodePCM16Wave}from'../audio-pcm.js';import{createNativePCMVoice}from'../native-pcm-voice.js';import{createNativeSoundEngine}from'../native-sound-engine.js';
import{nativeSourceAssets}from'../../scripts/native-source-assets.mjs';
const root=new URL('../public/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('audio.json',root))),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),read=file=>fs.readFileSync(new URL(file,root)),indices=new Map();
const context={createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>data[c]};}};
function indexed(name,cache,catalogue=manifest){const entry=catalogue[name],bytes=read('audio/'+entry.file);if(!indices.has(entry.file))indices.set(entry.file,indexAuthoredFLAC(bytes,entry));return createAuthoredFLACSource(bytes,entry,indices.get(entry.file),cache);}

for(const version of [{name:'99eff88',catalogue:nativeSourceAssets('3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14').json('audio.json'),samples:37184512},{name:'6f8116d',catalogue:manifest,samples:37144576}])test('every '+version.name+' lossless source decodes and seeks to exact native-scaled PCM within a shared frame budget',()=>{
 const unique=new Map(),cache=createFLACFrameCache(262144);for(const[name,entry]of Object.entries(version.catalogue))if(!entry.music&&!unique.has(entry.file))unique.set(entry.file,{name,entry});let samples=0;
 for(const{name,entry}of unique.values()){
  const encoded=read('audio/'+entry.file),raw=read('audio/'+entry.fallbackFile);assert.equal(sha(encoded),entry.encodedSHA256);assert.equal(sha(raw),entry.sourceSHA256);
  const source=indexed(name,cache,version.catalogue),expected=decodePCM16Wave(context,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),actualHash=createHash('sha256'),expectedHash=createHash('sha256');
  const compare=(at,count)=>{const actual=source.readInterleaved(at,count,entry.channels),want=new Float32Array(count*entry.channels);for(let c=0;c<entry.channels;c++)for(let i=0;i<count;i++)want[i*entry.channels+c]=expected.getChannelData(c)[at+i];assert.equal(sha(actual),sha(want),name+' source range '+at+'+'+count);return{actual,want};};
  for(let at=0;at<entry.frames;at+=4096){const count=Math.min(4096,entry.frames-at),range=compare(at,count);actualHash.update(range.actual);expectedHash.update(range.want);samples+=count*entry.channels;assert.ok(cache.stats.retainedBytes<=cache.stats.limit);}
  assert.equal(actualHash.digest('hex'),expectedHash.digest('hex'));for(const at of [0,Math.floor(entry.frames/2),Math.max(0,entry.frames-127)])compare(at,Math.min(127,entry.frames-at));
 }
 assert.equal(unique.size,322);assert.equal(samples,version.samples);cache.clear();assert.equal(cache.stats.retainedBytes,0);
});

test('indexed lossless pulls retain every original device sample for native mixed and overlapping voices',()=>{
 const packed=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),mixes=packed('vpx-main-pcm-mixes-native.json.gz').observations,overlap=packed('vpx-main-audio-interleaved-native.json.gz');
 for(const capture of [...mixes,overlap]){
  const cache=createFLACFrameCache(262144),sources=new Map(),engine=createNativeSoundEngine({sampleRate:48000,createVoice:(name,sound,settings,state)=>{if(!sources.has(name))sources.set(name,indexed(name,cache));return createNativePCMVoice(sources.get(name),sound,48000,settings,state);}});
  for(const layer of capture.layers)engine.play(layer.name,manifest[layer.name],{...layer,loop:layer.loopCount});
  for(let n=1;n<capture.frames.length;n++){const actual=engine.render().pcm,expected=capture.frames[n].pcm;for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(actual[i*2+c],expected[c][i],capture.mixCase+' native block '+n+' channel '+c+' sample '+i);}
  assert.equal(engine.stats.players,capture.layers.length);assert.ok(cache.stats.retainedBytes<=cache.stats.limit);
 }
});

test('malformed data, changed frames and unbounded or inconsistent ranges are rejected',()=>{
 const entry=manifest.fx_flipperup,encoded=read('audio/'+entry.file),index=indices.get(entry.file)??indexAuthoredFLAC(encoded,entry),cache=createFLACFrameCache(262144);
 assert.throws(()=>decodeAuthoredFLAC(encoded.subarray(0,12),entry),/Authored FLAC/);assert.throws(()=>decodeAuthoredFLAC(encoded,{...entry,frames:2**31}),/allocation/);
 assert.throws(()=>createAuthoredFLACSource(encoded,entry,index.map((row,i)=>i===0?{...row,next:row.next+1}:row),cache),/index/);
 const damaged=Buffer.from(encoded);damaged[index[0].next-1]^=1;const source=createAuthoredFLACSource(damaged,entry,index,cache);assert.throws(()=>source.readInterleaved(0,1,1),/checksum/);
 const valid=createAuthoredFLACSource(encoded,entry,index,cache);for(const[at,count]of [[-1,1],[0,65537],[entry.frames,1],[0,-1]])assert.throws(()=>valid.readInterleaved(at,count,1),/range/);
});
