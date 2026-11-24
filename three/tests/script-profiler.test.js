import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{ScriptProfiler,NATIVE_SCRIPT_BUDGET_MICROSECONDS,nativeScriptMicroseconds}from '../script-profiler.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-script-clock-native.json',import.meta.url)));
const leb=value=>{const bytes=[];do{let byte=value&127;value>>>=7;if(value)byte|=128;bytes.push(byte);}while(value);return bytes;},string=value=>[...leb(value.length),...new TextEncoder().encode(value)],section=(id,bytes)=>[id,...leb(bytes.length),...bytes];
test('the original compiled fallback clock has Date.now millisecond precision',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.clockImport.name,'emscripten_date_now');const record=fixture.bodies.find(body=>body.index===18717),body=Buffer.from(record.base64,'base64');assert.equal(createHash('sha256').update(body).digest('hex'),'f4dac89613b39368b9c01f9e5fdba120fd58f54b64f7c78f90479263cb32cc08');
 // Keep the original call344/body bytes. Unused import slots also bind the
 // clock signature; only344 is called. Scratch memory belongs to this module.
 const imports=[...leb(345)];for(let i=0;i<345;i++)imports.push(...string('env'),...string('dateNow'),0,0);
 const bytes=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[2,96,0,1,124,96,1,127,0]),...section(2,imports),...section(3,[1,1]),...section(5,[1,0,1]),...section(7,[2,...string('memory'),2,0,...string('sample'),0,...leb(345)]),...section(10,[1,...leb(body.length),...body])]);assert.equal(WebAssembly.validate(bytes),true);
 let milliseconds=0;const native=new WebAssembly.Instance(new WebAssembly.Module(bytes),{env:{dateNow:()=>milliseconds}}).exports,view=new DataView(native.memory.buffer);
 for(milliseconds of [0,1,999,1000,1001,1760000000123]){native.sample(0);const actual=view.getBigInt64(0,true)*1000000n+BigInt(view.getInt32(8,true));assert.equal(actual,BigInt(milliseconds)*1000n);}
 const before=Date.now(),sample=nativeScriptMicroseconds(),after=Date.now();assert.ok(sample>=before*1000&&sample<=after*1000);assert.equal(sample%1000,0);
});
test('native script-budget threshold, frame reset and frame-pacing exemption use original boundary rules',()=>{
 let now=0;const p=new ScriptProfiler({clock:()=>now});assert.equal(NATIVE_SCRIPT_BUDGET_MICROSECONDS,5000);
 p.measure(()=>{now=5000;});assert.equal(p.timersAllowed,true);p.measure(()=>{now=6000;});assert.equal(p.microseconds,6000);assert.equal(p.timersAllowed,false);
 p.beginFrame();assert.equal(p.microseconds,0);assert.equal(p.timersAllowed,true);
 const exempt=new ScriptProfiler({videoSyncMode:3,clock:()=>now});exempt.measure(()=>{now+=6000;});assert.equal(exempt.timersAllowed,true);
});
test('nested script sections count elapsed time once and unwind thrown callbacks',()=>{
 let now=0;const p=new ScriptProfiler({clock:()=>now});p.measure(()=>{now=2000;p.measure(()=>{now=3000;});now=5000;});assert.equal(p.microseconds,5000);assert.equal(p.stack.length,0);
 assert.throws(()=>p.measure(()=>{now=6000;throw Error('handler');}),/handler/);assert.equal(p.microseconds,6000);assert.equal(p.stack.length,0);p.beginFrame();assert.equal(p.timersAllowed,true);
});
test('the native unsigned counter retains a backward clock change until a new frame',()=>{
 let now=10000;const p=new ScriptProfiler({clock:()=>now});p.measure(()=>{now=9000;});assert.equal(p.microseconds,4294966296);assert.equal(p.timersAllowed,false);p.beginFrame();assert.equal(p.microseconds,0);
});
