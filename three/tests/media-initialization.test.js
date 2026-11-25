import test from 'node:test';import assert from 'node:assert/strict';import {withAudio} from './helpers/audio-public-host.js';

test('a gesture before initialization can unlock the browser without playing the table before Start',()=>withAudio(async({audio,workers,nodes,tick,stats,responses})=>{
 assert.equal(workers.length,0);assert.equal(nodes.length,0);
 await audio.initialize([{type:'play',name:'effect',settings:{loop:-1}}]);await audio.unlock();await audio.play('effect');assert.equal(nodes.length,0);assert.equal((await stats()).players,0);assert.equal((await stats()).frames,0);
 await audio.start();await tick(2);assert.equal(nodes.length,1);assert.equal((await stats()).active,1);await audio.unlock();await tick(2);assert.equal((await stats()).players,1);assert.equal(responses.flatMap(r=>r.applied??[]).filter(c=>c.type==='play').length,1,'Later gestures do not repeat initialization');
},{deferInitialization:true}));

for(const name of ['effect',undefined])test('a pre-Start '+(name?'named':'global')+' stop cancels queued initialization without canceling future playback',()=>withAudio(async({audio,tick,stats})=>{
 await audio.initialize([{type:'play',name:'effect',settings:{loop:-1}}]);audio.stop(name);await audio.start();await tick(2);assert.equal((await stats()).players,0);assert.equal((await stats()).active,0);
 await audio.play('effect',{loop:-1});await tick(2);assert.equal((await stats()).players,1);assert.equal((await stats()).active,1);
},{deferInitialization:true}));
