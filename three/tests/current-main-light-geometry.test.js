import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),root=new URL('../public/',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,root)));

test('all current main halo meshes retain the independently observed native GPU bytes and authored height',()=>{
 const fixture=readReferenceFixture(new URL('fixtures/vpx-main-halo-geometry-native.json.gz',import.meta.url)),metadata=read('native-halos/native-halos.json'),geometry=fs.readFileSync(new URL('native-halos/'+metadata.geometry.file,root));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceTableSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(sha(geometry),fixture.geometrySHA256);assert.equal(metadata.geometry.sha256,fixture.geometrySHA256);assert.equal(fixture.cases.length,133);assert.equal(fixture.cases.filter(row=>row.changed).length,31);
 for(const native of fixture.cases){
  const part=metadata.parts.find(part=>part.spec.name===native.name),vertex=geometry.subarray(part.vertexByteOffset,part.indexByteOffset),index=geometry.subarray(part.indexByteOffset,part.indexByteOffset+part.indices*4);
  assert.equal(sha(vertex),native.vertexSHA256,native.name+' vertices');assert.equal(sha(index),native.indexSHA256,native.name+' indices');assert.equal(part.vertices,native.vertices);assert.equal(part.indices,native.indices);
  for(let i=0;i<vertex.length;i+=32)assert.equal(vertex.readFloatLE(i+8),native.height,native.name+' observed height');
 }
 assert.equal(sha(fs.readFileSync(new URL('native-halos/halo-meshes.bin',root))),'1c4728d10d64f0e6f55ff50272bc6459b860b431c50e6adf2cc24e6e96b519c6','Original geometry remains available for its original golden tests');
});

test('current main environment lighting applies to hidden and reflected parts as well as visible main draws',()=>{
 const source=read('native-lighting.json').globals.envScaleWidth,table=read('native-table/native-table.json');
 assert.deepEqual(source,[1.399999976158142,256]);assert.equal(table.parts.length,682);
 for(const part of table.parts)assert.deepEqual(part.uniforms.fenvEmissionScale_TexWidth,source,part.spec.name+' environment');
});
