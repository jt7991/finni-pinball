// Native counterfactual coverage checks on identical declared component inputs.
// They demonstrate that stop state and stronger torque change the original
// response. No production result is substituted into an expectation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeFlipperCollisionOracle} from './native-flipper-collision-compiled-harness.mjs';

const [fixturePath,output]=process.argv.slice(2);assert.ok(fixturePath&&output,'Supply fixture and new report paths');assert.equal(fs.existsSync(output),false,'Preserve previous audits');
const bytes=fs.readFileSync(fixturePath),fixtureSHA256=createHash('sha256').update(bytes).digest('hex');
assert.equal(fixtureSHA256,'ab99cc8600fa287d92694c263d3b7f4d3c0f0e0efa356ad1e41e2037b00b9f07');
const fixture=JSON.parse(gunzipSync(bytes)),oracle=await nativeFlipperCollisionOracle(),groups={};
for(const {input,expected}of fixture.cases){
  assert.equal(JSON.stringify(oracle.collide(input)),JSON.stringify(expected),'Original component fixture is reproducible');
  if(!input.inContact)continue;
  const key=input.side+':'+input.contactTorque,g=groups[key]??={cases:0,resolved:0,stopChangesResponse:0,strongForceChangesResponse:0};g.cases++;
  if(['x','y','z'].some(axis=>expected.velocity[axis]!==input.velocity[axis]))g.resolved++;
  if(JSON.stringify(oracle.collide({...input,inContact:false}))!==JSON.stringify(expected))g.stopChangesResponse++;
  if(Math.abs(input.contactTorque)>144&&JSON.stringify(oracle.collide({...input,contactTorque:Math.sign(input.contactTorque)*144}))!==JSON.stringify(expected))g.strongForceChangesResponse++;
}
assert.equal(Object.keys(groups).length,20);
for(const [key,g]of Object.entries(groups)){assert.equal(g.cases,256);assert.ok(g.stopChangesResponse>0);if(Math.abs(Number(key.split(':')[1]))>144)assert.ok(g.strongForceChangesResponse>0);}
const report={scope:'Read-only comparisons of independently executed original scratch components. Same declared inputs with stop contact disabled or signed torque reduced to144 demonstrate branch coverage. No native output, clock, RNG or live game state is restored. Signed zeros are numerically equivalent in the portable JSON fixture.',engineSHA256:oracle.engineSHA256,functionSHA256:oracle.functionSHA256,fixtureSHA256,cases:fixture.cases.length,groups};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
