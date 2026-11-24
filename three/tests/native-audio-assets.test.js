import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePCM16Wave} from '../audio-pcm.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-pcm16-audio.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
test('every authored effect retains original source identity, exact fallback samples and lossless format',()=>{
 assert.equal(fixture.sourceTableSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.clips.length,352);
 assert.deepEqual(Object.keys(manifest).filter(n=>!manifest[n].music).sort(),fixture.clips.map(c=>c.name).sort());
 const buffers=new Map(),read=name=>{if(!buffers.has(name))buffers.set(name,fs.readFileSync(new URL('../public/audio/'+name,import.meta.url)));return buffers.get(name);};
 for(const clip of fixture.clips){
  const entry=manifest[clip.name];assert.equal(entry.sourceSHA256,clip.sourceSHA256,clip.name);assert.equal(entry.encoding,'flac-pcm24');
  for(const field of ['channels','frames','sampleRate'])assert.equal(entry[field],clip[field],clip.name+' '+field);
  const wav=read(entry.fallbackFile);assert.equal(sha(wav),clip.sourceSHA256,clip.name+' original WAV');
  const buffer=decodePCM16Wave({createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>data[c]};}},wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength));
  const interleaved=Buffer.alloc(buffer.length*buffer.numberOfChannels*4);
  for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<buffer.length;i++)interleaved.writeFloatLE(data[i],(i*buffer.numberOfChannels+c)*4);}
  assert.equal(sha(interleaved),clip.nativeFloat32SHA256,clip.name+' native signed sample mapping');
  const flac=read(entry.file);assert.equal(sha(flac),entry.encodedSHA256);assert.equal(flac.toString('ascii',0,4),'fLaC');assert.equal(flac[4]&127,0);assert.equal(flac.readUIntBE(5,3),34);
  const info=flac.readBigUInt64BE(18);assert.equal(Number(info>>44n),clip.sampleRate);assert.equal(Number(info>>41n&7n)+1,clip.channels);assert.equal(Number(info>>36n&31n)+1,24);assert.equal(Number(info&0xfffffffffn),clip.frames);
 }
});
