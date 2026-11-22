// Extract original, unposed native mesh templates without decimal re-export.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),parts=[],chunks=[];let offset=0;
for(const [name,file,symbol,count]of [['gate-wire','gateWireMesh.h','gateWire',186],['spinner-plate','spinnerPlateMesh.h','spinnerPlate',228],['bumper-skirt','bumperSocketMesh.h','bumperSocket',482]]){
 const source=fs.readFileSync('.work/vpx-native-source/mesh-'+file),text=source.toString(),body=text.slice(text.indexOf(symbol+'['+count+']')).split('};')[0],rows=[...body.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1].split(',').map(v=>Math.fround(Number(v.trim().replace(/f$/,'')))));assert.equal(rows.length,count);assert.ok(rows.every(r=>r.length===8&&r.every(Number.isFinite)));
 const bytes=Buffer.from(new Float32Array(rows.flat()).buffer);parts.push({name,source:'src/meshes/'+file,sourceSHA256:sha(source),vertices:count,byteOffset:offset,sha256:sha(bytes)});chunks.push(bytes);offset+=bytes.length;
}
const bytes=Buffer.concat(chunks),metadata={upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',file:'mechanism-templates.bin',sha256:sha(bytes),parts};fs.writeFileSync('three/public/'+metadata.file,bytes);fs.writeFileSync('three/public/mechanism-templates.json',JSON.stringify(metadata));console.log(JSON.stringify({vertices:parts.map(p=>p.vertices),bytes:bytes.length}));
