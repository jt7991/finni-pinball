import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2);assert.ok(input&&output,'Supply native observation and a new fixture path');assert.equal(fs.existsSync(output),false);
const bytes=fs.readFileSync(input),observation=JSON.parse(bytes),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(observation.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(observation.reference.sourceSha256,observation.reference.controlledSha256);assert.deepEqual(observation.reference.controlledOverrides,{});assert.deepEqual(observation.errors,[]);
assert.equal(observation.rows.released.rod.fireTimer,200);assert.ok(observation.rows.released.rod.fireSpeed<0);assert.deepEqual(observation.rows.repeated.rod,observation.rows.released.rod);
const packed=gzipSync(JSON.stringify({format:'native-control-release-v1',observationSHA256:sha(bytes),observation}),{level:9,mtime:0});fs.writeFileSync(output,packed,{flag:'wx'});console.log(JSON.stringify({output,bytes:packed.length,sha256:sha(packed),observationSHA256:sha(bytes)}));
