import fs from 'node:fs';import assert from 'node:assert/strict';import test from 'node:test';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {createFullGame} from '../full-game.js';import {createAudio} from '../media.js';
const root=new URL('../public/',import.meta.url),load=name=>JSON.parse(fs.readFileSync(new URL(name,root))),manifest=load('audio.json'),packed=fs.readFileSync(new URL('fixtures/vpx-main-cold-start-audio-native.json.gz',import.meta.url));
assert.equal(createHash('sha256').update(packed).digest('hex'),'83f6d938736d1460ae3e880256fbc8a57bf4bedbb9e31ec8a8d781da84a95418');const fixture=JSON.parse(gunzipSync(packed));

async function renderStartup(includeInitialization,sourceBank=false){
 const originals={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch},outputs=[],initial=[],playing=[],errors=[];let context,live=false;
 globalThis.AudioContext=class{
  constructor(){context=this;}sampleRate=48000;currentTime=0;state='suspended';destination={};resume(){this.state='running';return Promise.resolve();}
  createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>channels[c]};}
  createScriptProcessor(...args){const node={args,connect(){},disconnect(){}};outputs.push(node);return node;}
 };
 globalThis.fetch=async url=>{const file=new URL(new URL(String(url),'http://test/').pathname.slice('/three/'.length),root),bytes=fs.readFileSync(file);return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 const audio=createAudio(manifest,'http://test/three/',{deferInitialization:true,sourceBank,onError:e=>errors.push(e.message)}),game=await createFullGame(load('layout.json'),load('objects.json'),fs.readFileSync(new URL('rules.vbs',root),'utf8'),()=>{},{play:(name,settings)=>live?playing.push(audio.play(name,settings)):initial.push({type:'play',name,settings}),stop:name=>live?audio.stop(name):initial.push({type:'stop',name})});
 try{
  assert.equal(game.rules.value('Song'),'mu_hellhouse1');assert.equal(game.rules.value('VarType(SongVolume)'),4);assert.equal(game.rules.value('SongVolume'),Math.fround(.2));assert.equal(game.rules.value('VarType(TableWidth)'),4);assert.equal(game.rules.value('VarType(li036.X)'),4);assert.equal(game.rules.value('Pan(li036)'),-1.549814724435988e-28);
  const title=initial.find(e=>e.type==='play'&&manifest[e.name.toLowerCase()].music);assert.equal(title.settings.volume,0,'An explicit Empty volume is coerced to zero before options are initialized');
  if(includeInitialization)audio.initialize(initial);if(sourceBank)await audio.prepareSources();await audio.whenInitialized();await audio.prepare(['fx_gion']);assert.equal(outputs.length,0);assert.equal(context.state,'suspended');
  live=true;await audio.start();game.start();await Promise.all(playing);await new Promise(resolve=>setImmediate(resolve));assert.equal(outputs.length,1);assert.deepEqual(game.random.getState(),fixture.frames[0].native.random,'Native RNG is an assertion, never a startup input');
  let differences=0;const captures=[];
  for(const frame of fixture.frames){const channels=[new Float32Array(2048),new Float32Array(2048)];outputs[0].onaudioprocess({outputBuffer:{getChannelData:c=>channels[c]}});for(let c=0;c<2;c++)for(let i=0;i<2048;i++){if(includeInitialization)assert.equal(channels[c][i],frame.pcm[c][i],'Actual device callback '+frame.index+' channel '+c+' sample '+i);else if(channels[c][i]!==frame.pcm[c][i])differences++;}captures.push(channels);context.currentTime+=2048/48000;}
  assert.deepEqual(errors,[]);return{differences,captures};
 }finally{audio.dispose();game.dispose();await new Promise(resolve=>setImmediate(resolve));Object.assign(globalThis,originals);}
}

test('authored native options and deferred initialization reproduce every cold-start device sample',async()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.frames.length,96);assert.equal(fixture.observations.length,2);assert.ok(fixture.observations.every(o=>o.pcmSHA256===fixture.pcmSHA256));for(const frame of fixture.frames)assert.equal(frame.native.ms,0);
 await renderStartup(true);
});

test('discarding the authored initialization audio fails the independent cold-start recording',async()=>{
 const negative=await renderStartup(false);assert.ok(negative.differences>300000,'The former dropped-initialization path cannot reproduce the native startup waveform');
});

test('indexed encoded sources retain every original cold-start device sample without full decoded buffers',async()=>{await renderStartup(true,true);});
