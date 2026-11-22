// Original authored target template; never reconstruct it from posed vertices.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const input=process.argv[2]??'.work/vpx-native-source/mesh-hitTargetRectangleMesh.h',source=fs.readFileSync(input,'utf8'),body=source.slice(source.indexOf('hitTargetRectangleMesh[161]')).split('};')[0],rows=[...body.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1].split(',').map(v=>Math.fround(Number(v.trim().replace(/f$/,'')))));
assert.equal(rows.length,161);assert.ok(rows.every(r=>r.length===8&&r.every(Number.isFinite)));
const bytes=Buffer.from(new Float32Array(rows.flat()).buffer),metadata={upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',source:'src/meshes/hitTargetRectangleMesh.h',sourceSHA256:createHash('sha256').update(fs.readFileSync(input)).digest('hex'),file:'standup-render-template.bin',vertices:161,sha256:createHash('sha256').update(bytes).digest('hex')};
fs.writeFileSync('three/public/'+metadata.file,bytes);fs.writeFileSync('three/public/standup-render-template.json',JSON.stringify(metadata));console.log(JSON.stringify(metadata));
