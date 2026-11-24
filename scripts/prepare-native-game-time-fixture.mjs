// Invoke the unmodified ScriptGlobalTable::get_GameTime on declared clock
// fields in scratch memory. No simulated trajectory supplies expectations.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const bytes=fs.readFileSync('.work/three-review/reference-engine.wasm');
const sha=data=>createHash('sha256').update(data).digest('hex');
const engineSHA256=sha(bytes);
assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const module=new WebAssembly.Module(bytes),imported=WebAssembly.Module.imports(module).filter(item=>item.kind==='function').length;
let at=8,body;
const uint=()=>{let value=0,shift=0,byte;do{byte=bytes[at++];value+=(byte&127)*2**shift;shift+=7;}while(byte&128);return value;};
while(at<bytes.length){
  const section=bytes[at++],size=uint(),end=at+size;
  assert.notEqual(section,8);
  if(section===10)for(let count=uint(),i=0;i<count;i++){
    const length=uint();if(i+imported===1348)body=bytes.subarray(at,at+length);at+=length;
  }
  at=end;
}
assert.equal(body.toString('hex'),'0041a0ffb00428020022004504404183808180780f0b2001200028022836020041000b');
const imports={};
for(const item of WebAssembly.Module.imports(module)){
  assert.equal(item.kind,'function');
  (imports[item.module]??={})[item.name]=()=>{throw Error('Unexpected clock getter import '+item.name);};
}
const n=(await WebAssembly.instantiate(module,imports)).exports,player=64*1024*1024,out=player+1024;
n.memory.grow(Math.ceil((player+65536-n.memory.buffer.byteLength)/65536));
const view=new DataView(n.memory.buffer),getter=n.__indirect_function_table.get(6840);
assert.equal(getter.name,'1348');assert.equal(getter.length,2);
view.setUint32(9191328,player,true);
const cases=[0,1,2,17,3511,9996,65535,86400000,2147483647,2147483648,4294967295].map(milliseconds=>{
  view.setUint32(player+40,milliseconds,true);
  assert.equal(getter(0,out),0);
  return {milliseconds,value:view.getInt32(out,true)};
});
const fixture={engineSHA256,functionIndex:1348,functionSHA256:sha(body),slot:6840,playerGlobal:9191328,millisecondsOffset:40,variantType:3,cases,scope:'Original unmodified compiled getter on explicit uint32 Player clock fields. COM IDL returns LONG. Ordinary gameplay captures separately verify the actual clock phase; these unit cases verify signed representation and millisecond units.'};
fs.writeFileSync('three/tests/fixtures/vpx-game-time-native.json',JSON.stringify(fixture,null,2)+'\n');
console.log(JSON.stringify({cases:cases.length,functionSHA256:fixture.functionSHA256}));
