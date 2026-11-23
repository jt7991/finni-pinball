import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createSimulationHost} from '../simulation-host.js';
const json=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
// Pinned Player::UpdateGameLogic precedes both PrepareFrame and SubmitFrame.
// This checks elapsed-time ordering, not numerical trajectory equivalence.
test('render requests consume already-due physics before preparation and submission without inventing paused ticks',async()=>{
 let now=0,wall=10000;const messages=[],host=createSimulationHost(message=>messages.push(structuredClone(message)),{now:()=>now,wallNow:()=>wall}),response=id=>messages.find(message=>message.type==='response'&&message.id===id).result,snapshot=()=>messages.filter(message=>message.type==='snapshot').at(-1);
 try{
  await host.receive({type:'init',assets:{layout:json('layout'),specs:json('objects'),source:fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8')}});
  now=50.5;await host.receive({type:'frame',id:1});assert.equal(host.game.time,0,'paused elapsed wall time creates no ticks');
  await host.receive({type:'start'});await host.receive({type:'pause',value:false});await host.receive({type:'execute',statement:'SolLFlipper True'});const resting=host.game.flippers[0].angle;
  now=56;wall=10005;await host.receive({type:'frame',retainSubmission:true,id:2});
  const prepared=response(2),scene=snapshot();assert.equal(scene.stats.ticks,5);assert.equal(host.game.time,.004);assert.notEqual(scene.snapshot.flippers[0],resting,'already-due motion is present in the prepared visual state');assert.equal(scene.presentationClock.lastPhysicsMilliseconds,10005);
  const publications=messages.filter(message=>message.type==='snapshot').length;
  now=61.75;wall=10011;await host.receive({type:'submission',frame:prepared.frame,id:3});
  assert.ok(Math.abs(host.game.time-.010)<1e-12);assert.equal(response(3).presentationClock.lastPhysicsMilliseconds,10011);assert.equal(messages.filter(message=>message.type==='snapshot').length,publications,'later physical catch-up does not replace the retained prepared scene');assert.equal(scene.snapshot.time,.004);
  await host.receive({type:'frame',id:4});assert.equal(snapshot().stats.ticks,11,'unchanged wall time creates no extra tick');
  await host.receive({type:'pause',value:true});now=300;wall=10300;await host.receive({type:'frame',retainSubmission:true,id:5});await host.receive({type:'submission',frame:response(5).frame,id:6});assert.equal(snapshot().stats.ticks,11);assert.equal(response(6).presentationClock.lastPhysicsMilliseconds,10011,'paused submission retains the actual last step clock');
 }finally{await host.receive({type:'dispose'});}
});
