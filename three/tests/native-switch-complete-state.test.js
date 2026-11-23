import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from 'node:child_process';import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
test('a complete native shooter-switch capture preserves every body, rod field and random state for one second',()=>{
 const root=new URL('../../',import.meta.url),path='three/tests/fixtures/vpx-shooter-switch-1000-complete-native.json.gz',fixture=readReferenceFixture(new URL(path,root));
 assert.equal(fixture.sourceSha256,'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a');assert.equal(fixture.controlledSha256,'b6652d58e47924a6ae1652963123b1b95e147167f27df330c302b6da2ba209af');assert.equal(fixture.nativeBodyRegression.frames,1000);
 const output='.work/three-review/shooter-switch-complete-1000-regression.json';execFileSync(process.execPath,['scripts/compare-vpx-triggers.mjs',path,'--check','--report='+output],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
 const [report]=JSON.parse(fs.readFileSync(new URL(output,root)));assert.equal(report.nativeBodySummary.frames,1000);assert.equal(report.nativeBodySummary.bodies,4000);
 for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(report.nativeBodySummary[key],0,key);
 for(const rows of [report.nativeRandomAudit,report.nativeScriptRandomAudit]){assert.equal(rows.length,1000);assert.ok(rows.every(row=>row.agrees));}
 assert.equal(report.nativePlungerSummary.frames,1000);for(const [key,error]of Object.entries(report.nativePlungerSummary.errors)){assert.equal(error,0,key);assert.equal(report.nativePlungerSummary.observations[key],1000,key);}
 assert.equal(report.membershipMismatches,0);assert.equal(report.physicsStats.substepBudgetExceeded,0);
});
