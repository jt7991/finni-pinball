import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeTextureAuditObserver} from '../../scripts/native-texture-audit-observer.mjs';

test('read-only native image observation accepts short names with nonzero spare string bytes and retains long names',async()=>{
  const globals=['window','WebGL2RenderingContext'],previous=Object.fromEntries(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const instantiate=WebAssembly.instantiate,streaming=WebAssembly.instantiateStreaming;
  try{
    const memory=new WebAssembly.Memory({initial:2}),table=new WebAssembly.Table({element:'externref',initial:2});
    const getter=()=>{};Object.defineProperty(getter,'name',{value:'4790'});table.set(1,getter);
    const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),vtable=65552;
    view.setUint32(vtable+8,1,true);
    const expected=[];
    for(const [index,name]of ['pf','Spotflash','long_image_name'].entries()){
      const object=1024+index*64,encoded=new TextEncoder().encode(name),address=encoded.length<11?object+4:8192;
      view.setUint32(object,vtable,true);bytes.set(encoded,address);bytes[address+encoded.length]=0;
      if(encoded.length<11){bytes[object+15]=encoded.length;bytes[address+encoded.length+1]=0xa7;}
      else{view.setUint32(object+4,address,true);view.setUint32(object+8,encoded.length,true);bytes[object+15]=128;}
      const pinBinary=5000+index*16,width=256,height=64,liveHash=BigInt(object)^BigInt(pinBinary)^(BigInt(width)<<16n)^(BigInt(height)<<32n);
      view.setUint32(object+20,width,true);view.setUint32(object+24,height,true);view.setUint32(object+28,pinBinary,true);view.setBigUint64(object+32,liveHash,true);
      expected.push({name,object,pinBinary,width,height,liveHash:String(liveHash),getter:4790});
    }
    // A matching string without a native image vtable must not become an object.
    bytes.set(new TextEncoder().encode('pf\0'),9000);
    Object.assign(globalThis,{window:{},WebGL2RenderingContext:class{bindTexture(){}texSubImage2D(){}}});
    installNativeTextureAuditObserver();
    await WebAssembly.instantiate(new Uint8Array([0,97,115,109,1,0,0,0]),{fixture:{memory,table}});
    window.nativeTextureAudit.names=expected.map(row=>row.name);window.nativeTextureAudit.getterFunctions=[4790];
    const actual=window.nativeTextureAudit.inspectTextureHashes();
    assert.deepEqual(actual.sort((a,b)=>a.object-b.object),expected);
    assert.equal(bytes[1031],0xa7,'observation leaves spare source bytes untouched');
  }finally{
    WebAssembly.instantiate=instantiate;WebAssembly.instantiateStreaming=streaming;
    for(const name of globals){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}
  }
});
