// Lossless original observations, portable without a live reference server.
import fs from 'node:fs';import path from 'node:path';import{gzipSync,gunzipSync}from 'node:zlib';import{createHash}from 'node:crypto';import assert from 'node:assert/strict';import{fileURLToPath}from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readNativeFrameHistory(file){
 const packet=JSON.parse(gunzipSync(fs.readFileSync(file)));assert.equal(packet.version,1);
 const source=Buffer.from(packet.capture.bytes,'base64');assert.equal(sha(source),packet.capture.sha256);const capture=JSON.parse(source);
 assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.ok(['3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14','6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5'].includes(capture.reference.sourceSha256));assert.equal(capture.reference.sourceSha256,capture.reference.controlledSha256);assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);assert.ok(capture.frames.length>=2&&capture.frames.length<=4096);assert.deepEqual(capture.frames.map(frame=>frame.frameIndex),Array.from({length:capture.frames.length},(_,i)=>i+1));
 if(capture.imageWindow){assert.equal(capture.imageWindow.warmupFrames+capture.imageWindow.imageFrames,capture.frames.length);assert.ok(capture.imageWindow.warmupFrames>=0&&capture.imageWindow.imageFrames>=2);for(const [i,frame]of capture.frames.entries())assert.equal(Object.keys(frame.images).length>0,i>=capture.imageWindow.warmupFrames);}
 assert.equal(packet.authoredCamera.sourceTableSHA256,capture.reference.sourceSha256);const blobs=new Map();
 for(const frame of capture.frames){assert.deepEqual(frame.errors,[]);for(const image of Object.values(frame.images)){
  assert.match(image.file,/^frame-\d+-[a-zA-Z]+\.bin$/);assert.ok(!blobs.has(image.file));const bytes=Buffer.from(packet.blobs[image.file],'base64');assert.equal(sha(bytes),image.sha256);assert.ok(['Float32Array','Uint8Array'].includes(image.arrayType));assert.equal(bytes.length,image.width*image.height*4*(image.arrayType==='Float32Array'?4:1));blobs.set(image.file,bytes);
 }}
 assert.deepEqual(Object.keys(packet.blobs).sort(),[...blobs.keys()].sort());return{packet,capture,source,blobs};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [action,input,output]=process.argv.slice(2);
 if(action==='pack'){
  assert.equal(fs.existsSync(output),false);const bytes=fs.readFileSync(path.join(input,'capture.json')),capture=JSON.parse(bytes),camera=fs.existsSync(path.join(input,'authored-camera.json'))?path.join(input,'authored-camera.json'):path.join(input,'..','native-authored-startup-camera.json'),packet={version:1,capture:{sha256:sha(bytes),bytes:bytes.toString('base64')},authoredCamera:JSON.parse(fs.readFileSync(camera)),blobs:{}};
  for(const frame of capture.frames)for(const image of Object.values(frame.images))packet.blobs[image.file]=fs.readFileSync(path.join(input,image.file)).toString('base64');
  fs.writeFileSync(output,gzipSync(JSON.stringify(packet),{level:9,mtime:0}));readNativeFrameHistory(output);console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,sha256:sha(fs.readFileSync(output))}));
 }else if(action==='unpack'){
  const {packet,source,blobs}=readNativeFrameHistory(input);assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'capture.json'),source);for(const [name,bytes]of blobs)fs.writeFileSync(path.join(output,name),bytes);fs.writeFileSync(path.join(output,'authored-camera.json'),JSON.stringify(packet.authoredCamera));console.log(JSON.stringify({directory:output,images:blobs.size}));
 }else throw Error('Usage: pack <capture-directory> <new.json.gz> | unpack <fixture.json.gz> <new-directory>');
}
