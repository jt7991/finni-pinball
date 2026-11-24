// Lossless retained GPU reference, including exact original capture bytes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';import{gzipSync,gunzipSync}from 'node:zlib';import{pathToFileURL}from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readNativeWholeFramePackage(file){
 const packet=JSON.parse(gunzipSync(fs.readFileSync(file)));assert.equal(packet.format,'finni-native-whole-frame-v1');const captureBytes=gunzipSync(Buffer.from(packet.capture.gzipBase64,'base64'));assert.equal(sha(captureBytes),packet.capture.sha256);assert.equal(packet.input.sourceSHA256,packet.capture.sha256);
 const capture=JSON.parse(captureBytes);assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.control.setup,[]);assert.equal(capture.control.sceneControl.startup,true);assert.deepEqual(capture.reference.controlledOverrides,{});assert.equal(capture.reference.controlledSha256,capture.reference.sourceSha256);
 assert.deepEqual(packet.input.images,capture.frame.images);assert.deepEqual(packet.input.startupScene,capture.startupScene);assert.deepEqual(Object.keys(packet.files).sort(),[...new Set(Object.values(packet.input.images).map(image=>image.file))].sort());
 for(const image of Object.values(packet.input.images)){assert.match(image.file,/^[a-z0-9.-]+\.bin$/i);const blob=packet.files[image.file],bytes=Buffer.from(blob.base64,'base64');assert.equal(bytes.length,blob.bytes);assert.equal(sha(bytes),blob.sha256);assert.equal(blob.sha256,image.sha256);}
 return{packet,capture,captureBytes};
}
export function packNativeWholeFrame(directory,file){
 assert.equal(fs.existsSync(file),false,'Preserve retained GPU references');const captureBytes=fs.readFileSync(path.join(directory,'capture.json')),input=JSON.parse(fs.readFileSync(path.join(directory,'input.json'))),files={};
 for(const image of Object.values(input.images)){assert.match(image.file,/^[a-z0-9.-]+\.bin$/i);const bytes=fs.readFileSync(path.join(directory,image.file));assert.equal(sha(bytes),image.sha256);files[image.file]={bytes:bytes.length,sha256:image.sha256,base64:bytes.toString('base64')};}
 const packet={format:'finni-native-whole-frame-v1',capture:{sha256:sha(captureBytes),gzipBase64:gzipSync(captureBytes,{level:9}).toString('base64')},input,files,scope:'Original native normal-start capture, unchanged source GPU images and original byte-level provenance. Rendering regression uses port-generated scene/body state, observed native timer/animation clocks and explicit common prior temporal images. This is not an uninterrupted native-budget-policy/history proof.'};
 fs.writeFileSync(file,gzipSync(Buffer.from(JSON.stringify(packet)),{level:9}));readNativeWholeFramePackage(file);return{file,bytes:fs.statSync(file).size,images:Object.keys(files).length,captureSHA256:packet.capture.sha256};
}
export function unpackNativeWholeFrame(file,directory){
 const {packet,captureBytes}=readNativeWholeFramePackage(file);assert.equal(fs.existsSync(directory),false,'Use a new reference extraction directory');fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'capture.json'),captureBytes,{flag:'wx'});fs.writeFileSync(path.join(directory,'input.json'),JSON.stringify(packet.input),{flag:'wx'});for(const [file,blob]of Object.entries(packet.files))fs.writeFileSync(path.join(directory,file),Buffer.from(blob.base64,'base64'),{flag:'wx'});return{directory,images:Object.keys(packet.files).length,captureSHA256:packet.capture.sha256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const [command,source,target]=process.argv.slice(2);assert.ok(source&&target);assert.ok(['pack','unpack'].includes(command));console.log(JSON.stringify(command==='pack'?packNativeWholeFrame(source,target):unpackNativeWholeFrame(source,target)));}
