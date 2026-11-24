import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from'node:zlib';
import{unpackNativeHistoryState}from'../../scripts/native-history-state-package.mjs';import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
test('full native mission 2 completion preserves physical switch exits, jackpot and observed script random words',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-mission2-full-counter-native.json.gz',import.meta.url))));assert.equal(packet.sourceSHA256,'92d480e31cbf0fe023ed1e723f9054670ee4a39f551955686de9d265a9b89e21');assert.equal(packet.sourceBytes,82671558);
 const fixture=unpackNativeHistoryState(packet),controller=fixture.completionController;
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 for(const observer of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.randomizeClocks,fixture.flipperMotion,fixture.moverMotion,controller])assert.deepEqual(observer.errors,[]);assert.deepEqual(fixture.browserErrors,[]);
 assert.deepEqual(fixture.controller,{kind:'controlled-physical-mission-completion',mission:2});assert.equal(controller.scenario.mission,2);assert.equal(controller.completed,true);assert.equal(controller.completedAt,10560);assert.equal(fixture.frames.length,1283);assert.equal(fixture.frames.at(-1).snapshot.ms,22003);
 // Declared ball approaches are the only pose inputs. The native engine must
 // generate real crossings; no rule counters or switch membership are set.
 const shots=controller.actions.filter(a=>a.kind==='shot');assert.deepEqual(shots.map(a=>a.shot),['scoop','wolverine','wolverine','cross','ramp','wolverine','scoop']);assert.deepEqual(shots.map(a=>a.ballID),[3,4,4,4,4,4,4]);
 for(const shot of shots)assert.deepEqual(shot.pose,controller.scenario.shots[shot.shot]);
 for(const input of fixture.playerInputs){assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle)\s*\([^)]*\)\s*=|\b(?:Battlenr|bChooseBattle|BattlesToChoose)\s*=|\b(?:StartBattle|CheckBattle|WinBattle|HellHouse_Hit)\b/i);assert.doesNotMatch(input.script,/\bRandomize\b/,'No external random-state override');}
 assert.deepEqual(controller.physicalExits.map(e=>e.shot),['wolverine','wolverine','cross','ramp']);
 for(const exit of controller.physicalExits){const b=controller.scenario.clearance[exit.shot],[x,y]=exit.position;assert.ok(x<b.minX||x>b.maxX||y<b.minY||y>b.maxY,'Native physical exit precedes the next approach');const next=shots.find(s=>s.ms>exit.ms);assert.ok(next);assert.ok(exit.life>0);}
 const observations=fixture.playerInputs.filter(i=>i.ruleState);assert.equal(observations.length,75);const values=observations.map(i=>Object.fromEntries(i.ruleState.names.map((n,j)=>[n,i.ruleState.values[j]]))),sequence=[];
 for(const [i,state]of values.entries()){
  const r=observations[i].ruleState;assert.equal(new Set(r.names).size,34);assert.equal(r.types.length,34);assert.equal(r.expressions[r.names.indexOf('scriptRandom')],'CLng(Rnd(0)*16777216)');assert.equal(r.types[r.names.indexOf('scriptRandom')],3);
  assert.ok(Number.isInteger(state.scriptRandom)&&state.scriptRandom>=0&&state.scriptRandom<16777216);if(sequence.at(-1)!==state.life2)sequence.push(state.life2);
  for(const mission of [1,3,4,5,6,7])assert.equal(state['life'+mission],10);
 }
 assert.deepEqual(sequence,[10,8,6,4,2,0]);assert.ok(new Set(values.map(s=>s.scriptRandom)).size>1,'The observed stream advances through authored calls');
 const won=values.find(s=>s.won===1);assert.ok(won);assert.equal(won.life2,0);assert.equal(won.mission2,1);assert.equal(won.endJackpot,1);
 for(const [key,value]of Object.entries({active:0,mission2:1,won:1,life2:0,endJackpot:0,score:3108000,jackpot:3000000,inHole:1}))assert.equal(values.at(-1)[key],value,key);
 // Physics RNG is checked at every retained interval. Script RNG words are
 // directly checked at the 75 read-only rule checkpoints, not every interval.
 assert.deepEqual(await compareNativeHistoryState(fixture),{framesChecked:1283,intervalsChecked:22004,ticks:22004,randomizeClockSamples:2,timerClockSamples:9,ruleObservationsChecked:75,ruleVariantFieldsChecked:2550,scriptRandomStatesChecked:75,moverStatesChecked:147420,moverFieldsChecked:1130220});
});
