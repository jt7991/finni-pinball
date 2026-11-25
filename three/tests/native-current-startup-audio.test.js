import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';
import {createAudio} from '../media.js';import {connectSimulation} from '../game-runtime.js';import {createSimulationHost} from '../simulation-host.js';import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import {mainPlayerSettings,mainBallSettings,mainSceneSettings,mainScriptBudget} from '../player-settings.js';
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(new URL('fixtures/vpx-main-6f8116d-cold-audio-native.json.gz',import.meta.url));
assert.equal(sha(bytes),'dc4d73c8a2a026795d9659d76791d001f759b629e177186e35b13160cac14d5d');const fixture=JSON.parse(gunzipSync(bytes));
test('the real simulation bridge retains all initialization plays and the browser-music handoff before the first native device sample',async()=>{
 assert.equal(fixture.sourceSHA256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(fixture.frames.length,96);assert.equal(fixture.captures.length,2);
 for(const capture of fixture.captures){assert.equal(Buffer.byteLength(capture.json),capture.bytes);assert.equal(sha(Buffer.from(capture.json)),capture.sha256);const original=JSON.parse(capture.json);for(let n=0;n<96;n++){assert.equal(original.frames[n].native.ms,0);assert.deepEqual(original.frames[n].pcm,fixture.frames[n].pcm);}}
 const assets=nativeSourceAssets(fixture.sourceSHA256),root=new URL('../public/',import.meta.url),originals={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch},outputs=[],logs=[],initializations=[],warnings=[],requests=[];let context,game;
 globalThis.AudioContext=class{constructor(){context=this;}sampleRate=48000;currentTime=0;state='suspended';destination={};resume(){this.state='running';return Promise.resolve();}createScriptProcessor(){const node={connect(){},disconnect(){}};outputs.push(node);return node;}};
 globalThis.fetch=async url=>{const name=new URL(String(url),'http://test/').pathname.slice('/three/'.length);requests.push(name);const bytes=fs.readFileSync(new URL(name,root));return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 const audio=createAudio(assets.json('audio.json'),'http://test/three/',{deferInitialization:true,sourceBank:true,prepareAllMusic:false,onError:error=>warnings.push(error.message)});
 const worker={postMessage:message=>queueMicrotask(()=>void host.receive(message)),terminate(){}};
 const host=createSimulationHost(message=>queueMicrotask(()=>worker.onmessage?.({data:message})));
 try{
  game=await connectSimulation(worker,{assets:{layout:assets.json('layout.json'),specs:assets.json('objects.json'),source:assets.text('rules.vbs')},playerSettings:mainPlayerSettings,ballSettings:mainBallSettings,sceneSettings:mainSceneSettings,scriptBudget:mainScriptBudget},()=>{},{...audio,initialize:events=>{initializations.push(structuredClone(events));return audio.initialize(events);},log:text=>logs.push(text)});
  await audio.whenInitialized();await audio.prepareSources();assert.equal(outputs.length,0);assert.equal(context.state,'suspended');assert.ok(logs.includes('FINNI_MUSIC_READY'));
  await audio.unlock();await game.prepareStart(1,{browserMusic:true});assert.equal(outputs.length,0);assert.equal(game.time,0);assert.ok(logs.some(line=>line.startsWith('FINNI_MUSIC|mu_hellhouse1|')),JSON.stringify(logs));
  const originalPlays=initializations[0].filter(event=>event.type==='play');assert.deepEqual(originalPlays.map(event=>event.name.toLowerCase()),['fx_gioff']);assert.deepEqual(initializations.at(-1).slice(0,initializations[0].length),initializations[0],'The Start transaction retains the complete native initialization');assert.deepEqual(initializations.at(-1).filter(event=>event.type==='play').map(event=>event.name.toLowerCase()),['fx_gioff','fx_gion']);
  await audio.start();await game.flush();assert.equal(outputs.length,1);assert.equal(game.time,0);
  for(let n=0;n<96;n++){const channels=[new Float32Array(2048),new Float32Array(2048)];outputs[0].onaudioprocess({outputBuffer:{getChannelData:channel=>channels[channel]}});for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(channels[c][i],fixture.frames[n].pcm[c][i],'Current native startup block '+n+' channel '+c+' sample '+i);context.currentTime+=2048/48000;}
  assert.deepEqual(warnings,[]);
  assert.equal(requests.some(name=>name==='native-audio/vorbis.wasm'||name.startsWith('native-audio/music/')),false,'The HTML-music path needs no unused native music decoder or source');
 }finally{await game?.dispose();audio.dispose();await new Promise(resolve=>setImmediate(resolve));Object.assign(globalThis,originals);}
});
