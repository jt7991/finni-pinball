// Playing needs no image encoder. Builds verify the committed derived asset
// against both original/encoded fingerprints so a table sync cannot go stale.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';import{fileURLToPath}from 'node:url';
export function verifyDmdAtlas(publicDirectory=fileURLToPath(new URL('../three/public/',import.meta.url))){
 const root=path.resolve(publicDirectory),metadata=JSON.parse(fs.readFileSync(path.join(root,'dmd-atlas-encoding.json'),'utf8'));
 assert.equal(metadata.version,1);assert.equal(metadata.source,'dmd-atlas.png');assert.equal(metadata.file,'dmd-atlas.webp');assert.equal(metadata.encoding,'webp-lossless');
 const original=fs.readFileSync(path.join(root,metadata.source)),encoded=fs.readFileSync(path.join(root,metadata.file)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(original),metadata.sourceSHA256,'DMD atlas source changed; regenerate with scripts/encode-dmd-atlas.py');
 assert.equal(sha(encoded),metadata.sha256,'Encoded DMD atlas changed; regenerate with scripts/encode-dmd-atlas.py');
 assert.equal(original.length,metadata.sourceBytes);assert.equal(encoded.length,metadata.bytes);
 assert.equal(original.subarray(1,4).toString(),'PNG');assert.equal(original.readUInt32BE(16),metadata.width);assert.equal(original.readUInt32BE(20),metadata.height);
 assert.equal(encoded.subarray(0,4).toString(),'RIFF');assert.equal(encoded.subarray(8,12).toString(),'WEBP');assert.equal(encoded.readUInt32LE(4)+8,encoded.length);
 let offset=12,lossless=false;
 while(offset+8<=encoded.length){
  const kind=encoded.subarray(offset,offset+4).toString(),size=encoded.readUInt32LE(offset+4),start=offset+8;assert.ok(start+size<=encoded.length);assert.notEqual(kind,'VP8 ','DMD atlas must use the lossless codec');
  if(kind==='VP8L'){assert.equal(encoded[start],0x2f);const dimensions=encoded.readUInt32LE(start+1);assert.equal((dimensions&0x3fff)+1,metadata.width);assert.equal(((dimensions>>>14)&0x3fff)+1,metadata.height);lossless=true;}
  offset=start+size+(size&1);
 }
 assert.equal(offset,encoded.length);assert.ok(lossless,'Lossless DMD data is present');assert.match(metadata.rgbaSHA256,/^[a-f0-9]{64}$/);return metadata;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyDmdAtlas(process.argv[2])));
