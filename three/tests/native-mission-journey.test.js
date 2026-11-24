import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';
import{unpackNativeHistoryState}from'../../scripts/native-history-state-package.mjs';import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
test('uninterrupted native missions 1–4 earn the unlock through physical qualification and collect all four jackpots',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-missions1-through4-native.json.gz',import.meta.url))));assert.equal(packet.sourceSHA256,'787e7d24b51358adb1e84ab52ef303f66d162c9d6087cbab3cddd81388352eb7');assert.equal(packet.sourceBytes,314313227);
 const fixture=unpackNativeHistoryState(packet),controller=fixture.completionController;
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 for(const observer of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.randomizeClocks,fixture.flipperMotion,fixture.moverMotion,controller])assert.deepEqual(observer.errors,[]);assert.deepEqual(fixture.browserErrors,[]);
 assert.deepEqual(fixture.controller,{kind:'controlled-physical-mission-completion',mission:4,missionSequence:[1,2,3,4]});assert.equal(controller.scenario.mission,4);assert.equal(controller.completed,true);assert.equal(controller.completedAt,51312);assert.equal(fixture.frames.length,4758);assert.equal(fixture.frames.at(-1).snapshot.ms,80006);
 assert.deepEqual(controller.completions,[{mission:1,ms:12438,score:3076000,won:1,choices:3},{mission:2,ms:24834,score:6438000,won:2,choices:3},{mission:3,ms:38949,score:9783990,won:3,choices:3},{mission:4,ms:51312,score:13143990,won:4,choices:6}]);
 // Every pose is a declared approach input. No native body observation is
 // restored by the replay, and qualification is earned by actual target hits.
 const shots=controller.actions.filter(a=>a.kind==='shot');for(const shot of shots)assert.deepEqual(shot.pose,controller.scenario.shots[shot.shot]);
 for(const mission of [2,3,4]){
  const bank=shots.filter(a=>a.mission===mission&&/^Target00[1-4]$/.test(a.shot));assert.deepEqual(bank.map(a=>a.shot),['Target001','Target002','Target003','Target004']);
  assert.ok(bank[0].ms>controller.completions[mission-2].ms);assert.ok(bank.at(-1).ms<controller.completions[mission-1].ms);
 }
 assert.deepEqual(shots.filter(a=>a.mission===4).map(a=>a.shot),['Target001','Target002','Target003','Target004','scoop','ramp','wolverine','ramp','wolverine','ramp','scoop']);
 for(const input of fixture.playerInputs){assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle|Dead|BumperHits|bFirstBattle)\s*\([^)]*\)\s*=|\b(?:Battlenr|bChooseBattle|BattlesToChoose|bBattleReady)\s*=|\b(?:StartBattle|CheckBattle|WinBattle|CheckDead|HellHouse_Hit|Target\d+_Hit|Trigger\d+_Hit|Bumper\d+_Hit)\b/i);assert.doesNotMatch(input.script,/\bRandomize\b/,'No external random-state override');}
 const observations=fixture.playerInputs.filter(i=>i.ruleState);assert.equal(observations.length,469);const states=observations.map(i=>Object.fromEntries(i.ruleState.names.map((n,j)=>[n,i.ruleState.values[j]])));
 for(const [i,state]of states.entries()){
  const r=observations[i].ruleState;assert.equal(new Set(r.names).size,43);assert.equal(r.types.length,43);assert.equal(r.expressions[r.names.indexOf('scriptRandom')],'CLng(Rnd(0)*16777216)');assert.equal(r.types[r.names.indexOf('scriptRandom')],3);assert.equal(r.types[r.names.indexOf('balloonState')],4);
  assert.ok(Number.isInteger(state.scriptRandom)&&state.scriptRandom>=0&&state.scriptRandom<16777216);assert.equal(state.player,1);assert.equal(state.ball,1);
  for(const mission of [5,6,7]){assert.equal(state['life'+mission],10);assert.equal(state['mission'+mission],0);}
 }
 for(const [mission,expected]of Object.entries({1:[10,9,8,7,6,4,2,0],2:[10,8,6,4,2,0],3:[10,9.5,9,8.5,6,4.5,4,3.5,3,2.5,1.5,1,.5,0],4:[10,8,6,4,2,0]})){
  const sequence=[];for(const state of states)if(sequence.at(-1)!==state['life'+mission])sequence.push(state['life'+mission]);assert.deepEqual(sequence,expected);
 }
 assert.equal(states[0].choices,3);assert.equal(states[0].won,0);assert.equal(states[0].ready,1);
 const qualified=states.filter((s,i)=>i&&s.ready&&states[i-1].ready===0);assert.deepEqual(qualified.map(s=>s.won),[1,2,3]);for(const s of qualified)assert.deepEqual([s.dead1,s.dead2,s.dead3,s.dead4],[0,0,0,0],'Original target bank resets after qualification');
 const unlocked=states.find(s=>s.active===4);assert.ok(unlocked);assert.equal(unlocked.won,3);assert.equal(unlocked.choices,6);for(const mission of [1,2,3]){assert.equal(unlocked['life'+mission],0);assert.equal(unlocked['mission'+mission],1);}
 for(const [key,value]of Object.entries({active:0,won:4,choices:6,life1:0,life2:0,life3:0,life4:0,mission1:1,mission2:1,mission3:1,mission4:1,score:13143990,endJackpot:0,jackpot:3000000,inHole:1,bumperHits:20}))assert.equal(states.at(-1)[key],value,key);
 // Exact bodies, identity, spin, orientation, flippers, movers and physics RNG
 // at each retained interval; script RNG directly at 469 rule checkpoints.
 assert.deepEqual(await compareNativeHistoryState(fixture),{framesChecked:4758,intervalsChecked:80007,ticks:80007,randomizeClockSamples:2,timerClockSamples:21,ruleObservationsChecked:469,ruleVariantFieldsChecked:20167,scriptRandomStatesChecked:469,moverStatesChecked:537138,moverFieldsChecked:4118058});
});
