import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createScriptRandom} from '../script-random.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-randomize-clock-native.json',import.meta.url)));
const uint=n=>{const bytes=[];do{let byte=n&127;n>>>=7;if(n)byte|=128;bytes.push(byte);}while(n);return bytes;};
const section=(id,bytes)=>[id,...uint(bytes.length),...bytes];
test('default Randomize clock matches the original compiled epoch-clock and DWORD conversion',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const original=Buffer.from(fixture.base64,'base64');assert.equal(createHash('sha256').update(original).digest('hex'),fixture.sha256);
 assert.equal(fixture.sha256,'4265a23e45c59614df69c185f35e0ed0498284567f8986767a7d533796639045');
 // Calls alone are relocated into this isolated module. All native numeric,
 // clock-field, context, seed-fold and store instructions remain unchanged.
 const hex=original.toString('hex');assert.equal(hex.split('10928c01').length,2);assert.equal(hex.split('108f9201').length,2);
 const body=Buffer.from(hex.replace('10928c01','1000').replace('108f9201','1001'),'hex');
 const bytes=new Uint8Array([0,97,115,109,1,0,0,0,
  ...section(1,[2,96,4,127,127,127,127,1,127,96,2,127,127,1,127]),
  ...section(2,[2,1,101,1,118,0,0,1,101,1,116,0,1]),
  ...section(3,[1,0]),...section(5,[1,0,2]),
  ...section(6,[1,127,1,65,128,128,4,11]),
  ...section(7,[2,1,102,0,2,1,109,2,0]),...section(10,[1,...uint(body.length),...body])]);
 let milliseconds,view;
 const instance=new WebAssembly.Instance(new WebAssembly.Module(bytes),{e:{v:()=>{throw Error('Unexpected native argument conversion');},t:(clock,pointer)=>{assert.equal(clock,0);view.setBigInt64(pointer,BigInt(Math.floor(milliseconds/1000)),true);view.setBigInt64(pointer+8,BigInt(milliseconds%1000)*1000000n,true);return 0;}}});
 view=new DataView(instance.exports.m.buffer);view.setUint32(1024+16,2048,true);view.setUint32(2048+28,3072,true);
 const realDateNow=Date.now;
 try{
  Date.now=()=>milliseconds;
  const random=createScriptRandom();
  for(const value of [0,123456,4294967295,4294967296,1795506633759,1795506633999,1800000000000]){
   milliseconds=value;const before=random.getState();view.setUint32(3072+76,before,true);
   assert.equal(instance.exports.f(1024,0,0,0),0);random.randomize();
   assert.equal(random.getState(),view.getUint32(3072+76,true),'original native clock/seed at '+value);
   assert.equal(random.getState()&255,before&255);random.rnd();
  }
 }finally{Date.now=realDateNow;}
});
