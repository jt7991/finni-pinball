import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {unpackNativeHistoryState} from '../../scripts/native-history-state-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';
import {partyChooserScript} from '../../browser/party-chooser.js';

test('current master retains thirteen physical wins, six harder missions, Special credit and every submitted frame',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-main-d259c2b-thirteen-wins-frames-native.json.gz',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'6141b3ffbdb49d53ecbbd48ef02ad7a7b29b8d930dbb8dfe935c0ea622469a43');
 const f=unpackNativeHistoryState(JSON.parse(gunzipSync(bytes))),c=f.completionController;
 assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(f.reference.sourceSha256,'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3');assert.equal(f.reference.controlledSha256,f.reference.sourceSha256);assert.deepEqual(f.reference.controlledOverrides,{});assert.equal(f.allocationInputs,undefined);
 assert.deepEqual(f.projection,{sourceLogicalJSONBytes:1268954538,sourceLogicalJSONSHA256:'9c776793f46723e5e69bfdde2ef67afbfd3bb25d04a5572885978366556ef5c2',excludedArray:{path:'startup.boundaries',rows:300012}});assert.deepEqual(f.startup.boundaries,[]);
 for(const observer of [f,f.startup,f.clock,f.timers,f.randomizeClocks,f.flipperMotion,f.moverMotion,f.musicTimeline,c])assert.deepEqual(observer.errors,[]);assert.deepEqual(f.browserErrors,[]);assert.equal(c.completed,true);assert.equal(c.stage,'complete');assert.equal(c.completedAt,202433);
 const missions=[1,2,3,4,5,6,7,1,2,3,4,5,6];assert.deepEqual(c.completions.map(row=>[row.mission,row.won]),missions.map((mission,i)=>[mission,i+1]));assert.deepEqual(f.controller,{kind:'controlled-physical-harder-round',completedCounters:missions,missionSequence:missions,collectSpecial:true});
 assert.equal(c.finale.outcome,'native-victory');assert.equal(c.finale.entry.finaleInterval,120);assert.equal(c.finale.entry.dazzler,0);assert.equal(c.finale.win.won,7);assert.equal(c.finale.win.finaleEnabled,0);assert.deepEqual(c.finale.physicalExits.map(row=>row.life),[8,6,4,2]);
 // wonAt is the later read-only controller query, not the exact Hit time.
 // Original interval, timer delivery, physical boundaries and victory are
 // preserved independently; the observer never extends the deadline.
 assert.equal(c.finale.enteredAt,85410);assert.equal(c.finale.wonAt,85541);assert.equal(c.specialAward.after.credits,c.specialAward.creditsBefore+1);
 assert.equal(c.harderMissions.length,6);for(const [i,row]of c.harderMissions.entries()){assert.equal(row.mission,i+1);assert.equal(row.entry.attack,1);assert.equal(row.entry.firstBattle,0);assert.equal(row.entry.won,7+i);assert.equal(row.entry['life'+row.mission],10);}
 for(const name of ['finaleLoop','finaleWolverine','finaleColossus','finaleOuterLoop']){const shot=c.scenario.shots[name];assert.ok(Math.abs(Math.hypot(shot.vx,shot.vy)-256)<1e-10);}
 assert.deepEqual(f.observerTransport.deferrals,[{deferred:true,ms:85214,stage:'chooser'},{deferred:true,ms:85340,stage:'chooser'},{deferred:true,ms:85447,stage:'finale'}]);assert.equal(f.observerTransport.deferFinaleExports,true);assert.equal(f.frames.length,16326);assert.equal(f.clock.preparedFrames.length,16326);assert.equal(f.frames.at(-1).snapshot.ms,300012);
 assert.deepEqual(f.playerCorrections,{partyChooserSHA256:createHash('sha256').update(partyChooserScript).digest('hex')});assert.equal(f.playerInputs.filter(input=>input.script===partyChooserScript).length,1);
 for(const input of f.playerInputs){if(input.script===partyChooserScript)continue;assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle|Dead|Score|BallsRemaining|bFirstBattle|BonusPoints|BonusMultiplier)\s*\([^)]*\)\s*=|\b(?:CurrentPlayer|AttackPower|Battlenr|bChooseBattle|BattlesToChoose|bBattleReady|bMultiBallMode|BallsOnPlayfield|mBalls2Eject|dazzlerValue|Credits)\s*=|\bMrSinisterTimer\.(?:Enabled|Interval)\s*=|\b(?:Randomize|StartBattle|StopBattle|ResetForNewRound|WinBattle)\b/i);}
 assert.deepEqual(await compareNativeHistoryState(f),{framesChecked:16326,intervalsChecked:0,ticks:300013,randomizeClockSamples:2,timerClockSamples:147,musicEventsChecked:10,ruleObservationsChecked:1876,ruleVariantFieldsChecked:127568,scriptRandomStatesChecked:1876,moverStatesChecked:195912,moverFieldsChecked:1501992});
});
