// Original observations, with lossless pixels or complete image-byte digests.
import fs from 'node:fs';import path from 'node:path';import{gzipSync,gunzipSync}from 'node:zlib';import{createHash}from 'node:crypto';import assert from 'node:assert/strict';import{fileURLToPath}from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function readMetadata(packet){
 assert.ok([1,2].includes(packet.version));
 const encoded=Buffer.from(packet.capture.bytes,'base64');let source;
 if(packet.version===2){assert.equal(packet.capture.encoding,'gzip-base64');assert.ok(Number.isSafeInteger(packet.capture.sourceBytes)&&packet.capture.sourceBytes>0);assert.equal(sha(encoded),packet.capture.compressedSHA256,'Compressed original metadata changed');source=gunzipSync(encoded,{maxOutputLength:packet.capture.sourceBytes});assert.equal(source.length,packet.capture.sourceBytes);}
 else{assert.equal(packet.capture.encoding,undefined);source=encoded;}
 assert.equal(sha(source),packet.capture.sha256,'Original metadata bytes changed');const capture=JSON.parse(source);
 assert.notEqual(capture.experimentalHotBlurComponent,true,'Experimental GPU draws are not a clean native reference');
 const frameLimit=capture.projection?32768:8192;if(capture.projection){const p=capture.projection;assert.match(p.sourceManifestSHA256,/^[a-f0-9]{64}$/);assert.match(p.sourceLogicalJSONSHA256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(p.sourceLogicalJSONBytes)&&p.sourceLogicalJSONBytes>0);assert.equal(p.excludedArray.path,'startup.boundaries');assert.ok(Number.isInteger(p.excludedArray.rows)&&p.excludedArray.rows>0);assert.deepEqual(capture.startup.boundaries,[]);}
 assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.ok(['3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14','6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5'].includes(capture.reference.sourceSha256));assert.equal(capture.reference.sourceSha256,capture.reference.controlledSha256);assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);assert.ok(capture.frames.length>=2&&capture.frames.length<=frameLimit);assert.deepEqual(capture.frames.map(frame=>frame.frameIndex),Array.from({length:capture.frames.length},(_,i)=>i+1));
 if(capture.imageWindow){assert.equal(capture.imageWindow.warmupFrames+capture.imageWindow.imageFrames,capture.frames.length);assert.ok(capture.imageWindow.warmupFrames>=0&&capture.imageWindow.imageFrames>=2);for(const [i,frame]of capture.frames.entries())assert.equal(Object.keys(frame.images).length>0,i>=capture.imageWindow.warmupFrames);}
 if(capture.imageTrigger){
  assert.ok(['party-finale','party-finale-victory','next-round-completion'].includes(capture.imageTrigger.kind));assert.equal(capture.physicalController.kind,capture.imageTrigger.kind==='next-round-completion'?'physical-harder-round':'physical-party-finale');assert.equal(capture.physicalController.scenario.completeFinale,true);
  assert.equal(capture.imageTrigger.firstFrame,capture.imageWindow.warmupFrames+1);assert.ok(Number.isInteger(capture.imageTrigger.maxHistoryFrames)&&capture.imageTrigger.maxHistoryFrames>=capture.frames.length&&capture.imageTrigger.maxHistoryFrames<=frameLimit);
  assert.ok(capture.frames[capture.imageWindow.warmupFrames].snapshot.ms>=capture.physicalController.result.finale.enteredAt);
  if(capture.imageTrigger.kind==='party-finale-victory')assert.ok(capture.frames[capture.imageWindow.warmupFrames].snapshot.ms>=capture.physicalController.result.finale.wonAt);
  if(capture.imageTrigger.kind==='next-round-completion'){const c=capture.physicalController,through=c.scenario.nextRoundThrough??1;assert.ok(Number.isInteger(through)&&through>=1&&through<=6);assert.equal(c.scenario.continueRound,true);assert.equal(c.result.completed,true);assert.equal(c.result.last.won,7+through);assert.ok(capture.frames[capture.imageWindow.warmupFrames].snapshot.ms>=c.result.completedAt);}
  if(capture.physicalController.finaleVictoryRequired){assert.equal(capture.physicalController.result.finale.outcome,'native-victory');assert.equal(capture.physicalController.result.finale.win.won,7);}
 }
 assert.equal(packet.authoredCamera.sourceTableSHA256,capture.reference.sourceSha256);const names=new Set();
 for(const frame of capture.frames){assert.deepEqual(frame.errors,[]);for(const image of Object.values(frame.images)){
  assert.match(image.file,/^frame-\d+-[a-zA-Z]+\.bin$/);assert.ok(!names.has(image.file));names.add(image.file);assert.match(image.sha256,/^[a-f0-9]{64}$/);assert.ok(['Float32Array','Uint8Array'].includes(image.arrayType));assert.ok(Number.isInteger(image.width)&&image.width>0&&Number.isInteger(image.height)&&image.height>0);
 }}
 return{packet,capture,source};
}
export function readNativeFrameHistory(file){
 const {packet,capture,source}=readMetadata(JSON.parse(gunzipSync(fs.readFileSync(file))));assert.equal(packet.format,undefined);const blobs=new Map();
 for(const frame of capture.frames){assert.deepEqual(frame.errors,[]);for(const image of Object.values(frame.images)){
  assert.match(image.file,/^frame-\d+-[a-zA-Z]+\.bin$/);assert.ok(!blobs.has(image.file));const bytes=Buffer.from(packet.blobs[image.file],'base64');assert.equal(sha(bytes),image.sha256);assert.ok(['Float32Array','Uint8Array'].includes(image.arrayType));assert.equal(bytes.length,image.width*image.height*4*(image.arrayType==='Float32Array'?4:1));blobs.set(image.file,bytes);
 }}
 assert.deepEqual(Object.keys(packet.blobs).sort(),[...blobs.keys()].sort());return{packet,capture,source,blobs};
}
// Digests retain the unmodified native metadata and every image-byte SHA256.
// The browser replays its own scene and hashes its own buffers. It never needs
// the reference image files, while a single changed image byte fails equality.
export function readNativeFrameHistoryDigests(file){
 const result=readMetadata(JSON.parse(gunzipSync(fs.readFileSync(file))));assert.equal(result.packet.format,'native-frame-history-digests-v'+result.packet.version);assert.equal(result.packet.blobs,undefined);return result;
}
export function packNativeFrameHistoryDigests(input,output){
 assert.equal(fs.existsSync(output),false);const bytes=fs.readFileSync(path.join(input,'capture.json')),camera=fs.existsSync(path.join(input,'authored-camera.json'))?path.join(input,'authored-camera.json'):path.join(input,'..','native-authored-startup-camera.json');
 // Compress the exact original JSON before base64. Large histories can fit
 // V8's JSON limit while their uncompressed base64 wrapper cannot. The native
 // source bytes and their SHA remain unchanged; no observations are dropped.
 const compressed=gzipSync(bytes,{level:9,mtime:0}),packet={version:2,format:'native-frame-history-digests-v2',capture:{encoding:'gzip-base64',sourceBytes:bytes.length,sha256:sha(bytes),compressedSHA256:sha(compressed),bytes:compressed.toString('base64')},authoredCamera:JSON.parse(fs.readFileSync(camera))},metadata=readMetadata(packet);
 for(const frame of metadata.capture.frames)for(const image of Object.values(frame.images)){const data=fs.readFileSync(path.join(input,image.file));assert.equal(data.length,image.width*image.height*4*(image.arrayType==='Float32Array'?4:1));assert.equal(sha(data),image.sha256,'Every digest must first match the actual independent native image file');}
 fs.writeFileSync(output,gzipSync(JSON.stringify(packet),{level:9,mtime:0}));return readNativeFrameHistoryDigests(output);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [action,input,output]=process.argv.slice(2);
 if(action==='pack'){
  assert.equal(fs.existsSync(output),false);const bytes=fs.readFileSync(path.join(input,'capture.json')),capture=JSON.parse(bytes),camera=fs.existsSync(path.join(input,'authored-camera.json'))?path.join(input,'authored-camera.json'):path.join(input,'..','native-authored-startup-camera.json'),packet={version:1,capture:{sha256:sha(bytes),bytes:bytes.toString('base64')},authoredCamera:JSON.parse(fs.readFileSync(camera)),blobs:{}};
  for(const frame of capture.frames)for(const image of Object.values(frame.images))packet.blobs[image.file]=fs.readFileSync(path.join(input,image.file)).toString('base64');
  fs.writeFileSync(output,gzipSync(JSON.stringify(packet),{level:9,mtime:0}));readNativeFrameHistory(output);console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,sha256:sha(fs.readFileSync(output))}));
 }else if(action==='unpack'){
  const {packet,source,blobs}=readNativeFrameHistory(input);assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'capture.json'),source);for(const [name,bytes]of blobs)fs.writeFileSync(path.join(output,name),bytes);fs.writeFileSync(path.join(output,'authored-camera.json'),JSON.stringify(packet.authoredCamera));console.log(JSON.stringify({directory:output,images:blobs.size}));
 }else if(action==='pack-digests'){
  const {capture}=packNativeFrameHistoryDigests(input,output);console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,sha256:sha(fs.readFileSync(output)),frames:capture.frames.length}));
 }else if(action==='unpack-digests'){
  const {packet,source}=readNativeFrameHistoryDigests(input);assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'capture.json'),source);fs.writeFileSync(path.join(output,'authored-camera.json'),JSON.stringify(packet.authoredCamera));console.log(JSON.stringify({directory:output,imageFiles:0,requires:'--image-digests'}));
 }else throw Error('Usage: pack|pack-digests <capture-directory> <new.json.gz> | unpack|unpack-digests <fixture.json.gz> <new-directory>');
}
