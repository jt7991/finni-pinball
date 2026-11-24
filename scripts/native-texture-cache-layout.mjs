// Independently pin Texture::GetLiveHash before interpreting native objects.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function nativeTextureCacheLayout(bytes){
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),engineSHA256=sha(bytes);assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const imports=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(item=>item.kind==='function').length;let at=8;const functions=[],originalBody='0020002903200b';
 const uint=()=>{let value=0,shift=0,byte;do{byte=bytes[at++];value+=(byte&127)*2**shift;shift+=7;}while(byte&128);return value;};
 while(at<bytes.length){const kind=bytes[at++],size=uint(),end=at+size;if(kind===10){for(let count=uint(),i=0;i<count;i++){const size=uint();if(bytes.subarray(at,at+size).toString('hex')===originalBody)functions.push(i+imports);at+=size;}break;}at=end;}
 assert.deepEqual(functions,[4790]);return{engineSHA256,indices:functions,originalBody,bodySHA256:sha(Buffer.from(originalBody,'hex')),texture:{name:4,width:20,height:24,pinBinary:28,liveHash:32},scope:'Original getter4790 reads the uint64 at Texture+32. Objects are discovered by their original names and this independently verified virtual getter; no resource contents or identities are set.'};
}
