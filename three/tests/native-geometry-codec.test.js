import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {decodeNativeGeometry,encodeNativeGeometry,NATIVE_GEOMETRY_DICTIONARY} from '../native-geometry-codec.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('shared geometry sections reconstruct every native table byte and its original transport digest',()=>{
  const base=new URL('../public/native-table/',import.meta.url),metadata=JSON.parse(fs.readFileSync(new URL('native-table.json',base)));
  const packed=fs.readFileSync(new URL(metadata.geometry.file,base));assert.equal(sha(packed),metadata.geometry.encodedSHA256);
  const raw=Buffer.from(decodeNativeGeometry(packed,metadata.parts,metadata.geometry.encoding));
  assert.equal(raw.length,12812140);assert.equal(sha(raw),'eed7407731dfbbe8bb2f4e6e7352d4998744dbe48665fc283eb5b2e5634471bf');
  const legacy=encodeNativeGeometry(raw,metadata.parts);assert.equal(sha(legacy),'5dd4eb84859244ac63effe3999ba1158d7fd87500024da8ad8d6144725aaa569');
  const dictionary=encodeNativeGeometry(raw,metadata.parts,NATIVE_GEOMETRY_DICTIONARY);
  assert.ok(Buffer.from(decodeNativeGeometry(dictionary,metadata.parts,NATIVE_GEOMETRY_DICTIONARY)).equals(raw));
  assert.ok(Buffer.from(decodeNativeGeometry(legacy,metadata.parts)).equals(raw));
  assert.ok(gzipSync(dictionary).length<gzipSync(legacy).length-400000,'share duplicate sections without changing mesh order or precision');
});

function specimen(){
  const vertex=[0,0x80000000,0x7fa12345,0xff812345,0x7f800000,0xff800000,0xffffffff,0x12345678],index=[0xffffffff];
  const words=[...vertex,...index,...vertex,...index],bytes=Buffer.alloc(words.length*4);words.forEach((word,i)=>bytes.writeUInt32LE(word,i*4));
  return{bytes,parts:[{vertexByteOffset:0,vertices:1,indexByteOffset:32,indices:1},{vertexByteOffset:36,vertices:1,indexByteOffset:68,indices:1}]};
}

test('shared sections preserve signed zero, NaN payloads, infinities and arbitrary index bits',()=>{
  const {bytes,parts}=specimen(),packed=encodeNativeGeometry(bytes,parts,NATIVE_GEOMETRY_DICTIONARY);
  assert.ok(packed.length<bytes.length);assert.ok(Buffer.from(decodeNativeGeometry(packed,parts,NATIVE_GEOMETRY_DICTIONARY)).equals(bytes));
  const prefixed=Buffer.concat([Buffer.alloc(3),Buffer.from(packed),Buffer.alloc(5)]);
  assert.ok(Buffer.from(decodeNativeGeometry(prefixed.subarray(3,-5),parts,NATIVE_GEOMETRY_DICTIONARY)).equals(bytes),'unaligned input view keeps its byte offset');
  assert.deepEqual(decodeNativeGeometry(encodeNativeGeometry(new Uint8Array(),[],NATIVE_GEOMETRY_DICTIONARY),[],NATIVE_GEOMETRY_DICTIONARY),new ArrayBuffer(0));
});

test('corrupt shared-section headers, spans and references fail before decoding',()=>{
  const {bytes,parts}=specimen(),packed=Buffer.from(encodeNativeGeometry(bytes,parts,NATIVE_GEOMETRY_DICTIONARY));
  const decode=(input,layout=parts)=>decodeNativeGeometry(input,layout,NATIVE_GEOMETRY_DICTIONARY);
  for(const length of [0,11,13,packed.length-1])assert.throws(()=>decode(packed.subarray(0,length)));
  for(const [offset,value]of [[0,0],[4,bytes.length+4],[8,99],[12,1],[48,1],[56,99]]){const corrupt=Buffer.from(packed);corrupt.writeUInt32LE(value,offset);assert.throws(()=>decode(corrupt),'invalid field at '+offset);}
  assert.throws(()=>decode(Buffer.concat([packed,Buffer.from([0])])));
  assert.throws(()=>decode(packed,[{...parts[0],vertexByteOffset:4},parts[1]]));
  assert.throws(()=>decodeNativeGeometry(packed,parts,'unknown'));
  assert.throws(()=>encodeNativeGeometry(bytes,parts,'unknown'));
});
