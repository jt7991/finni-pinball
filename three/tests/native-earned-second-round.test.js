import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {unpackNativeHistoryState} from '../../scripts/native-history-state-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';
import {partyChooserScript} from './fixtures/party-chooser-before-scoop-release.js';

test('six earned second-round missions retain reduced attack, fractional bumper progress and repeated multiball',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-main-earned-second-round-through-six-frames-native.json.gz',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'768c3abfd8923cde046bdf477d7f752aada8ab6fefc3d602f4138505b0423682');
 const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.sourceSHA256,'ba01f89a9fed49689ce645c1854b80dd6ba50b453caae53e9d3f15233d2e28dd');assert.equal(packet.sourceBytes,167753333);
 const f=unpackNativeHistoryState(packet),c=f.completionController;
 assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(f.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(f.reference.controlledSha256,f.reference.sourceSha256);assert.deepEqual(f.reference.controlledOverrides,{});
 assert.deepEqual(f.projection,{sourceLogicalJSONBytes:1118555440,sourceLogicalJSONSHA256:'90cb2402450d6360b939115e0386702479a3c63f4b0e3cff2f8de2f31f0a2fd9',excludedArray:{path:'startup.boundaries',rows:260016}});assert.deepEqual(f.startup.boundaries,[],'This portable regression checks every frame; the full original capture separately checks every physical boundary');
 for(const observer of [f,f.startup,f.clock,f.timers,f.randomizeClocks,f.flipperMotion,f.moverMotion,c])assert.deepEqual(observer.errors,[]);assert.deepEqual(f.browserErrors,[]);
 const missions=[1,2,3,4,5,6,7,1,2,3,4,5,6];assert.deepEqual(f.controller,{kind:'controlled-physical-harder-round',completedCounters:missions,missionSequence:missions,collectSpecial:true});assert.equal(c.scenario.nextRoundThrough,6);assert.equal(c.completed,true);assert.equal(c.completedAt,202142);
 assert.deepEqual(c.completions.map(v=>[v.mission,v.won,v.score]),[[1,1,3076000],[2,2,6438000],[3,3,9787660],[4,4,13163660],[5,5,17826660],[6,6,22284660],[7,7,31148660],[1,8,34541660],[2,9,37958660],[3,10,41745880],[4,11,49465880],[5,12,62728880],[6,13,82055880]]);
 assert.equal(c.finale.outcome,'native-victory');assert.equal(c.specialAward.creditsBefore,0);assert.equal(c.specialAward.after.credits,1);assert.equal(c.last.credits,1);assert.equal(c.last.endJackpot,0);assert.equal(c.harderMissions.length,6);
 for(const [i,m] of c.harderMissions.entries()){
  assert.equal(m.mission,i+1);for(const [key,value] of Object.entries({active:i+1,won:i+7,attack:1,wolverine:1,firstBattle:0,credits:1}))assert.equal(m.entry[key],value,key);
  assert.equal(m.entry['life'+m.mission],10);assert.equal(m.entry['mission'+m.mission],2);assert.equal(m.win['life'+m.mission],0);assert.equal(m.win['mission'+m.mission],1);assert.equal(m.win.won,i+8);assert.equal(m.win.endJackpot,1);assert.ok(m.wonAt>m.enteredAt);
 }
 assert.equal(c.harderMissions[5].entry.queued,1,'The second pinata mission queues another authored multiball');assert.equal(c.harderMissions[5].entry.onPlayfield,3);assert.equal(c.harderMissions[5].win.queued,0);
 const observations=f.playerInputs.filter(v=>v.ruleState);assert.equal(observations.length,1931);const bumper=c.harderMissions[2],sequence=[],types=new Set();let quarterObservations=0;
 for(const input of observations){
  const r=input.ruleState;assert.equal(r.ms,input.ms);assert.equal(new Set(r.names).size,56);assert.equal(r.types.length,56);
  if(input.ms>=bumper.enteredAt&&input.ms<=bumper.wonAt){const i=r.names.indexOf('life3'),life=r.values[i];if(sequence.at(-1)!==life)sequence.push(life);types.add(r.types[i]);quarterObservations++;}
 }
 assert.equal(quarterObservations,252);assert.deepEqual([...types],[2,5]);assert.deepEqual(sequence,[10,9.75,9.5,9.25,9,8.75,8.5,8.25,8,7.75,7.5,7.25,7,6.75,6.5,6.25,6,5.75,5.5,5.25,4.75,4.25,4,3.75,3.5,3.25,3,2.75,2.5,2.25,2,1.75,1.5,1.25,1,.75,.5,.25,0]);
 const guardHash=createHash('sha256').update(partyChooserScript).digest('hex');assert.equal(guardHash,'8f1b91959c7f58338c705ab6a937fd537021fb63de309cab2978c54823186a0c');assert.deepEqual(f.playerCorrections,{partyChooserSHA256:guardHash});
 for(const input of f.playerInputs){if(input.script===partyChooserScript)continue;assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle|Dead|BumperHits|bFirstBattle)\s*\([^)]*\)\s*=|\b(?:Credits|AttackPower|WolverineValue|Battlenr|bChooseBattle|BattlesToChoose|bBattleReady|bBallInPlungerLane|bMultiBallMode|BallsOnPlayfield|mBalls2Eject|DazzlerValue)\s*=|\bMrSinisterTimer\.(?:Enabled|Interval)\s*=|\b(?:StartBattle|StopBattle|ResetForNewRound|CheckBattle|WinBattle|AwardSpecial|CheckDead|HellHouse_Hit|Target\d+_Hit|Trigger\d+_Hit|Bumper\d+_Hit|CreateNewBall|AddMultiball|CreateSizedBallWithMass|MrSinisterTimer_Timer|Randomize)\b/i);}
 for(const shot of c.actions.filter(a=>a.kind==='shot'))assert.deepEqual(shot.pose,c.scenario.shots[shot.shot]);
 assert.equal(f.frames.length,15547);assert.equal(f.clock.preparedFrames.length,15547);assert.equal(f.frames.at(-1).snapshot.ms,260016);
 assert.deepEqual(await compareNativeHistoryState(f),{framesChecked:15547,intervalsChecked:0,ticks:260017,randomizeClockSamples:2,timerClockSamples:148,ruleObservationsChecked:1931,ruleVariantFieldsChecked:108136,scriptRandomStatesChecked:1931,moverStatesChecked:186564,moverFieldsChecked:1430324});
});
