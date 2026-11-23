// Lossless transport of the existing independently validated native readers.
// Decode their original object shape before any physics comparison.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeBallMemoryObserver} from './native-ball-memory-observer.mjs';
import {nativePlungerMemoryObserver} from './native-plunger-memory-observer.mjs';
export const NATIVE_PACKED_FRAME_FORMAT='finni-native-frames-f64le-v1';
export function nativePackedFrameDecoder(storage){
 assert.equal(storage.format,NATIVE_PACKED_FRAME_FORMAT);assert.equal(storage.pageLength,65536);
 assert.equal(new Uint8Array(new Uint16Array([0x0102]).buffer)[0],2);
 const length=storage.pageLength,pages=storage.pages.map(page=>{const bytes=Buffer.from(page.data,'base64');assert.equal(bytes.length,length*8);assert.equal(createHash('sha256').update(bytes).digest('hex'),page.sha256);return new Float64Array(bytes.buffer,bytes.byteOffset,length);});
 const body=nativeBallMemoryObserver(undefined,undefined,undefined),rod=nativePlungerMemoryObserver(undefined,{});
 return index=>{
  assert.ok(Number.isSafeInteger(index)&&index>=0);const source=pages[Math.floor(index/length)],offset=index%length;assert.ok(source&&offset+6<length);const count=source[offset+5];assert.ok(Number.isInteger(count)&&count>=0&&count<=100);assert.ok(offset+6+26*count+18<=length);
  const bodies=body.unpackPacked(source,offset),plunger=rod.unpackPacked(source,bodies.end),state=bodies.state;state.plunger=plunger.state;
  const random=source[plunger.end];assert.ok(Number.isInteger(random)&&random>=-1&&random<16777216);if(random>=0)state.scriptRandom=random;
  return state;
 };
}
export function expandNativePackedFrames(fixture){
 const storage=fixture.nativePackedFrameStorage;if(!storage)return fixture;
 const decode=nativePackedFrameDecoder(storage);
 fixture.nativePackedFrameStorageInfo={format:storage.format,pageLength:storage.pageLength,pages:storage.pages.map(({sha256})=>({sha256}))};delete fixture.nativePackedFrameStorage;
 for(const scenario of fixture.cases){
  for(const row of scenario.nativeRandomFrames){const index=row[3];assert.equal(typeof index,'number');Object.defineProperty(row,3,{enumerable:true,configurable:true,get(){const state=decode(index);Object.defineProperty(row,3,{value:state,enumerable:true,configurable:true,writable:true});return state;}});}
  if(scenario.initialNativeRandom?.packed!==undefined){scenario.initialNativeRandom.internals=decode(scenario.initialNativeRandom.packed);delete scenario.initialNativeRandom.packed;}
 }
 return fixture;
}
