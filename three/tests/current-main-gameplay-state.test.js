import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';

test('current main retains thirty seconds of native heel impacts, scored flipper contacts and ball lifecycle',()=>{
  const file='three/tests/fixtures/vpx-main-99eff88-alternating-30000-native.json.gz';
  const fixture=readReferenceFixture(new URL('../../'+file,import.meta.url));
  const source=nativeSourceAssets(fixture.sourceSha256).metadata;
  assert.equal(fixture.sourceSha256,source.sourceTableSHA256);
  assert.equal(fixture.controlledSha256,fixture.sourceSha256);
  assert.equal(fixture.nativeRandom.engineSha256,source.engineSHA256);
  assert.equal(fixture.allScatterZero,undefined);
  assert.deepEqual(fixture.controlledOverrides,{});
  assert.deepEqual(fixture.runtimeOverrides,{});
  const report='.work/three-review/main-alternating-30000-regression.json';
  execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',file,'--check','--observe-scatter','--report='+report],{
    cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024,
  });
  const [r]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
  assert.equal(r.nativeBodySummary.frames,30000);
  assert.equal(r.nativeBodySummary.bodies,115986);
  for(const key of ['positionError','velocityError','momentumError','orientationError','identityMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
  assert.deepEqual(r.nativeBodySummary.lifecycles,[
    {ms:1,ids:[0,1,2,3]},
    {ms:16159,ids:[0,1,2,4]},
    {ms:25987,ids:[0,1,2]},
  ]);
  assert.equal(r.nativeRandomAudit.length,30000);
  assert.ok(r.nativeRandomAudit.every(row=>row.agrees));
  assert.equal(r.nativeScriptRandomAudit.length,30000);
  assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
  assert.equal(r.nativeFlipperSummary.inputs,32);
  assert.deepEqual(r.nativeFlipperSummary.angleErrors,[0,0]);
  assert.equal(r.flipperContacts.length,6);
  assert.deepEqual(r.flipperContacts,fixture.cases[0].flipperContacts);
  assert.equal(r.animationSummary.frames,1797);
  assert.equal(r.animationSummary.offsetError,0);
  assert.equal(r.animationSummary.stateMismatches,0);
  assert.equal(fixture.animationRegression.lastScore,357540);
  assert.equal(r.scriptClockInputs,10);
  assert.equal(r.scatterDraws.surface,142);
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
