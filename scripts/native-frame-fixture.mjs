// Lossless storage of observed native frame inputs AND separate expected images.
// No output image is generated from port pixels or substituted into the scene.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const [mode,source,target]=process.argv.slice(2),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.ok(source&&target);assert.ok(['pack','unpack'].includes(mode));
if(mode==='pack'){
 assert.ok(!fs.existsSync(target),'Preserve existing fixtures');
 const input=JSON.parse(fs.readFileSync(path.join(source,'input.json'))),captureBytes=fs.readFileSync(path.join(source,'capture.json')),capture=JSON.parse(captureBytes),chunks=[],buffers={};let offset=0;
 assert.equal(input.sourceSHA256,sha(captureBytes));assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.frame.errors,[]);assert.equal(input.renderMode.uniformAlignmentReference,false);assert.equal(capture.control.uniformAlignmentReference,false);assert.equal(capture.reference.sourceSha256,capture.reference.controlledSha256);assert.deepEqual(capture.reference.controlledOverrides,{});
 for(const image of Object.values(input.images)){
  assert.equal(path.basename(image.file),image.file);const bytes=fs.readFileSync(path.join(source,image.file));assert.equal(sha(bytes),image.sha256);assert.equal(bytes.length,image.width*image.height*4*(image.arrayType==='Float32Array'?4:1));
  if(!buffers[image.sha256]){buffers[image.sha256]={offset,length:bytes.length};chunks.push(bytes);offset+=bytes.length;}
 }
 const manifest={format:'finni-native-frame-v1',engineSHA256:capture.engineSHA256,tableSHA256:capture.reference.sourceSha256,captureSHA256:sha(captureBytes),nativeDraws:capture.frame.draws.length,control:capture.control,input,buffers,scope:'Observed frozen native scene and temporal inputs, plus separate native output images. Expected current-frame pixels are read only for comparison. No reference upload correction. This fixture does not establish uninterrupted gameplay or physical-device parity.'},header=Buffer.from(JSON.stringify(manifest)),length=Buffer.alloc(4);length.writeUInt32LE(header.length);
 fs.writeFileSync(target,gzipSync(Buffer.concat([length,header,...chunks])));console.log(JSON.stringify({target,images:Object.keys(input.images).length,uniqueBuffers:Object.keys(buffers).length,bytes:fs.statSync(target).size,captureSHA256:manifest.captureSHA256}));
}else{
 const bytes=gunzipSync(fs.readFileSync(source)),length=bytes.readUInt32LE(),manifest=JSON.parse(bytes.subarray(4,4+length)),payload=bytes.subarray(4+length);assert.equal(manifest.format,'finni-native-frame-v1');assert.equal(manifest.input.sourceSHA256,manifest.captureSHA256);assert.equal(manifest.input.renderMode.uniformAlignmentReference,false);
 fs.mkdirSync(target,{recursive:true});const write=(name,bytes)=>{assert.equal(path.basename(name),name);const file=path.join(target,name);if(fs.existsSync(file))assert.equal(sha(fs.readFileSync(file)),sha(bytes),'Preserve existing capture data '+name);else fs.writeFileSync(file,bytes);};
 for(const image of Object.values(manifest.input.images)){const range=manifest.buffers[image.sha256],data=payload.subarray(range.offset,range.offset+range.length);assert.equal(sha(data),image.sha256);write(image.file,data);}
 write('input.json',Buffer.from(JSON.stringify(manifest.input)));write('retained-reference.json',Buffer.from(JSON.stringify({source:path.resolve(source),fixtureSHA256:sha(fs.readFileSync(source)),engineSHA256:manifest.engineSHA256,tableSHA256:manifest.tableSHA256,captureSHA256:manifest.captureSHA256,scope:manifest.scope})));
 console.log(JSON.stringify({target,images:Object.keys(manifest.input.images).length,engineSHA256:manifest.engineSHA256,tableSHA256:manifest.tableSHA256}));
}
