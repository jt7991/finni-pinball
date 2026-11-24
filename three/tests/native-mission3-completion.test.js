import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from'node:zlib';
import{unpackNativeHistoryState}from'../../scripts/native-history-state-package.mjs';import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
test('full native mission 3 completion preserves bumper callbacks, Single lamp state and physical jackpot',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-mission3-full-counter-native.json.gz',import.meta.url))));assert.equal(packet.sourceSHA256,'50ebb29053bde6e0dbbe7d7fba2d03b83497623cd026d21c86cb532955cef77f');assert.equal(packet.sourceBytes,118204747);
 const fixture=unpackNativeHistoryState(packet),controller=fixture.completionController;
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 for(const observer of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.randomizeClocks,fixture.flipperMotion,fixture.moverMotion,controller])assert.deepEqual(observer.errors,[]);assert.deepEqual(fixture.browserErrors,[]);
 assert.deepEqual(fixture.controller,{kind:'controlled-physical-mission-completion',mission:3});assert.equal(controller.scenario.mission,3);assert.equal(controller.completed,true);assert.equal(controller.completedAt,17679);assert.equal(fixture.frames.length,1759);assert.equal(fixture.frames.at(-1).snapshot.ms,30007);
 // These declared approaches are external inputs. The engine generates the
 // actual hits, extra contacts, drain replacement and jackpot scoop itself.
 const shots=controller.actions.filter(a=>a.kind==='shot');assert.deepEqual(shots.map(a=>a.shot),['scoop',...Array.from({length:13},(_,i)=>['Bumper1','Bumper2','Bumper3'][i%3]),'scoop']);assert.deepEqual(shots.map(a=>a.ballID),[3,...Array(6).fill(4),...Array(8).fill(5)]);
 for(const shot of shots)assert.deepEqual(shot.pose,controller.scenario.shots[shot.shot]);assert.equal(controller.scenario.shots.Bumper2.vx,8);
 for(const input of fixture.playerInputs){assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle|BumperHits)\s*\([^)]*\)\s*=|\b(?:Battlenr|bChooseBattle|BattlesToChoose)\s*=|\b(?:StartBattle|CheckBattle|WinBattle|HellHouse_Hit|Bumper[123]_Hit)\b/i);assert.doesNotMatch(input.script,/\bRandomize\b/,'No external random-state override');}
 const observations=fixture.playerInputs.filter(i=>i.ruleState);assert.equal(observations.length,141);const values=observations.map(i=>Object.fromEntries(i.ruleState.names.map((n,j)=>[n,i.ruleState.values[j]]))),sequence=[];
 for(const [i,state]of values.entries()){
  const r=observations[i].ruleState;assert.equal(new Set(r.names).size,36);assert.equal(r.types.length,36);assert.equal(r.expressions[r.names.indexOf('scriptRandom')],'CLng(Rnd(0)*16777216)');assert.equal(r.types[r.names.indexOf('scriptRandom')],3);assert.equal(r.types[r.names.indexOf('balloonState')],4);
  assert.ok(Number.isInteger(state.scriptRandom)&&state.scriptRandom>=0&&state.scriptRandom<16777216);if(sequence.at(-1)!==state.life3)sequence.push(state.life3);
  for(const mission of [1,2,4,5,6,7])assert.equal(state['life'+mission],10);
 }
 // Multiple native contacts can occur between the 100ms read-only queries.
 assert.deepEqual(sequence,[10,9.5,9,8.5,8,7.5,7,6.5,6,5.5,5,4,3,2.5,2,1.5,1,.5,0]);assert.ok(new Set(values.map(s=>s.scriptRandom)).size>1);
 const won=values.find(s=>s.won===1);assert.ok(won);assert.equal(won.life3,0);assert.equal(won.mission3,1);assert.equal(won.endJackpot,1);
 for(const [key,value]of Object.entries({active:0,mission3:1,won:1,life3:0,endJackpot:0,score:4830330,jackpot:3000000,inHole:1,bumperHits:24,balloonState:0}))assert.equal(values.at(-1)[key],value,key);
 // Physics RNG is checked at every retained interval; script RNG directly at
 // the 141 observation checkpoints, with no model state restored from VPX.
 assert.deepEqual(await compareNativeHistoryState(fixture),{framesChecked:1759,intervalsChecked:30008,ticks:30008,randomizeClockSamples:2,timerClockSamples:10,ruleObservationsChecked:141,ruleVariantFieldsChecked:5076,scriptRandomStatesChecked:141,moverStatesChecked:201156,moverFieldsChecked:1542196});
});
