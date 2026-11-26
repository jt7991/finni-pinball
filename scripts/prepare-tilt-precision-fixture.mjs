import fs from 'node:fs';import assert from 'node:assert/strict';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
import {tiltPrecisionScenarios} from './tilt-precision-scenarios.mjs';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),capture=JSON.parse(bytes),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(capture.metadata.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.deepEqual(capture.errors,[]);
assert.equal(capture.probeSHA256,sha(fs.readFileSync(new URL('./probe-native-tilt-precision.mjs',import.meta.url))));assert.equal(capture.scenarioSHA256,sha(fs.readFileSync(new URL('./tilt-precision-scenarios.mjs',import.meta.url))));
assert.deepEqual(capture.cases.map(c=>({name:c.name,inputs:c.inputs})),tiltPrecisionScenarios);
for(const c of capture.cases){assert.equal(c.rows.length,1501);c.rows.forEach((r,i)=>assert.equal(r[0],i));assert.deepEqual(c.deliveredInputs,c.inputs);}
const packed=gzipSync(Buffer.from(JSON.stringify({...capture,captureSHA256:sha(bytes)})),{level:9});fs.writeFileSync(output,packed,{flag:'wx'});console.log(JSON.stringify({output,sha256:sha(packed),captureSHA256:sha(bytes),rows:capture.cases.reduce((n,c)=>n+c.rows.length,0)}));
