import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {decodeNativeGeometry} from '../native-geometry-codec.js';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import {nativeRenderFiles} from '../render-source.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const expected=readReferenceFixture(new URL('fixtures/source-main-99eff88-render.json.gz',import.meta.url));
const table=read('native-table/'+nativeRenderFiles(expected.sourceSha256).table);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the preceding main render inputs keep their authored appearance and observed native lighting',()=>{
  const objects=read('objects.json').objects;
  for(const [name,properties]of Object.entries(expected.changes)){
    const object=objects.find(object=>object.name===name);
    assert.ok(object,name);
    for(const [key,value]of Object.entries(properties))assert.deepEqual(object[key],value,name+' '+key);
  }
  assert.equal(table.sourceTableSHA256,expected.sourceSha256);
  assert.equal(nativeSourceAssets(expected.sourceSha256).metadata.sourceTableSHA256,expected.sourceSha256);
  assert.deepEqual(objects,nativeSourceAssets(expected.sourceSha256).json('objects.json').objects,'Current source imports exactly the same authored appearance');
  const lighting=read('native-lighting.json');
  assert.deepEqual(lighting.globals.envScaleWidth,expected.globals.fenvEmissionScale_TexWidth);
  assert.deepEqual(lighting.globals.ambientRange,expected.globals.cAmbient_LightRange);
});

test('new decorative and bulb meshes match native GPU bytes while all other meshes stay unchanged',()=>{
  const bytes=Buffer.from(decodeNativeGeometry(fs.readFileSync(new URL('../public/native-table/'+table.geometry.file,import.meta.url)),table.parts,table.geometry.encoding));
  assert.equal(expected.changed.length,36);
  assert.equal(expected.unchanged.length,646);
  for(const reference of [...expected.changed,...expected.unchanged]){
    const part=table.parts[reference.partIndex];
    assert.ok(part,reference.name);
    assert.equal(part.spec.name,reference.name);
    assert.equal(part.role,reference.role);
    assert.equal(sha(bytes.subarray(part.vertexByteOffset,part.indexByteOffset)),reference.vertexSHA256,reference.name+' vertices');
    assert.equal(sha(bytes.subarray(part.indexByteOffset,part.indexByteOffset+part.indices*4)),reference.indexSHA256,reference.name+' triangles');
  }
  for(const texture of expected.textures)assert.equal(table.textures[texture.id].levels[0].sourceSHA256,texture.sourceSHA256);
});
