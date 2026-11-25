// Lossless transport for full native history plus actual device samples.
// Float32 PCM bits replace decimal text; no observations are omitted.
import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{packNativeHistoryState,unpackNativeHistoryState}from'./native-history-state-package.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function packNativeHistoryAudio(bytes){
 const source=JSON.parse(bytes),blocks=[];let length=0;
 for(const callback of source.soundTimeline.callbacks){
  const channels=callback.pcm.length,frames=callback.pcm[0].length,block=Buffer.alloc(channels*frames*4);
  for(let c=0;c<channels;c++){assert.equal(callback.pcm[c].length,frames);for(let i=0;i<frames;i++){const value=callback.pcm[c][i];assert.ok(Number.isFinite(value));assert.equal(Math.fround(value),value);block.writeFloatLE(value,(c*frames+i)*4);}}
  callback.pcm={$devicePCM:length,channels,frames};blocks.push(block);length+=block.length;
 }
 const packet={format:'native-history-audio-v1',sourceSHA256:sha(bytes),sourceBytes:bytes.length,history:packNativeHistoryState(Buffer.from(JSON.stringify(source))),pcm:Buffer.concat(blocks).toString('base64')};
 unpackNativeHistoryAudio(packet);return packet;
}
export function unpackNativeHistoryAudio(packet){
 assert.equal(packet.format,'native-history-audio-v1');const source=unpackNativeHistoryState(packet.history),pcm=Buffer.from(packet.pcm,'base64');let consumed=0;
 for(const callback of source.soundTimeline.callbacks){
  const {$devicePCM,channels,frames}=callback.pcm;assert.equal($devicePCM,consumed);assert.equal(channels,2);assert.equal(frames,2048);
  callback.pcm=Array.from({length:channels},()=>Array.from({length:frames},()=>{const value=pcm.readFloatLE(consumed);consumed+=4;return value;}));
 }
 assert.equal(consumed,pcm.length);const bytes=Buffer.from(JSON.stringify(source));assert.equal(bytes.length,packet.sourceBytes);assert.equal(sha(bytes),packet.sourceSHA256,'Complete original history and device PCM reconstruct exactly');return source;
}
