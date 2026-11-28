import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';
import {decodePCM16Wave} from '../audio-pcm.js';import {createNativePCMVoice} from '../native-pcm-voice.js';import {nativeSoundMix} from '../native-sound-mix.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url))),packed=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),formats=read('vpx-main-pcm-decoders-native.json'),fixture=packed('vpx-main-pcm-voices-native.json.gz'),live=packed('vpx-main-pcm-live-pitch-native.json.gz'),manifest=nativeSourceAssets('a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3').json('audio.json'),sha=b=>createHash('sha256').update(b).digest('hex');
const context={createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>data[c]};}};
function source(name){const sound=manifest[name],wav=fs.readFileSync(new URL('../public/audio/'+sound.fallbackFile,import.meta.url));assert.equal(sha(wav),sound.sourceSHA256);return decodePCM16Wave(context,wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength));}
const nonzero=b=>b.pcm.some(c=>c.some(x=>x!==0)),options=c=>({volume:c.volume,pan:c.pan??0,loop:c.loopCount??-1,pitch:c.pitch??0});
function mixed(block,channels,gain,clip=true){const result=[new Float32Array(2048),new Float32Array(2048)];for(let c=0;c<2;c++)for(let i=0;i<2048;i++){const x=Math.fround(block.pcm[i*channels+(channels===1?0:c)]*(c?gain.right:gain.left));result[c][i]=clip?Math.max(-1,Math.min(1,x)):x;}return result;}
function firstSample(blocks){for(let b=0;b<blocks.length;b++)for(let i=0;i<2048;i++)if(blocks[b][0][i]!==0||blocks[b][1][i]!==0)return b*2048+i;throw Error('No original source signal');}
function compare(actual,expected,label){for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(actual[c][i],expected[c][i],label+' channel '+c+' frame '+i);}

test('five original PCM16 decoder outputs retain exact samples through native mono/stereo target mapping',()=>{
 assert.equal(formats.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(formats.rows.length,5);
 for(const c of formats.rows){const buffer=source(c.name),bytes=Buffer.alloc(c.frames*c.channels*4);assert.equal(c.chosen.format,2);assert.equal(c.unchangedPhysicsRNG,true);assert.equal(buffer.length,c.frames);assert.equal(buffer.sampleRate,c.sampleRate);
  for(let i=0;i<c.frames;i++)for(let k=0;k<c.channels;k++)bytes.writeFloatLE(buffer.getChannelData(Math.min(k,buffer.numberOfChannels-1))[i],(i*c.channels+k)*4);
  assert.equal(sha(bytes),c.pcmSHA256,c.name+' original native decoder output');
 }
});

test('original device callbacks match fixed loops, single/finite repeats, pitch, pan and hard clipping sample for sample',()=>{
 let samples=0,unclippedDifference=0;
 for(const c of fixture.observations){
  assert.equal(c.engineSHA256,formats.engineSHA256);for(const b of c.before)assert.equal(nonzero(b),false);
  const sound=manifest[c.name],voice=createNativePCMVoice(source(c.name),sound,48000,options(c)),gain=nativeSoundMix(sound,options(c)),blocks=[],raw=[];
  for(let n=0;n<c.frames.length+8;n++){const b=voice.read();blocks.push(mixed(b,voice.channels,gain));raw.push(mixed(b,voice.channels,gain,false));}
  const delay=(firstSample(c.frames.map(b=>b.pcm))-firstSample(blocks))/2048;assert.ok(Number.isInteger(delay)&&delay>=0&&delay<=8,'Explicit source-start alignment must be whole native device blocks');
  for(let n=0;n<c.frames.length;n++){
   const expected=c.frames[n].pcm,actual=n<delay?[new Float32Array(2048),new Float32Array(2048)]:blocks[n-delay];compare(actual,expected,c.name+' block '+n);samples+=4096;
   if(c.name==='vo_juggernaut'&&n>=delay)for(let channel=0;channel<2;channel++)for(let i=0;i<2048;i++)if(raw[n-delay][channel][i]!==expected[channel][i])unclippedDifference++;
  }
 }
 assert.equal(samples,4*32*4096);assert.equal(unclippedDifference,96,'The original full-volume voice clips exactly these 96 samples; an unclipped negative control fails');
});

test('looped PCM16 flipper stops preserve the native partial source cache and converter state',()=>{
 const c=fixture.observations.find(c=>c.name==='fx_flipperup'),sound=manifest[c.name],data=source(c.name),settings=options(c),gain=nativeSoundMix(sound,settings),initial=c.restart.initial.filter(nonzero),restarted=c.restart.restarted.filter(nonzero);let voice=createNativePCMVoice(data,sound,48000,settings),last;
 for(const b of c.restart.stopped)assert.equal(nonzero(b),false);
 for(let n=0;n<initial.length;n++){last=voice.read();const output=mixed(last,voice.channels,gain);assert.ok(output.some(channel=>channel.some(x=>x!==0)),'This fixture has source signal in every active loop block');compare(output,initial[n].pcm,'Initial loop '+n);}
 const state=last.state;for(let i=0;i<8;i++)voice.read();voice=createNativePCMVoice(data,sound,48000,settings,state);
 for(let n=0;n<restarted.length;n++)compare(mixed(voice.read(),voice.channels,gain),restarted[n].pcm,'Retained PCM restart '+n);
});

test('live public pitch updates retain every original output sample and read-only native converter field',()=>{
 assert.equal(live.engineSHA256,formats.engineSHA256);assert.deepEqual(live.errors,[]);assert.equal(live.devicePipelineLeadFrames,2048);for(const b of live.before)assert.equal(nonzero(b),false);
 const sound=manifest[live.name],settings=options(live),voice=createNativePCMVoice(source(live.name),sound,48000,settings),gain=nativeSoundMix(sound,settings),delay=live.frames.findIndex(nonzero);assert.ok(delay>=0&&delay<=8);
 let currentRate='147/320',applied=0,phaseChecks=0;
 for(let n=delay;n<live.frames.length;n++){
  const observed=live.frames[n-1]?.phase,rate=observed&&observed.inputRate+'/'+observed.outputRate;
  if(rate&&rate!==currentRate){const update=live.updates[applied++];assert.ok(n>=update.issuedAfterFrame,'A pitch update cannot precede its public request');settings.pitch=update.pitch;voice.update(settings);currentRate=rate;}
  const actual=voice.read();compare(mixed(actual,voice.channels,gain),live.frames[n].pcm,'Live pitch block '+n);
  if(observed)for(const key of ['inputRate','outputRate','timeInt','timeFrac','previous','next']){assert.deepEqual(actual.state.converter[key],observed[key],'Native backend field '+key+' one prepared block ahead');phaseChecks++;}
 }
 assert.equal(applied,3);assert.equal(currentRate,'71/200');assert.ok(phaseChecks>250);
});
