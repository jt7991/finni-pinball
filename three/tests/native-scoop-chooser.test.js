import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

test('physical native scoop, Action selection and mission return retain all live balls and authored mission frames',()=>{
  const path='three/tests/fixtures/vpx-original-scoop-chooser-native.json.gz',fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),c=fixture.cases[0];
  assert.equal(fixture.controlledSha256,fixture.sourceSha256);assert.equal(fixture.sourceSha256,'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a');assert.equal(fixture.runtimeRngSites,undefined);assert.equal(fixture.allScatterZero,undefined);assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
  assert.equal(c.inputSequence.length,8);assert.ok(c.inputSequence.some(input=>input.action==='action'&&input.down));assert.equal(c.missionFrames.length,479);
  const report='.work/three-review/scoop-chooser-native-regression.json';
  execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs',path,'--check','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024});
  const [r]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
  assert.equal(r.nativeBodySummary.frames,8000);assert.equal(r.nativeBodySummary.bodies,26558);
  for(const field of ['positionError','velocityError','momentumError','orientationError','identityMismatches'])assert.equal(r.nativeBodySummary[field],0,field);
  assert.deepEqual(fixture.lifecycleRegression,[{ms:1,ids:[0,1,2,3]},{ms:58,ids:[0,1,2]},{ms:5500,ids:[0,1,2,4]}]);
  assert.equal(r.nativeRandomAudit.length,8000);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.equal(r.nativeScriptRandomAudit.length,8000);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
  assert.equal(r.missionSummary.frames,479);assert.equal(r.missionSummary.fields.length,17);assert.equal(r.missionSummary.mismatches,0);assert.equal(r.inputCount,8);
  const last=Object.fromEntries(r.missionSummary.fields.map((name,i)=>[name,r.missionSummary.last.actual[i]]));assert.equal(last.active,2);assert.equal(last.selected,2);assert.equal(last.choosing,0);assert.equal(last.ballsInHole,0);assert.equal(last.score,25000);assert.equal(last.mission2,2);
  assert.deepEqual(r.flipperContacts,c.flipperContacts);assert.equal(r.flipperContacts.length,2);assert.ok(r.flipperContacts.every(row=>row.id===4),'actual flipper collisions belong to the returned ball');
  assert.ok(r.samples.every(row=>row.expected.slice(12).every((value,i)=>value===row.actual[i+12])),'native public ball counts, scoop counts and scores');
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
