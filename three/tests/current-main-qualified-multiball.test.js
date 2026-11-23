import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

test('current main qualified mission6 matches native multiball, saver replacements and every physical body',()=>{
 const path='three/tests/fixtures/vpx-main-99eff88-qualified-mission6-native.json.gz';
 const fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),scenario=fixture.cases[0];
 assert.equal(fixture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.controlledSha256,fixture.sourceSha256);
 assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
 assert.equal(fixture.runtimeRngSites,undefined);assert.equal(fixture.allScatterZero,undefined);
 assert.equal(fixture.startingProgress.battlesWon,3,'Declared starting qualification; this does not cover natural mission progression');
 assert.deepEqual(scenario.controlledShot,{ms:1800,id:3,inLane:0},'One declared scoop approach after physical launcher exit');

 // The observer was installed from an older instrumented script. Verify that
 // removing its explicit diagnostic blocks leaves the current authored body.
 // Every other statement, including comments and its ordering, must survive.
 const normalize=code=>code.replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n');
 const authored=code=>normalize(code)
  .replace(/^    If RefDriveAt>0 And GameTime>=RefDriveAt Then\n[\s\S]*?^    End If\n/m,'')
  .replace(/^    If RefTrailOn Then\n[\s\S]*?^    End If\n/m,'')
  .split('\n').filter(line=>!line.includes('RefTrace')).join('\n');
 const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
 for(const handler of fixture.runtimeInputSequence.originalHandlers){
  const current=source.match(new RegExp('^Sub '+handler.name+'\\b[\\s\\S]*?^End Sub','mi'))?.[0];
  assert.ok(current,handler.name);assert.equal(authored(handler.code),normalize(current),handler.name);
  if(handler.name==='LeftFlipper_Timer')assert.equal(createHash('sha256').update(normalize(current)).digest('hex'),fixture.runtimeMarkers.authoredHandlerSHA256);
 }
 for(const handler of [...fixture.runtimeInitialTimerClocks.handlers,...fixture.runtimeInitialTimerClocks.soundHandlers]){
  const current=source.match(new RegExp('^Sub '+handler.name+'(?:_Timer)?\\b[\\s\\S]*?^End Sub','mi'))?.[0];
  assert.ok(current,handler.name);assert.equal(normalize(handler.original),normalize(current),handler.name);
 }

 const report='.work/three-review/current-main-qualified-mission6-regression.json';
 execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',path,'--check','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024});
 const [result]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
 assert.equal(result.nativeBodySummary.frames,12000);assert.equal(result.nativeBodySummary.bodies,59926);
 for(const field of ['positionError','velocityError','momentumError','orientationError','identityMismatches'])assert.equal(result.nativeBodySummary[field],0,field);
 assert.deepEqual(result.nativeBodySummary.lifecycles,fixture.lifecycleRegression);
 assert.deepEqual(fixture.lifecycleRegression,[{ms:1,ids:[0,1,2,3]},{ms:1857,ids:[0,1,2]},{ms:2500,ids:[0,1,2,4]},{ms:4501,ids:[0,1,2,4,5]},{ms:5482,ids:[0,1,2,4,5,6]},{ms:8942,ids:[0,1,2,5,6,7]},{ms:9032,ids:[0,1,2,6,7]},{ms:10482,ids:[0,1,2,6,7,8]}]);
 for(const audit of [result.nativeRandomAudit,result.nativeScriptRandomAudit]){assert.equal(audit.length,12000);assert.ok(audit.every(row=>row.agrees));}
 assert.deepEqual(result.nativeFlipperSummary.angleErrors,[0,0]);assert.equal(result.nativeFlipperSummary.inputs,30);
 assert.deepEqual(result.flipperContacts,scenario.flipperContacts);assert.equal(result.flipperContacts.length,7);
 assert.deepEqual(result.controlledShots,[scenario.controlledShot]);
 assert.equal(result.missionSummary.frames,719);assert.equal(result.missionSummary.fields.length,37);assert.equal(result.missionSummary.mismatches,0);
 const last=Object.fromEntries(result.missionSummary.fields.map((field,i)=>[field,result.missionSummary.last.actual[i]]));
 for(const [field,value]of Object.entries({active:6,multiball:1,ballsOnPlayfield:3,pendingBalls:0,inLane:0,saverActive:1,score:153530}))assert.equal(last[field],value,field);
 assert.equal(result.physicsStats.substepBudgetExceeded,0);
});
