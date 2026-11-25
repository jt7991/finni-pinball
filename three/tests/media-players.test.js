import test from 'node:test';import assert from 'node:assert/strict';import {withAudio} from './helpers/audio-public-host.js';

test('a repeated ball-drop request updates the first native player without a new attack',()=>withAudio(async({audio,tick,stats,responses})=>{
 await audio.play('effect',{loop:-1,useExisting:true});await tick(2);await audio.play('effect',{loop:-1,useExisting:true,pitch:11025});await tick(2);
 assert.equal((await stats()).players,1);const plays=responses.flatMap(r=>r.applied??[]).filter(c=>c.type==='play');assert.equal(plays.length,2);assert.equal(plays[0].playerID,plays[1].playerID);
 audio.stop('effect');await tick(2);await audio.play('effect',{useExisting:true});await tick(2);assert.equal((await stats()).players,1,'An idle named player is reused with its native retained cache');
}));

test('same-sound updates coalesce while their first decode is pending',()=>withAudio(async({audio,tick,stats,decoded,decoding,buffer,requests})=>{
 const first=audio.play('effect',{useExisting:true});await decoding.promise;const second=audio.play('effect',{useExisting:true,pitch:11025});decoded.resolve(buffer());await Promise.all([first,second]);await tick(2);
 assert.equal((await stats()).players,1);assert.equal(requests.filter(r=>r.type==='play-effect').at(-1).settings.pitch,11025);
},{deferred:true}));

test('independent effects overlap and restart stops all prior voices before reusing the first player',()=>withAudio(async({audio,tick,stats,responses})=>{
 await audio.play('effect',{loop:-1});await audio.play('effect',{loop:-1});await tick(2);assert.equal((await stats()).players,2);assert.equal((await stats()).active,2);
 await audio.play('effect',{restart:true,loop:-1});await tick(2);assert.equal((await stats()).players,2);assert.equal((await stats()).active,1);const plays=responses.flatMap(r=>r.applied??[]).filter(c=>c.type==='play');assert.equal(plays.at(-1).playerID,plays[0].playerID);
}));

test('independent infinite loops overlap when useExisting is false',()=>withAudio(async({audio,tick,stats})=>{
 await audio.play('effect',{loop:-1});await audio.play('effect',{loop:-1});await tick(30);assert.equal((await stats()).active,2);
}));

test('restart during decoding cancels every older pending voice',()=>withAudio(async({audio,tick,stats,decoded,decoding,buffer})=>{
 const first=audio.play('effect'),second=audio.play('effect');await decoding.promise;const replacement=audio.play('effect',{restart:true,pitch:11025});decoded.resolve(buffer());await Promise.all([first,second,replacement]);await tick(2);assert.equal((await stats()).players,1);
},{deferred:true}));

test('a failed shared decode is handled for every pending request',()=>withAudio(async({audio,nodes,decoded,decoding,errors})=>{
 const first=audio.play('effect',{useExisting:true});await decoding.promise;const second=audio.play('effect',{useExisting:true});decoded.reject(Error('Decoder failed'));const results=await Promise.allSettled([first,second]);assert.ok(results.every(r=>r.status==='fulfilled'));assert.equal(nodes.length,0);assert.ok(errors.every(e=>e==='Decoder failed'));
},{deferred:true}));

for(const [loop,count]of [[0,1],[1,1],[3,3]])test('native loop count '+loop+' completes '+count+' iterations in one retained player',()=>withAudio(async({audio,tick,stats,ended})=>{
 await audio.play('effect',{loop});await tick(40);assert.equal((await stats()).players,1);assert.equal((await stats()).active,0);assert.deepEqual(ended,[{id:1,name:'effect',loops:count-1}]);
}));

test('stopping a finite repeat prevents its end callback from resurrecting playback',()=>withAudio(async({audio,tick,stats,ended})=>{
 await audio.play('effect',{loop:3});await tick(2);audio.stop('effect');await tick(40);assert.equal((await stats()).active,0);assert.deepEqual(ended,[]);
}));
