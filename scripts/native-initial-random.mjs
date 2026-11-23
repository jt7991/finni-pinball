// Read the original compiled data initializer, independently of trajectories.
import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export function nativeInitialRandom(bytes){
 const engineSHA256=createHash('sha256').update(bytes).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 let p=8;const address=7661264,matches=[];
 const u=()=>{let n=0,s=0,b;do{b=bytes[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
 const signed=()=>{let n=0,s=0,b;do{b=bytes[p++];n|=(b&127)<<s;s+=7;}while(b&128);return b&64?n|(-1<<s):n;};
 while(p<bytes.length){const kind=bytes[p++],length=u(),end=p+length;
  if(kind===11)for(let count=u(),segment=0;segment<count;segment++){
   const mode=u();assert.ok(mode===0||mode===1||mode===2);let memoryOffset;
   if(mode!==1){if(mode===2)assert.equal(u(),0);assert.equal(bytes[p++],65);memoryOffset=signed();assert.equal(bytes[p++],11);}
   const size=u();if(memoryOffset!==undefined&&address>=memoryOffset&&address+8<=memoryOffset+size){const byteOffset=p+address-memoryOffset;matches.push({engineSHA256,address,segment,memoryOffset,segmentBytes:size,byteOffset,bytes:bytes.subarray(byteOffset,byteOffset+8).toString('hex'),words:[bytes.readUInt32LE(byteOffset),bytes.readUInt32LE(byteOffset+4)]});}p+=size;
  }
  p=end;
 }
 assert.equal(matches.length,1,'Unique active original MWC64X initializer');return matches[0];
}
