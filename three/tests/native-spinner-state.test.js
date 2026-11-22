import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
test('complete native spinner recording preserves all four bodies, scores and both random generators',()=>{
 const path='three/tests/fixtures/vpx-spinner001-forward-native-state.json.gz',fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),frames=fixture.nativeBodyRegression.frames;
 assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(frames,2970);
 const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-spinners.mjs',path,'--check','--json','--report=.work/three-review/spinner001-forward-complete-regression.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:3*1024*1024}));
 assert.equal(report.samples.length,180);assert.equal(report.spins,4);assert.equal(report.scoreMismatches,0);assert.equal(report.countMismatches,0);assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,4*frames);
 for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key+' at every native physics frame');
 assert.equal(report.nativeRandomAudit.length,frames);assert.ok(report.nativeRandomAudit.every(r=>r.agrees));assert.equal(report.nativeScriptRandomAudit.length,frames);assert.ok(report.nativeScriptRandomAudit.every(r=>r.agrees));
});
