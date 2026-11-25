import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';

const root=new URL('../../',import.meta.url);
const cases=[
  ['spinner001-reverse',3,2768],
  ['spinner001-fast',9,2969],
  ['spinner002-reverse',3,2870],
];

for(const [name,spins,recordedFrames]of cases)test(`current main ${name}: isolated native strike preserves every body, score and random state`,()=>{
  const file=`three/tests/fixtures/vpx-main-99eff88-${name}.json.gz`;
  const fixture=readReferenceFixture(new URL('../../'+file,import.meta.url));
  const source=nativeSourceAssets(fixture.sourceSha256).metadata;
  assert.equal(fixture.sourceSha256,source.sourceTableSHA256,'recorded authored table matches replay assets');
  assert.equal(fixture.controlledSha256,fixture.sourceSha256,'original VPX bytes, including source scatter');
  assert.deepEqual(fixture.controlledOverrides,{});
  assert.equal(fixture.nativeRandom.engineSha256,source.engineSHA256);
  assert.ok(fixture.samplePositionEncoding.includes('cast to Double'));
  const frames=fixture.nativeBodyRegression.frames;
  assert.equal(frames,recordedFrames);
  // Direct Single-to-string formatting loses position digits at higher speeds.
  // The recorded COM samples must retain their actual Float32 positions.
  for(const sample of fixture.cases[0].samples)for(const value of sample.slice(1,4))assert.ok(Math.abs(Math.fround(value)-value)<1e-9);
  const [report]=JSON.parse(execFileSync(process.execPath,[
    'scripts/compare-vpx-spinners.mjs',file,'--check','--json',
    `--report=.work/three-review/main-${name}-regression.json`,
  ],{cwd:root,encoding:'utf8',maxBuffer:3*1024*1024}));
  assert.equal(report.samples.length,180);
  assert.equal(report.spins,spins);
  assert.equal(report.scoreMismatches,0);
  assert.equal(report.countMismatches,0);
  assert.equal(report.nativeBodySummary.frames,frames);
  assert.equal(report.nativeBodySummary.bodies,4*frames);
  for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key);
  assert.equal(report.nativeRandomAudit.length,frames);
  assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
  assert.equal(report.nativeScriptRandomAudit.length,frames);
  assert.ok(report.nativeScriptRandomAudit.every(row=>row.agrees));
});
