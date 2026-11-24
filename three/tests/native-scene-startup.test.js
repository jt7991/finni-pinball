import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from 'node:child_process';import{gunzipSync}from 'node:zlib';
for(const [name,ms,frames]of [['first',2046,100],['independent',2010,102]])test(`ordinary ${name} native startup reproduces every observed lamp and scene property without scene-state restoration`,()=>{
 const root=new URL('../../',import.meta.url),input=`three/tests/fixtures/vpx-main-scene-startup-${name}-native.json.gz`,fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(input,root))));
 assert.equal(fixture.clockABI.functionSHA256,'e7dbad2ee8e355ec8d9a9b097e08bf42201cfe3a5e6ea78d82690937d8658173');assert.equal(fixture.clockABI.currentMilliseconds,40);assert.equal(fixture.clockABI.lastAnimationMilliseconds,44);assert.equal(fixture.freeze.after.ms,ms);assert.equal(fixture.clock.animationFrames.length,frames);
 const output=`.work/three-review/scene-startup-${name}-regression.json`;
 execFileSync(process.execPath,['scripts/compare-native-scene-startup.mjs',input,output,'--check'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
 const report=JSON.parse(fs.readFileSync(new URL(output,root)));assert.equal(report.properties,2478);assert.equal(report.animationFrames,frames);assert.equal(report.ticks,ms+1);assert.deepEqual(report.mismatches,[]);assert.equal(report.bodyComparison.agrees,true);assert.deepEqual(report.random.actual,report.random.expected);
 assert.equal(report.boundaries.frames,2000);assert.equal(report.boundaries.bodies,6520);assert.equal(report.boundaries.bodyMismatches,0);assert.equal(report.boundaries.randomMismatches,0);
 assert.deepEqual(report.missing.map(row=>[row.name,row.field]),['Visible','RotX','RotY','RotZ'].map(field=>['FinniStreamerRamp',field]));
 assert.equal(report.rows.filter(row=>row.field==='Visible'&&/^digit/.test(row.name)&&row.actual===false).length,42);
});
