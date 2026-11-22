// Camera fit inputs are generated from source geometry, not captured camera values.
import fs from 'node:fs';import assert from 'node:assert/strict';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {nativeCameraBounds} from '../three/native-camera-bounds.js';
const input=fs.readFileSync('three/tests/fixtures/camera-authored-inputs.json.gz'),authored=JSON.parse(gunzipSync(input)),{bounds,legacy}=nativeCameraBounds(authored),unique=points=>Array.from(new Map(points.map(p=>[JSON.stringify(p),p])).values());
const output={sourceCommit:authored.sourceCommit,sourceTableSHA256:authored.sourceTableSHA256,authoredInputsSHA256:createHash('sha256').update(input).digest('hex'),bounds:unique(bounds),legacy:unique(legacy)};
fs.writeFileSync('three/public/camera-bounds.json',JSON.stringify(output));
const capture=JSON.parse(fs.readFileSync('.work/three-review/native-camera.json'));assert.equal(capture.samples.length,20);assert.deepEqual(capture.errors,[]);capture.scope='Independent compiled VPX geometry UBOs across four camera presets and five fresh viewport/orientation sessions. The separate refraction matProj uniform is retained as observed, including its mismatch with the geometry UBO.';
fs.writeFileSync('three/tests/fixtures/vpx-camera-native.json.gz',gzipSync(JSON.stringify(capture),{level:9}));
console.log(JSON.stringify({bounds:output.bounds.length,legacy:output.legacy.length,bytes:fs.statSync('three/public/camera-bounds.json').size,nativeCases:capture.samples.length}));
