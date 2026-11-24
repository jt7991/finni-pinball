import test from'node:test';import assert from'node:assert/strict';import{createAudioBufferCache}from'../audio-buffer-cache.js';
const data=bytes=>({length:bytes/4,numberOfChannels:1});
test('failed shared audio loads retry while concurrent and completed requests keep one decoded buffer',async()=>{
 let count=0,finish;const first=new Promise((resolve,reject)=>{finish={resolve,reject};}),decoded=data(8),cache=createAudioBufferCache(()=>++count===1?first:Promise.resolve(decoded));
 const a=cache.get('flipper'),b=cache.get('flipper');assert.equal(a,b);assert.equal(count,1);finish.reject(Error('HTTP 503'));
 await Promise.all([assert.rejects(a,/503/),assert.rejects(b,/503/)]);const retry=cache.get('flipper');assert.notEqual(retry,a);assert.equal(await retry,decoded);assert.equal(await cache.get('flipper'),decoded);assert.equal(count,2);
});
test('audio cache retains recently used clips and evicts older decoded data within the original byte budget',async()=>{
 const calls=new Map(),cache=createAudioBufferCache(async name=>{calls.set(name,(calls.get(name)??0)+1);return data(8);},24);
 const hot=await cache.get('hot');await cache.get('a');await cache.get('b');assert.equal(await cache.get('hot'),hot);await cache.get('c');assert.equal(await cache.get('hot'),hot);assert.equal(calls.get('hot'),1);await cache.get('a');assert.equal(calls.get('a'),2,'Least recently used decoded clip is evicted');
});
test('live-player reuse refreshes retention without requesting or decoding its already active sound',async()=>{
 const calls=new Map(),cache=createAudioBufferCache(async name=>{calls.set(name,(calls.get(name)??0)+1);return data(8);},16);
 const hot=await cache.get('loop');for(let i=0;i<10;i++){cache.touch('loop');await cache.get('voice'+i);}assert.equal(await cache.get('loop'),hot);assert.equal(calls.get('loop'),1);await cache.get('voice0');assert.equal(calls.get('voice0'),2);
});
test('pending audio loads survive unrelated eviction and failed synchronous decoders can be retried',async()=>{
 let finish,calls=0;const pending=new Promise(r=>{finish=r;}),cache=createAudioBufferCache(name=>{if(name==='pending')return pending;if(name==='bad'&&++calls===1)throw Error('decoder failed');return Promise.resolve(data(8));},8);
 const a=cache.get('pending');await cache.get('other');assert.equal(cache.get('pending'),a);finish(data(8));await a;await assert.rejects(cache.get('bad'),/decoder failed/);assert.equal((await cache.get('bad')).length,2);assert.equal(calls,2);
});
