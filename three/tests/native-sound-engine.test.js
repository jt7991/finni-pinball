import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import test from 'node:test';import assert from 'node:assert/strict';
import {decodePCM16Wave} from '../audio-pcm.js';import {createNativePCMVoice} from '../native-pcm-voice.js';import {createNativeSoundEngine} from '../native-sound-engine.js';import {nativeSoundMix} from '../native-sound-mix.js';
const packed=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),fixture=packed('vpx-main-pcm-mixes-native.json.gz'),voices=packed('vpx-main-pcm-voices-native.json.gz'),complete=packed('vpx-main-pcm-complete-loop-native.json.gz'),manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url))),buffers=new Map(),context={createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>data[c]};}};
function source(name){if(!buffers.has(name)){const bytes=fs.readFileSync(new URL('../public/audio/'+manifest[name].fallbackFile,import.meta.url));buffers.set(name,decodePCM16Wave(context,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));}return buffers.get(name);}
const engine=()=>createNativeSoundEngine({sampleRate:48000,createVoice:(name,sound,settings,state)=>createNativePCMVoice(source(name),sound,48000,settings,state)}),options=c=>({...c,loop:c.loopCount??-1}),nonzero=b=>b.pcm.some(c=>c.some(x=>x!==0)),compare=(block,expected,label)=>{for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(block.pcm[i*2+c],expected.pcm[c][i],label+' channel '+c+' frame '+i);};

test('native groups, reverse attachment summation and SDL stream clipping retain every compiled mix sample',()=>{
 assert.equal(fixture.observations.length,4);let checked=0;
 for(const c of fixture.observations){assert.equal(c.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');const e=engine();
  compare(e.render(),c.frames[0],'One prepared silent device block');
  for(const layer of c.layers){assert.equal(manifest[layer.name].sourceSHA256,layer.sourceSHA256);e.play(layer.name,manifest[layer.name],options(layer));}
  for(let n=1;n<c.frames.length;n++){compare(e.render(),c.frames[n],c.mixCase+' '+n);checked+=4096;}
  assert.equal(e.stats.players,c.layers.length);assert.equal(e.stats.active,c.layers.length);
 }
 assert.equal(checked,4*31*4096);
});

test('saturated playfield is clipped before backglass, whose cancellation must precede final clipping',()=>{
 const c=fixture.observations.find(c=>c.mixCase==='cross-rolling'),streams=c.layers.map(layer=>({voice:createNativePCMVoice(source(layer.name),manifest[layer.name],48000,options(layer)),gain:nativeSoundMix(manifest[layer.name],layer)}));let finalOnly=0,clippedBackglass=0,pfClips=0;
 for(let n=1;n<c.frames.length;n++){
  const blocks=streams.map(s=>s.voice.read());for(let channel=0;channel<2;channel++)for(let i=0;i<2048;i++){
   let pf=0;for(const id of [3,2,1])pf=Math.fround(pf+Math.fround(blocks[id].pcm[i]*streams[id].gain[channel?'right':'left']));
   const bg=Math.fround(blocks[0].pcm[i*2+channel]*streams[0].gain[channel?'right':'left']),clip=x=>Math.max(-1,Math.min(1,x)),expected=c.frames[n].pcm[channel][i];if(Math.abs(pf)>1)pfClips++;
   if(clip(Math.fround(pf+bg))!==expected)finalOnly++;
   if(clip(Math.fround(clip(pf)+clip(bg)))!==expected)clippedBackglass++;
  }
 }
 assert.equal(pfClips,170);assert.equal(finalOnly,64,'A final-clamp-only negative control fails 64 original samples');assert.equal(clippedBackglass,40,'Clipping backglass before the final sum fails 40 original samples');
});

test('idle reuse retains native PCM tails; useExisting, restart, overlap and mute preserve player ownership',()=>{
 const c=voices.observations.find(c=>c.name==='fx_collide'&&c.loopCount===0),sound=manifest[c.name],e=engine();e.render();const id=e.play(c.name,sound,options(c));
 for(let n=1;n<c.frames.length;n++)compare(e.render(),c.frames[n],'Single-shot native '+n);
 assert.equal(e.stats.active,0);e.stop(c.name);assert.equal(e.play(c.name,sound,options(c)),id,'First idle player is reused');
 const native=c.restart.restarted,start=native.findIndex(nonzero);assert.ok(start>=0&&start<=8);for(let n=start;n<native.length;n++)compare(e.render(),native[n],'Retained single-shot restart '+n);
 const settings={loop:-1,volume:.04};const a=e.play('fx_flipperup',manifest.fx_flipperup,settings);e.render();assert.equal(e.play('fx_flipperup',manifest.fx_flipperup,{...settings,useExisting:true,pitch:10000}),a);const b=e.play('fx_flipperup',manifest.fx_flipperup,settings);assert.notEqual(a,b);assert.equal(e.play('fx_flipperup',manifest.fx_flipperup,{...settings,restart:true}),a);assert.equal(e.stats.active,1,'Restart stops all same-name overlaps');
 const count=e.stats.players;e.setMuted(true);for(let n=0;n<4;n++)assert.ok(e.render().pcm.every(x=>x===0));assert.equal(e.stats.players,count);assert.equal(e.stats.active,1,'Muting consumes ongoing sound without stopping it');e.setMuted(false);assert.ok(e.render().pcm.some(x=>x!==0));e.stop();assert.equal(e.stats.active,0);
});

test('complete PCM loops retain the native extra end-callback block at an exact device boundary',()=>{
 assert.ok(complete.disabledElementTimers.includes('swPlungerRest'),'Five-second authored skillshot reminder is explicitly disabled for isolation');const e=engine();compare(e.render(),complete.frames[0],'Initial device silence');e.play(complete.name,manifest[complete.name],options(complete));
 for(let n=1;n<complete.frames.length;n++)compare(e.render(),complete.frames[n],'Complete source loop '+n);
 assert.equal(e.stats.active,1);assert.equal(e.stats.players,1);
});

test('multiple pending pitch values collapse at the native device boundary without a transient phase conversion',()=>{
 const c=voices.observations.find(c=>c.name==='fx_flipperup'),e=engine(),sound=manifest[c.name],settings={loop:-1,volume:.04,useExisting:true};
 e.play(c.name,sound,{...settings,pitch:11025});e.play(c.name,sound,{...settings,pitch:0});compare(e.render(),c.frames[1],'Only the latest queued pitch reaches the first device block');assert.equal(e.stats.players,1);
});
