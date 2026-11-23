import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
for(const [name,frames,score,count]of [['gate002-forward',1968,0,0],['gate3-forward',1969,0,0],['gate4-reverse',2019,2000,2]])test(`current main continuous ${name} matches every body and both RNG states`,()=>{
 const path=`three/tests/fixtures/vpx-main-99eff88-${name}-continuous-native.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
 assert.equal(fixture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.nativeBodyRegression.frames,frames);assert.equal(fixture.cases[0].parkFromSample,undefined);
 const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-gates.mjs',path,'--check','--json',`--report=.work/three-review/current-main-${name}-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:3*1024*1024}));
 assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,frames*4);for(const field of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(report.nativeBodySummary[field],0,field);
 assert.equal(report.nativeScriptSummary.frames,frames);assert.equal(report.nativeScriptSummary.mismatches,0);assert.ok(report.nativeRandomAudit.every(row=>row.agrees));assert.equal(report.samples.length,120);assert.equal(report.samples.at(-1).score,score);assert.equal(report.samples.at(-1).count,count);
 if(name==='gate4-reverse')assert.ok(report.samples.some(row=>row.angle>80),'Real gate flap crosses its upper limit and rebounds');
});
