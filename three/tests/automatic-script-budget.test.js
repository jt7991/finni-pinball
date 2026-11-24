import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import{createSimulationHost}from '../simulation-host.js';
const assets=()=>({layout:JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),specs:JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),source:fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8')});
for(const mode of [2,3])test(`production host mode${mode} applies the automatic script budget without dropping physical steps`,async()=>{
 let microseconds=0,charge=false,host;const messages=[];
 const scriptClock=()=>{if(charge&&host.game?.scriptProfiler.script){microseconds+=6000;charge=false;}return microseconds;};
 host=createSimulationHost(message=>messages.push(structuredClone(message)),{allowDebug:true,scriptClock});
 try{
  await host.receive({type:'init',assets:assets(),scriptBudget:{videoSyncMode:mode}});assert.equal(host.game.scriptStats.elapsedMicroseconds,0);await host.receive({type:'start'});await host.receive({type:'frame'});
  const game=host.game,timer=game.rules.timers.get('leftflipper:timer'),handler=timer.handler,callbacks=[];Object.defineProperty(timer,'handler',{get(){callbacks.push(Math.round(game.time*1000));return handler;}});
  const before={...game.nativeBall(game.physicalRecords[0].body).sync()},rest=game.flippers[0].angle;
  charge=true;await host.receive({type:'input',action:'left',down:true});assert.equal(game.scriptStats.elapsedMicroseconds,6000);assert.equal(game.held.left,true);
  await host.receive({type:'debug',action:'advance',ticks:20,id:1});assert.equal(game.physicsStarted,true);assert.ok(Math.abs(game.time-.019)<1e-12);assert.equal(game.scriptStats.timerDeferrals,mode===2?20:0);assert.equal(callbacks.length,mode===2?0:19);
  assert.notDeepEqual({...game.nativeBall(game.physicalRecords[0].body).sync()},before,'physical balls advance while positive timers are deferred');assert.notEqual(game.flippers[0].angle,rest,'held physical flipper still advances');assert.equal(game.physicsStats.substepBudgetExceeded,0);
  await host.receive({type:'frame',id:2});assert.equal(game.scriptStats.elapsedMicroseconds,0);await host.receive({type:'debug',action:'advance',ticks:1,id:3});assert.equal(callbacks.at(-1),20);assert.equal(callbacks.filter(ms=>ms===20).length,1,'an overdue timer is delivered once');
  const snapshot=messages.filter(message=>message.type==='snapshot').at(-1);assert.equal(snapshot.stats.ticks,21);assert.equal(snapshot.snapshot.scriptStats.videoSyncMode,mode);assert.equal(snapshot.snapshot.scriptStats.budgetMicroseconds,5000);assert.equal(snapshot.snapshot.held.left,true);
 }finally{await host.receive({type:'dispose'});}
});
test('frame preparation resets the budget before charging authored Animate callbacks',async()=>{
 let microseconds=0,charge=false,host;host=createSimulationHost(()=>{},{allowDebug:true,scriptClock:()=>{if(charge&&host.game?.scriptProfiler.script){microseconds+=6000;charge=false;}return microseconds;}});
 try{
  await host.receive({type:'init',assets:assets(),scriptBudget:{videoSyncMode:2}});await host.receive({type:'start'});await host.receive({type:'frame'});await host.receive({type:'input',action:'left',down:true});await host.receive({type:'debug',action:'advance',ticks:20});
  charge=true;await host.receive({type:'frame'});assert.equal(charge,false,'the physical flipper change emits an authored animation event');assert.equal(host.game.scriptStats.elapsedMicroseconds,6000,'frame reset precedes the animation event');
  const before=host.game.scriptStats.timerDeferrals;await host.receive({type:'debug',action:'advance',ticks:1});assert.equal(host.game.scriptStats.timerDeferrals,before+1);assert.ok(Math.abs(host.game.time-.020)<1e-12,'submission still processes the next physical interval');
 }finally{await host.receive({type:'dispose'});}
});
