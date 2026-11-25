import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../media.js';
import {createNativeAudioLocalTransport} from '../native-audio-local-transport.js';

const root=new URL('../public/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('audio.json',root)));
const musicFiles=[...new Set(Object.values(manifest).filter(entry=>entry.music).map(entry=>entry.nativeSource.file))];
const heldFile=manifest.mu_discoloops.nativeSource.file;
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function setup(run){
 const originals={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout},requests=[],contexts=[],nodes=[],responses=[],errors=[],deadlines=new Set();
 globalThis.setTimeout=(callback,milliseconds,...args)=>{const timer=originals.setTimeout(()=>{deadlines.delete(timer);callback(...args);},milliseconds);if(milliseconds===30000)deadlines.add(timer);return timer;};
 globalThis.clearTimeout=timer=>{deadlines.delete(timer);originals.clearTimeout(timer);};
 let intercept=async()=>{},transport,serial=900000;
 globalThis.AudioContext=class{
  constructor(){contexts.push(this);}sampleRate=48000;currentTime=0;state='suspended';destination={};
  resume(){this.state='running';return Promise.resolve();}
  createScriptProcessor(){const node={connect(){},disconnect(){}};nodes.push(node);return node;}
 };
 globalThis.fetch=async url=>{
  const file=new URL(String(url)).pathname.slice('/three/'.length);requests.push(file);await intercept(file);
  const bytes=fs.readFileSync(new URL(file,root));
  return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 const audio=createAudio(manifest,'http://test/three/',{sourceBank:true,deferInitialization:true,onError:e=>errors.push(e.message),workerFactory:()=>{
  transport=createNativeAudioLocalTransport('http://test/three/');transport.addEventListener('message',({data})=>responses.push(data));return transport;
 }});
 const stats=async()=>{const id=++serial;transport.postMessage({type:'stats',id});return responses.find(data=>data.id===id);};
 try{await run({audio,requests,contexts,nodes,responses,errors,stats,deadlines,intercept:fn=>intercept=fn,wait:async predicate=>{for(let n=0;n<1000;n++){if(predicate())return;await settle();}throw Error('Source readiness did not settle');}});}
 finally{audio.dispose();await settle();Object.assign(globalThis,originals);}
}

test('complete source readiness shares in-flight music with initialization and retains all original compressed sources before output',async()=>{
 await setup(async({audio,requests,contexts,nodes,errors,stats,deadlines,intercept,wait})=>{
  const held=Promise.withResolvers();intercept(file=>file===heldFile?held.promise:undefined);
  let completed=false;const preparation=audio.prepareSources();preparation.then(()=>completed=true);
  assert.equal(audio.prepareSources(),preparation,'Concurrent complete preparation shares its gate');
  const initial=audio.initialize([{type:'play',name:'mu_hellhouse1',settings:{loop:-1,volume:0}},{type:'play',name:'mu_shooterlane',settings:{loop:-1,volume:0}}]);
  await wait(()=>musicFiles.every(file=>requests.includes(file)));
  await settle();assert.equal(deadlines.size,0,'Pending source downloads have no 30-second audio-command deadline');
  assert.equal(completed,false);assert.equal(contexts[0].state,'suspended');assert.equal(nodes.length,0);assert.equal((await stats()).players,0);assert.equal((await stats()).frames,0);
  held.resolve();await preparation;await initial;
  assert.equal((await stats()).musicBytes,23791419);assert.ok((await stats()).musicBytes<24*1024*1024);
  for(const file of musicFiles)assert.equal(requests.filter(request=>request===file).length,1,file+' is loaded once even with concurrent aliases/initialization');
  assert.equal((await stats()).players,0);assert.equal((await stats()).frames,0);assert.equal(nodes.length,0);
  const preparedCount=requests.length;intercept(()=>{throw Error('Declared network unavailable after Ready');});
  await audio.start();
  for(const name of Object.keys(manifest).filter(name=>manifest[name].music)){
   await audio.play(name,{volume:.04,loop:-1});
   const channels=[new Float32Array(2048),new Float32Array(2048)];nodes[0].onaudioprocess({outputBuffer:{getChannelData:c=>channels[c]}});
  }
  assert.equal(requests.length,preparedCount,'Every authored music name remains available without another fetch');assert.deepEqual(errors,[]);assert.equal(nodes.length,1);
 });
});

test('a failed noninitial music source rejects complete readiness and retries without refetching the successful sources',async()=>{
 await setup(async({audio,requests,contexts,nodes,errors,stats,intercept})=>{
  let fail=true;intercept(file=>{if(file===heldFile&&fail){fail=false;throw Error('Declared HTTP 503');}});
  await assert.rejects(audio.prepareSources(),/Table sounds could not be loaded/);
  assert.equal(contexts[0].state,'suspended');assert.equal(nodes.length,0);assert.equal((await stats()).players,0);assert.equal((await stats()).frames,0);
  await audio.prepareSources();assert.equal((await stats()).musicBytes,23791419);
  for(const file of musicFiles)assert.equal(requests.filter(request=>request===file).length,file===heldFile?2:1);
  assert.equal(nodes.length,0);assert.deepEqual(errors,[]);
 });
});
