// Import current native GPU geometry. Retain the original mesh file and goldens.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {nativeHaloState} from '../three/native-halo-state.js';
const [directory]=process.argv.slice(2),root='three/public/native-halos/',file=root+'native-halos.json',metadata=JSON.parse(fs.readFileSync(file)),captureBytes=fs.readFileSync(directory+'/capture.json'),capture=JSON.parse(captureBytes),input=JSON.parse(fs.readFileSync(directory+'/input.json')),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),f=Math.fround;
assert.equal(capture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(capture.engineSHA256,metadata.engineSHA256);assert.deepEqual(capture.frame.errors,[]);
const target='halo-meshes-main-99eff88.bin',fixture='three/tests/fixtures/vpx-main-halo-geometry-native.json.gz';assert.ok(!fs.existsSync(root+target)&&!fs.existsSync(fixture),'Preserve prior imports');
const draws=capture.frame.draws.filter(row=>row.lightGeometry&&row.target===capture.frame.images.hdr.id&&!row.classicUniforms),chunks=[],cases=[];let offset=0;
for(const part of metadata.parts){
 const native=input.states[part.spec.name.toLowerCase()],state={visible:native.Visible,color:native.Color,colorfull:native.ColorFull,inplayintensity:native.GetInPlayIntensity},expected=nativeHaloState(part.spec,state),names=['lightColor_intensity','lightColor2_falloff_power','lightCenter_maxRange'];
 const matches=draws.filter(row=>row.lightGeometry.indices===part.indices&&row.lightBlend===expected.blend_modulate_vs_add&&names.every(name=>JSON.stringify(row.uniforms[name])===JSON.stringify(Array.from(expected[name]))));assert.ok(matches.length,'Observed current native halo '+part.spec.name);
 const hashes=matches.map(row=>sha(Buffer.from(row.lightGeometry.vertexBytes,'base64')));assert.equal(new Set(hashes).size,1,'Any coincident native halos must have identical bytes: '+part.spec.name);
 const mesh=matches[0].lightGeometry,vertex=Buffer.from(mesh.vertexBytes,'base64'),index=Buffer.from(mesh.indexBytes,'base64'),vertexSHA256=sha(vertex),indexSHA256=sha(index),height=f(f(f(part.spec.surface_height)+f(part.spec.bulb_halo_height))+f(.1));
 assert.equal(indexSHA256,part.sourceIndexSHA256,'Retain source topology '+part.spec.name);
 for(let i=0;i<vertex.length;i+=32)assert.equal(vertex.readFloatLE(i+8),height,'Source Light::PrepareLightmap height '+part.spec.name);
 cases.push({name:part.spec.name,vertices:mesh.vertices,indices:mesh.indices,vertexSHA256,indexSHA256,height,changed:vertexSHA256!==part.sourceVertexSHA256});
 Object.assign(part,{vertices:mesh.vertices,indices:mesh.indices,vertexByteOffset:offset,indexByteOffset:offset+vertex.length,sourceVertexSHA256:vertexSHA256,sourceIndexSHA256:indexSHA256});chunks.push(vertex,index);offset+=vertex.length+index.length;
}
const geometry=Buffer.concat(chunks);metadata.geometry={file:target,bytes:geometry.length,sha256:sha(geometry)};metadata.sourceTableSHA256=capture.reference.sourceSha256;metadata.geometryProvenance={captureSHA256:sha(captureBytes),scope:'Current main Lightmap GPU vertex/index buffers, read without changing native draws. Original halo-meshes.bin remains available for its original golden tests.'};
fs.writeFileSync(root+target,geometry);fs.writeFileSync(file,JSON.stringify(metadata));fs.writeFileSync(fixture,gzipSync(JSON.stringify({engineSHA256:capture.engineSHA256,sourceTableSHA256:capture.reference.sourceSha256,captureSHA256:sha(captureBytes),geometrySHA256:sha(geometry),cases,scope:metadata.geometryProvenance.scope})));
console.log(JSON.stringify({parts:cases.length,changed:cases.filter(row=>row.changed).length,bytes:geometry.length,geometrySHA256:sha(geometry)}));
