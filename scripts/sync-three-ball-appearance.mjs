// Import observed current-table ball globals and the native null decal texture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
const [input]=process.argv.slice(2),root='three/public/native-ball/';
const bytes=fs.readFileSync(input),capture=JSON.parse(bytes),file=root+'native-ball.json';
const metadata=JSON.parse(fs.readFileSync(file));
const source=JSON.parse(fs.readFileSync('three/public/source-table.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(capture.reference.sourceSha256,source.sourceTableSHA256);
assert.equal(capture.engineSHA256,metadata.engineSHA256);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);
const draws=capture.draws.filter(draw=>draw.matrixKind==='ball');assert.ok(draws.length>=4);
for(const draw of draws)for(const shader of capture.programs[draw.program].shaders){
  const key=shader.type===35633?'vertex':'fragment';
  assert.equal(shader.source,fs.readFileSync(root+metadata.programs.ball[key],'utf8'),'Unchanged native ball '+key+' shader');
}
const archivePath='three/tests/fixtures/source-render-6300.json.gz';
const archive=JSON.parse(gunzipSync(fs.readFileSync(archivePath)));
if(!archive.assets['native-ball/native-ball.json']){
  assert.equal(metadata.sourceTableSHA256,'b6652d58e47924a6ae1652963123b1b95e147167f27df330c302b6da2ba209af','Archive the original controlled-source ball inputs before updating');
  archive.assets['native-ball/native-ball.json']=metadata;
  fs.writeFileSync(archivePath,gzipSync(JSON.stringify(archive),{mtime:0}));
}
for(const key of Object.keys(metadata.globals)){
  const value=draws[0].uniforms[key];assert.ok(value,key);
  for(const draw of draws)assert.deepEqual(draw.uniforms[key],value,key+' across every source ball');
  metadata.globals[key]=value;
}
const disableLighting=draws[0].uniforms.w_h_disableLighting[2];
assert.ok(disableLighting===0||disableLighting===1);
for(const draw of draws)assert.equal(draw.uniforms.w_h_disableLighting[2],disableLighting);
metadata.renderSettings={disableLighting:!!disableLighting};
const objects=JSON.parse(fs.readFileSync('three/public/objects.json'));
metadata.lights=metadata.lights.map(light=>({...light,...objects.objects.find(object=>object.name===light.name)}));
const empty=draws.find(draw=>{
  const texture=capture.textures[draw.textures.tex_ball_decal.id];
  return texture.width===1&&texture.height===1;
});assert.ok(empty,'Native new-ball null decal binding');
const texture=capture.textures[empty.textures.tex_ball_decal.id],pixels=Buffer.from(texture.pixelBytes,'base64');
assert.deepEqual([...pixels],[0,0,0,0]);assert.equal(texture.format,32856);
const id='null-decal',filename='null-decal.rgba.bin';fs.writeFileSync(root+filename,pixels);
metadata.textures[id]={width:1,height:1,format:texture.format,pixelFormat:texture.pixelFormat,pixelType:texture.pixelType,generatedMipmaps:texture.generatedMipmaps,levels:[{level:0,width:1,height:1,file:filename,bytes:pixels.length,sourceBytes:pixels.length,sha256:sha(pixels),sourceSHA256:sha(pixels)}]};
metadata.decalTextures={defaultName:objects.ball_settings.ball_image_front,empty:{id,sampler:empty.textures.tex_ball_decal.sampler}};
metadata.sourceTableSHA256=source.sourceTableSHA256;
metadata.captureSHA256=sha(bytes);
fs.writeFileSync(file,JSON.stringify(metadata));
console.log(JSON.stringify({sourceTable:metadata.sourceTableSHA256,globals:metadata.globals,lights:metadata.lights.length,nullDecalRGBA:[...pixels]}));
