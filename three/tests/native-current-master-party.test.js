import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readNativeHistoryCapture} from '../../scripts/native-history-pages.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('current master retains seven physical wins, multiball finale, round reset, scoop jackpot and every browser-music cue',async()=>{
 const file=new URL('fixtures/vpx-main-d259c2b-party-victory-native.json.gz',import.meta.url);
 assert.equal(sha(fs.readFileSync(file)),'6f3aaaf484a6cb0720bea25f6c9fb5f9c0e8c27d65fbd646db3cc5f2ff0995fb');
 // The bundle verifies every page and the complete 387,011,256-byte original
 // logical capture. No millisecond boundary, frame or UI input is projected out.
 const f=readNativeHistoryCapture(file),c=f.completionController;
 assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(f.reference.sourceCommit,'d259c2b2ae69f0281f141a3eda1f6b07793341db');
 assert.equal(f.reference.sourceSha256,'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3');
 assert.equal(f.reference.controlledSha256,f.reference.sourceSha256);assert.deepEqual(f.reference.controlledOverrides,{});
 for(const observer of [f,f.startup,f.clock,f.timers,f.randomizeClocks,f.flipperMotion,f.moverMotion,f.musicTimeline,c])assert.deepEqual(observer.errors,[]);
 assert.deepEqual(f.browserErrors,[]);assert.equal(f.projection,undefined);assert.equal(f.allocationInputs,undefined);
 assert.equal(f.frames.length,5612);assert.equal(f.startup.boundaries.length,100006);assert.equal(f.frames.at(-1).snapshot.ms,100006);
 assert.deepEqual(f.controller,{kind:'controlled-physical-final-party-victory',completedCounters:[1,2,3,4,5,6,7],missionSequence:[1,2,3,4,5,6,7]});
 assert.equal(c.completed,true);assert.equal(c.stage,'complete');assert.equal(c.completedAt,81635);
 assert.deepEqual(c.completions.map(row=>[row.mission,row.won]),[[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7]]);
 assert.equal(c.completions.at(-1).score,29776090);
 const finale=c.finale;assert.equal(finale.outcome,'native-victory');assert.equal(finale.enteredAt,78534);assert.equal(finale.wonAt,78646);
 assert.equal(finale.entry.multi,1);assert.equal(finale.entry.onPlayfield,2);assert.equal(finale.entry.active,7);assert.equal(finale.entry.life7,10);
 assert.deepEqual(finale.physicalExits.map(exit=>exit.life),[8,6,4,2]);
 for(const exit of finale.physicalExits){const bounds=c.scenario.clearance[exit.clearance],[x,y]=exit.position;assert.ok(exit.observedAt>exit.ms);assert.ok(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY);}
 assert.equal(finale.win.won,7);assert.equal(finale.win.finaleEnabled,0);assert.equal(finale.win.special,2);assert.equal(finale.win.jackpot,7000000);assert.equal(finale.win.endJackpot,1);
 for(let mission=1;mission<=7;mission++){assert.equal(finale.win['life'+mission],10);assert.equal(finale.win['mission'+mission],0);}
 assert.equal(c.last.endJackpot,0);assert.equal(c.last.jackpot,3000000);
 assert.deepEqual(f.timers.events.filter(row=>row.name.toLowerCase()==='mrsinistertimer'),[],'physical victory cancels the original finale deadline');
 for(const shot of c.actions.filter(action=>action.kind==='shot'))assert.deepEqual(shot.pose,c.scenario.shots[shot.shot]);
 const guard='a871d7a7d3a7e731ae130700bd06251bf812cf552e3b684eb17801ff59f6c6a5';
 assert.deepEqual(f.playerCorrections,{partyChooserSHA256:guard});assert.equal(f.playerInputs.filter(input=>sha(input.script)===guard).length,1);
 for(const input of f.playerInputs){
  if(sha(input.script)===guard)continue;
  assert.doesNotMatch(input.script,/\b(?:LifeLeft|BattlesWon|Battle|Dead|BumperHits|bFirstBattle)\s*\([^)]*\)\s*=|\b(?:Battlenr|bChooseBattle|BattlesToChoose|bBattleReady|bBallInPlungerLane|bMultiBallMode|BallsOnPlayfield|mBalls2Eject|DazzlerValue)\s*=|\bMrSinisterTimer\.(?:Enabled|Interval)\s*=|\b(?:StartBattle|StopBattle|ResetForNewRound|CheckBattle|WinBattle|CheckDead|HellHouse_Hit|Target\d+_Hit|Trigger\d+_Hit|Bumper\d+_Hit|CreateNewBall|AddMultiball|CreateSizedBallWithMass|MrSinisterTimer_Timer|Randomize)\b/i);
 }
 assert.equal(f.musicTimeline.events.length,19);assert.equal(f.musicTimeline.events.filter(row=>row.type==='ready').length,1);
 // Approaches are declared physical inputs. The model must regenerate all
 // contacts, progress, bodies and both random streams using production order.
 assert.deepEqual(await compareNativeHistoryState(f),{framesChecked:5612,intervalsChecked:100006,ticks:100007,randomizeClockSamples:2,timerClockSamples:50,musicEventsChecked:19,ruleObservationsChecked:743,ruleVariantFieldsChecked:49781,scriptRandomStatesChecked:743,moverStatesChecked:667380,moverFieldsChecked:5116580});
});
