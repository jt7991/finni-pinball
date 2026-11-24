import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from 'node:child_process';
import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
test('continuous elevated Gate001 shot retains all live native bodies through drain and retained Ball observations',()=>{
 const path='three/tests/fixtures/vpx-gate001-forward-continuous-complete-native.json.gz',fixture=readReferenceFixture(new URL('../../'+path,import.meta.url));
 assert.equal(fixture.captureSource.sha256,'4fcd9674999bf745478b4697acd9dd4453e6fc39db7afc816307bc8ad094e882');assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.ok(fixture.continuousGateControl);assert.equal(fixture.cases[0].parkFromSample,undefined);
 const reportPath='.work/three-review/gate001-forward-continuous-complete-regression.json';
 const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-gates.mjs',path,'--check','--json','--report='+reportPath],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024}));
 assert.equal(r.nativeBodySummary.frames,2001);assert.equal(r.nativeBodySummary.bodies,7835);assert.ok(r.nativeBodySummary.bodies<2001*4,'authored drain retires a live body inside the observation window');
 for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
 assert.equal(r.nativeRandomAudit.length,2001);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.deepEqual(r.nativeScriptSummary,{frames:2001,mismatches:0});assert.equal(r.maxAngleError,0);assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
