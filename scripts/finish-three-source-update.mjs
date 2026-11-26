// Finish an audited rules/art-only import. Geometry or physics field changes
// require their own importer, never silent reuse of a preceding collider set.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const [updatePath,cacheCapturePath,imageAuditPath]=process.argv.slice(2),root='three/public/';
const read=file=>JSON.parse(fs.readFileSync(file)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const update=read(updatePath),capture=read(cacheCapturePath),images=read(imageAuditPath),source=read(root+'source-table.json');
assert.equal(source.sourceTableSHA256,update.previousSourceSha256);assert.deepEqual(update.changes,{});assert.deepEqual(update.meshes,{});
assert.deepEqual(update.dataChanges,['CODE','SIMG'],'Only script and the embedded image count change among authored table fields');
assert.equal(update.imageCounts.old,Object.keys(images.old).length);assert.equal(update.imageCounts.new,Object.keys(images.new).length);
assert.equal(capture.reference.sourceSha256,update.sourceSha256);assert.equal(capture.reference.controlledSha256,update.sourceSha256);
assert.equal(capture.engineSHA256,source.engineSHA256);assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);
const audit=capture.textureAudit,rows=audit.textureObjects,byName=new Map(rows.map(row=>[row.name.toLowerCase(),row])),groups=new Map();
assert.equal(rows.length,Object.keys(images.new).length,'Every source image has a verified native object');
for(const row of rows){
  assert.equal(BigInt(row.liveHash),BigInt(row.object)^BigInt(row.pinBinary)^(BigInt(row.width)<<16n)^(BigInt(row.height)<<32n));
  if(!groups.has(row.liveHash))groups.set(row.liveHash,[]);groups.get(row.liveHash).push(row.name);
}
const flasherFile=root+'native-flashers/native-flashers.json',flashers=read(flasherFile);
const originalImages=Object.entries(flashers.images).filter(([,image])=>!image.atlas).map(([name])=>name);
for(const name of originalImages){
  const row=byName.get(name.toLowerCase());assert.ok(row,name+' native source image');
  assert.deepEqual(groups.get(row.liveHash),[row.name],name+' uses its original image without a cache alias');
  assert.equal(images.old[name.toLowerCase()].streamSHA256,images.new[name.toLowerCase()].streamSHA256,name+' original image bytes remain unchanged');
}
const atlas=read(root+'dmd-atlas.json');
for(const [name,region]of Object.entries(atlas))flashers.images[name.toLowerCase()]={atlas:region,alphaTest:flashers.images[name.toLowerCase()]?.alphaTest??Math.fround(1/255)};
flashers.sourceTableSHA256=update.sourceSha256;fs.writeFileSync(flasherFile,JSON.stringify(flashers));
const version=capture.reference.sourceCommit.slice(0,7),file='texture-cache-'+version+'.json';
const provenance={captureSHA256:sha(fs.readFileSync(cacheCapturePath)),imageAuditSHA256:sha(fs.readFileSync(imageAuditPath)),originalImages,sourceObjects:rows.length,scope:'Read-only original GetLiveHash object fields from every embedded source image. All non-atlas flasher images have unique cache keys and retain their preceding embedded bytes, so their existing source bindings need no alias override. No rendered reference image or simulation state is supplied.'};
const cache={engineSHA256:source.engineSHA256,sourceTableSHA256:update.sourceSha256,aliases:{},images:{},provenance};
fs.writeFileSync(root+'native-flashers/'+file,JSON.stringify(cache,null,2)+'\n');
const fixture={engineSHA256:source.engineSHA256,sourceTableSHA256:update.sourceSha256,captureSHA256:provenance.captureSHA256,getter:audit.layout,objects:rows,originalImages:Object.fromEntries(originalImages.map(name=>[name,images.new[name.toLowerCase()]])),scope:provenance.scope};
const fixturePath='three/tests/fixtures/vpx-main-'+version+'-texture-cache.json.gz';
fs.writeFileSync(fixturePath,gzipSync(JSON.stringify(fixture),{level:9}),{flag:'wx'});
source.sourceCommit=capture.reference.sourceCommit;source.sourceTableSHA256=update.sourceSha256;
fs.writeFileSync(root+'source-table.json',JSON.stringify(source));
console.log(JSON.stringify({sourceCommit:source.sourceCommit,sourceTableSHA256:source.sourceTableSHA256,atlasImages:Object.keys(atlas).length,cacheFile:file,sourceObjects:rows.length,fixture:fixturePath,fixtureSHA256:sha(fs.readFileSync(fixturePath))}));
