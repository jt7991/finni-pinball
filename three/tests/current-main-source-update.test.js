import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import {nativeTextureProfile} from '../native-basic-render.js';
import {nativeTextureCacheFile} from '../native-texture-cache.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const fixture=(name,hash)=>{const bytes=fs.readFileSync(new URL('fixtures/'+name,import.meta.url));assert.equal(sha(bytes),hash);return JSON.parse(gunzipSync(bytes));};
const assets=fixture('vpx-main-d259c2b-assets.json.gz','9d35f760d774d4afcaa8bc10316bd6779431a9b16bafb1c0100f32b52629511e');
const cache=fixture('vpx-main-d259c2b-texture-cache.json.gz','9eb468ce3e23807f7c105995ca6c4c917cf478d882badc82c5ecd9d1a5c6fc5f');

test('current master retains every preceding physical input and sound while importing its new source rules and DMD images',()=>{
  const archived=nativeSourceAssets(assets.sourceTableSHA256),current=archived.metadata,previous=nativeSourceAssets(assets.previousSourceSHA256);
  assert.equal(current.sourceCommit,'d259c2b2ae69f0281f141a3eda1f6b07793341db');
  assert.equal(current.sourceTableSHA256,'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3');
  assert.equal(current.sourceTableSHA256,assets.sourceTableSHA256);assert.equal(current.engineSHA256,assets.engineSHA256);
  assert.deepEqual(assets.dataChanges,['CODE','SIMG']);assert.deepEqual(assets.changedObjects,{});assert.deepEqual(assets.changedMeshes,{});
  for(const name of ['layout.json','objects.json','audio.json','native-audio/effects.json'])assert.ok(previous.bytes(name).equals(archived.bytes(name)),name+' unchanged authored input');
  assert.deepEqual(assets.sounds,{total:376,reused:376});assert.deepEqual(assets.imageCounts,{old:1303,new:1498});
  assert.deepEqual(assets.sourceImages.removed,[]);assert.equal(assets.sourceImages.added.length,195);
  const atlas=read('dmd-atlas.json'),flashers=read('native-flashers/native-flashers.json');
  for(const name of assets.sourceImages.added){assert.ok(atlas[name],name+' in delivered atlas');assert.deepEqual(flashers.images[name].atlas,atlas[name],name+' native sprite rectangle');}
  const source=archived.text('rules.vbs');
  assert.notEqual(source,previous.text('rules.vbs'));assert.match(source,/Function FinniScoreScene\(background\)/);assert.match(source,/DMD tmp, tmp1, FinniScoreScene\(tmp2\)/);
});

test('current native material uploads match Performance and both independent Detailed captures',()=>{
  const table=read('native-table/native-table.json');assert.equal(table.sourceTableSHA256,assets.sourceTableSHA256);
  assert.equal(assets.profiles.length,3);
  for(const profile of assets.profiles){
    assert.equal(profile.reference.sourceSha256,assets.sourceTableSHA256);assert.equal(profile.reference.controlledSha256,assets.sourceTableSHA256);assert.deepEqual(profile.reference.controlledOverrides,{});
    assert.equal(profile.associations.length,90);assert.equal(profile.unmatched.length,18);
    assert.equal(profile.associations.filter(row=>row.name.startsWith('Target')).length,14,'all authored targets retain their independently captured image bindings');
    const selected=nativeTextureProfile(table,profile.quality);
    for(const reference of profile.associations){
      const part=table.parts[reference.partIndex];assert.equal(part.spec.name,reference.name);assert.equal(part.role,reference.role);
      assert.equal(part.sourceVertexSHA256,reference.vertexSHA256);assert.equal(part.sourceIndexSHA256,reference.indexSHA256);
      const image=selected.textures[part.textures.tex_base_color.id];
      assert.equal(image.width,reference.width,reference.name+' width');assert.equal(image.height,reference.height,reference.name+' height');assert.equal(image.format,reference.format);
      assert.equal(image.levels[0].sourceSHA256,reference.sha256,reference.name+' original upload pixels');
      assert.equal(sha(fs.readFileSync(new URL('../public/native-table/'+image.levels[0].file,import.meta.url))),image.levels[0].sha256);
    }
  }
});

test('current source cache verifies all image object keys, the native spinner collision and unchanged flasher source bindings',()=>{
  assert.equal(cache.sourceTableSHA256,assets.sourceTableSHA256);assert.equal(cache.engineSHA256,assets.engineSHA256);
  assert.equal(cache.getter.originalBody,'0020002903200b');assert.deepEqual(cache.getter.indices,[4790]);assert.equal(cache.objects.length,1498);
  const groups=new Map(),objects=new Map(cache.objects.map(row=>[row.name.toLowerCase(),row]));
  assert.equal(objects.size,1498);assert.ok(objects.has('pf'),'short native playfield name is included');
  for(const row of cache.objects){
    assert.equal(row.getter,4790);assert.equal(BigInt(row.liveHash),BigInt(row.object)^BigInt(row.pinBinary)^(BigInt(row.width)<<16n)^(BigInt(row.height)<<32n));
    if(!groups.has(row.liveHash))groups.set(row.liveHash,[]);groups.get(row.liveHash).push(row.name.toLowerCase());
  }
  assert.equal(objects.get('spinner').liveHash,objects.get('domeflasher_half').liveHash);
  const file=nativeTextureCacheFile(cache.sourceTableSHA256),binding=read('native-flashers/'+file);
  assert.equal(binding.sourceTableSHA256,cache.sourceTableSHA256);assert.equal(binding.provenance.captureSHA256,cache.captureSHA256);
  assert.deepEqual(binding.aliases,{});assert.deepEqual(binding.images,{});
  const old=read('native-flashers/native-flashers-cc6f04f.json'),current=read('native-flashers/native-flashers.json');
  for(const [name,source]of Object.entries(cache.originalImages)){
    assert.deepEqual(groups.get(objects.get(name.toLowerCase()).liveHash),[name.toLowerCase()]);
    assert.deepEqual(current.images[name],old.images[name],name+' keeps its source resource');
    const image=current.textures[current.images[name].texture];assert.deepEqual(image,old.textures[old.images[name].texture]);
    if(source.rgbaSHA256)assert.equal(image.levels[0].sourceSHA256,source.rgbaSHA256,name+' embedded source pixels');
  }
});
