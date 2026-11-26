import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {unpackNativeHistoryState} from '../../scripts/native-history-state-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function capture(name,hash,sourceHash,sourceBytes){
 const bytes=fs.readFileSync(new URL('fixtures/'+name,import.meta.url));assert.equal(sha(bytes),hash);
 const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.sourceSHA256,sourceHash);assert.equal(packet.sourceBytes,sourceBytes);
 const f=unpackNativeHistoryState(packet);
 assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(f.reference.sourceCommit,'d259c2b2ae69f0281f141a3eda1f6b07793341db');
 assert.equal(f.reference.sourceSha256,'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3');
 assert.equal(f.reference.controlledSha256,f.reference.sourceSha256);assert.deepEqual(f.reference.controlledOverrides,{});
 for(const observer of [f,f.startup,f.clock,f.timers,f.randomizeClocks,f.flipperMotion,f.moverMotion,f.playerStateObserver])assert.deepEqual(observer.errors,[]);
 assert.deepEqual(f.browserErrors,[]);assert.equal(f.selectedPlayers,4);assert.equal(f.completionController,undefined);assert.equal(f.allocationInputs,undefined);
 const guard='a871d7a7d3a7e731ae130700bd06251bf812cf552e3b684eb17801ff59f6c6a5';
 assert.deepEqual(f.playerCorrections,{partyChooserSHA256:guard});assert.equal(f.playerInputs.filter(input=>sha(input.script)===guard).length,1);
 for(const input of f.playerInputs){
  if(sha(input.script)===guard)continue;
  assert.doesNotMatch(input.script,/\.(?:X|Y|Z|VelX|VelY|VelZ)\s*=|\b(?:LifeLeft|BattlesWon|Battle|Dead|Score|BallsRemaining|ExtraBallsAwards|BonusPoints|BonusMultiplier)\s*\([^)]*\)\s*=|\b(?:CurrentPlayer|PlayersPlayingGame|Battlenr|bChooseBattle|BattlesToChoose|bBattleReady|bBallInPlungerLane|bMultiBallMode|BallsOnPlayfield|mBalls2Eject)\s*=|\b(?:GetBalls|ActiveBall|Randomize|StartBattle|StopBattle|ResetForNewRound|WinBattle|CreateNewBall|AddMultiball|CreateSizedBallWithMass)\b/i);
 }
 return f;
}

test('current master preserves ordinary multiplayer launch, flipper, Action and nudge play through a natural turn change',async()=>{
 const f=capture('vpx-main-d259c2b-multiplayer-controls-native.json.gz','2212ff737088da93059bbd4d732624e0e94ff023503e01b1a64e0fcf8bfeb080','d2ff309bd6ba7c06d7c4bf29c23c4db06c8bb49cb0f842c4b45d2800c6f9a728',229522966);
 assert.deepEqual(f.controller,{cadenceMilliseconds:180,nudgeEveryMilliseconds:5000,actionEveryMilliseconds:900,replay:false});
 assert.equal(f.frames.length,3344);assert.equal(f.startup.boundaries.length,60004);assert.equal(f.frames.at(-1).snapshot.ms,60002);assert.equal(f.actions.length,478);
 assert.deepEqual([...new Set(f.actions.map(action=>action.code))].sort(),['Enter','KeyX','ShiftLeft','ShiftRight','Space']);
 const observations=f.playerStateObserver.observations;assert.equal(observations.length,226);assert.deepEqual([...new Set(observations.map(row=>row.state.player))],[1,2]);
 const final=observations.at(-1).state;assert.equal(final.players,4);assert.equal(final.player1_score,554340);assert.equal(final.player1_remaining,2);assert.equal(final.player2_score,21110);assert.equal(final.player2_remaining,3);
 // This one-minute window covers one natural handoff, not all twelve turns.
 // Every recorded physical boundary and both frame phases remain available.
 assert.deepEqual(await compareNativeHistoryState(f),{framesChecked:3344,intervalsChecked:60003,ticks:60003,randomizeClockSamples:2,timerClockSamples:16,ruleObservationsChecked:226,ruleVariantFieldsChecked:8362,scriptRandomStatesChecked:226,moverStatesChecked:400146,moverFieldsChecked:3067786});
});

test('state replay retains the native plunger visibility assignment accompanying camera and static-prepass UI commands',async()=>{
 const f=capture('vpx-main-d259c2b-player-visibility-native.json.gz','aa1e9cbd01c1e5a462c4917f2005c7a1b0f2a0fb1fce870ec241f851b80e849c','565e615afd635d3ea4e57a06cc11c97a83e0392b60e10af81a4f75cab6b47a02',37972355);
 assert.equal(f.frames.length,534);assert.equal(f.startup.boundaries.length,10016);assert.equal(f.frames.at(-1).snapshot.ms,10014);
 const camera=f.playerInputs.filter(input=>input.script.includes('Plunger.Visible=False')&&input.script.includes('DisableStaticPrerendering='));assert.equal(camera.length,1);
 assert.equal(f.playerStateObserver.fields.plungerVisible,'Plunger.Visible');assert.equal(f.playerStateObserver.observations.length,32);
 for(const input of f.playerInputs.filter(input=>input.ruleState)){
  const state=input.ruleState,index=state.names.indexOf('plungerVisible');assert.ok(index>=0);assert.equal(state.values[index],0);assert.equal(state.types[index],11,'original getter is Boolean');
 }
 assert.deepEqual(await compareNativeHistoryState(f,{afterReplay:game=>game.rules.value('Plunger.Visible')}),{framesChecked:534,intervalsChecked:10015,ticks:10015,randomizeClockSamples:2,timerClockSamples:4,ruleObservationsChecked:32,ruleVariantFieldsChecked:1216,scriptRandomStatesChecked:32,moverStatesChecked:66498,moverFieldsChecked:509818,componentResult:false});
});
