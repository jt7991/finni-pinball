import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import{nativeTextureCacheFile}from'../native-texture-cache.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-texture-cache-native.json.gz',import.meta.url)))),cache=JSON.parse(fs.readFileSync(new URL('../public/native-flashers/texture-cache.json',import.meta.url)));
test('the native full-table image binding follows the independently observed source texture-cache collision',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceTableSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(cache.sourceTableSHA256,fixture.sourceTableSHA256);
 assert.equal(fixture.getter.originalBody,'0020002903200b');assert.deepEqual(fixture.getter.indices,[4790]);
 const source=new Map(fixture.objects.map(row=>[row.name.toLowerCase(),row]));
 for(const name of ['spotflash','flipperx']){const row=source.get(name);assert.equal(row.getter,4790);assert.equal(BigInt(row.liveHash),BigInt(row.object)^BigInt(row.pinBinary)^(512n<<16n)^(512n<<32n),'original constructor key with its pre-clock zero epoch');}
 assert.equal(source.get('spotflash').liveHash,source.get('flipperx').liveHash);assert.deepEqual(cache.aliases,{spotflash:'flipperx'});
 const selected=fixture.embeddedImages.flipperx,encoded=Buffer.from(selected.encodedBase64,'base64'),upload=fixture.uploads.find(row=>row.id===fixture.warmDraw.flasherTextureA.id);
 assert.equal(sha(encoded),selected.encodedSHA256);assert.equal(upload.frame,1);assert.equal(upload.rgbaSHA256,selected.rgbaSHA256);assert.equal(sha(Buffer.from(fixture.warmDraw.flasherTextureA.bytes,'base64')),selected.rgbaSHA256);assert.notEqual(selected.rgbaSHA256,fixture.embeddedImages.spotflash.rgbaSHA256);
 const published=fs.readFileSync(new URL('../public/native-flashers/'+cache.images.flipperx.levels[0].file,import.meta.url));assert.ok(published.equals(encoded),'published texture is the original embedded image, never a rendered reference');assert.equal(sha(published),cache.images.flipperx.levels[0].sha256);assert.equal(cache.images.flipperx.levels[0].sourceSHA256,upload.rgbaSHA256);assert.equal(cache.provenance.captureSHA256,fixture.captureSHA256);
 assert.equal(fixture.framebuffer.attributes.alpha,true);assert.equal(fixture.framebuffer.attributes.premultipliedAlpha,true);assert.equal(fixture.framebuffer.attributes.preserveDrawingBuffer,false);
});

test('current master uses its independent Spotflash resource instead of the previous table cache collision',()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-6f8116d-texture-cache-native.json.gz',import.meta.url)))),source=JSON.parse(fs.readFileSync(new URL('../public/source-table.json',import.meta.url)));
 assert.equal(current.sourceTableSHA256,source.sourceTableSHA256);assert.equal(current.engineSHA256,source.engineSHA256);
 assert.equal(nativeTextureCacheFile(fixture.sourceTableSHA256),'texture-cache.json');assert.equal(nativeTextureCacheFile(source.sourceTableSHA256),'texture-cache-current.json');assert.throws(()=>nativeTextureCacheFile('unknown'),/No native texture-cache binding/);
 const binding=JSON.parse(fs.readFileSync(new URL('../public/native-flashers/'+nativeTextureCacheFile(source.sourceTableSHA256),import.meta.url)));
 assert.equal(binding.sourceTableSHA256,current.sourceTableSHA256);assert.equal(binding.provenance.captureSHA256,current.captureSHA256);assert.deepEqual(binding.aliases,{});
 assert.equal(current.getter.originalBody,fixture.getter.originalBody);assert.deepEqual(current.getter.indices,[4790]);
 const objects=new Map(current.objects.map(row=>[row.name.toLowerCase(),row]));
 for(const row of objects.values()){assert.equal(row.getter,4790);assert.equal(BigInt(row.liveHash),BigInt(row.object)^BigInt(row.pinBinary)^(BigInt(row.width)<<16n)^(BigInt(row.height)<<32n));}
 assert.notEqual(objects.get('spotflash').liveHash,objects.get('flipperx').liveHash,'current native image objects have distinct original keys');
 const selected=current.embeddedImages.spotflash,upload=current.uploads.find(row=>row.id===current.warmDraw.flasherTextureA.id),image=binding.images.spotflash.levels[0];
 assert.equal(upload.rgbaSHA256,selected.rgbaSHA256);assert.equal(selected.rgbaSHA256,'52662009f02edc4736baf5244fa8432ee3dca58a0de2a69f1a68717629304f9a');assert.equal(sha(Buffer.from(current.warmDraw.flasherTextureA.bytes,'base64')),selected.rgbaSHA256);
 const encoded=Buffer.from(selected.encodedBase64,'base64'),published=fs.readFileSync(new URL('../public/native-flashers/'+image.file,import.meta.url));assert.ok(published.equals(encoded));assert.equal(sha(published),image.sha256);assert.equal(image.sourceSHA256,selected.rgbaSHA256);
});
