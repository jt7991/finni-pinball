import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {mainPlayerSettings} from '../player-settings.js';

test('current main mixed nudges retain disabled tilt penalties and every native body and game-state field',()=>{
  const path='three/tests/fixtures/vpx-main-99eff88-mixed-nudges-30000-native.json.gz';
  const fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),c=fixture.cases[0];
  const source=JSON.parse(fs.readFileSync(new URL('../public/source-table.json',import.meta.url)));
  assert.equal(fixture.sourceSha256,source.sourceTableSHA256);
  assert.equal(fixture.controlledSha256,fixture.sourceSha256);
  assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
  assert.deepEqual(fixture.playerSettings,mainPlayerSettings);
  assert.equal(fixture.playerSettings.tiltSensitivity,0);
  assert.equal(c.inputSequence.length,68);
  assert.equal(c.inputSequence.filter(input=>input.action.startsWith('nudge')&&input.down).length,2);
  const fields=Object.keys(fixture.runtimeMissionFrames.fields);
  assert.equal(fields.length,37);
  for(const name of ['tilted','tiltSensitivity','tiltCount','tiltRecovery'])assert.ok(c.missionFrames.every(row=>row[fields.indexOf(name)+1]===0),name);
  const report='.work/three-review/main-mixed-nudges-30000-regression.json';
  execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',path,'--check','--observe-scatter','--report='+report],{
    cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024,
  });
  const [r]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
  assert.equal(r.nativeBodySummary.frames,30000);assert.equal(r.nativeBodySummary.bodies,111985);
  for(const key of ['positionError','velocityError','momentumError','orientationError','identityMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
  assert.deepEqual(r.nativeBodySummary.lifecycles,[
    {ms:1,ids:[0,1,2,3]},
    {ms:10145,ids:[0,1,2,4]},
    {ms:21986,ids:[0,1,2]},
  ]);
  assert.equal(r.nativeRandomAudit.length,30000);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));
  assert.equal(r.nativeScriptRandomAudit.length,30000);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
  assert.equal(r.nativeFlipperSummary.inputs,68);assert.deepEqual(r.nativeFlipperSummary.angleErrors,[0,0]);
  assert.equal(r.flipperContacts.length,4);assert.deepEqual(r.flipperContacts,c.flipperContacts);
  assert.equal(r.animationSummary.frames,1798);assert.equal(r.animationSummary.stateMismatches,0);assert.equal(r.animationSummary.offsetError,0);
  assert.equal(r.missionSummary.frames,1798);assert.equal(r.missionSummary.mismatches,0);assert.deepEqual(r.missionSummary.fields,fields);
  assert.equal(fixture.animationRegression.lastScore,244130);
  assert.equal(r.scriptClockInputs,10);assert.equal(r.scatterDraws.surface,122);
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
