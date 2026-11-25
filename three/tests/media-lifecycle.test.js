import test from 'node:test';import assert from 'node:assert/strict';import {withAudio} from './helpers/audio-public-host.js';

for(const action of ['named stop','stop all'])test('a pending decoded sound cannot survive '+action,()=>withAudio(async({audio,nodes,tick,stats,decoded,decoding,buffer})=>{
 const pending=audio.play('effect');await decoding.promise;if(action==='named stop')audio.stop('EFFECT');else audio.stop();decoded.resolve(buffer());await pending;assert.equal(nodes.length,0,'A request stopped while decoding must not connect an output');
 await audio.play('effect');await tick(2);assert.equal((await stats()).active,1,'A later request remains playable');
},{deferred:true}));

test('muting keeps native voice clocks running through loading and resumes the current position',()=>withAudio(async({audio,tick,stats,decoded,decoding,buffer})=>{
 const pending=audio.play('effect',{loop:-1});await decoding.promise;audio.setMuted(true);decoded.resolve(buffer());await pending;for(let n=0;n<4;n++)assert.ok((await tick()).every(c=>c.every(x=>x===0)));assert.equal((await stats()).active,1);
 audio.setMuted(false);await tick(2);assert.ok((await tick()).some(c=>c.some(x=>x!==0)));assert.equal((await stats()).players,1);
},{deferred:true}));
