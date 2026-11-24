// Independent original compiled timer/vector/budget ABI verification.
import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export function nativeTimerDispatchLayout(bytes){
 const sha=data=>createHash('sha256').update(data).digest('hex'),engineSHA256=sha(bytes);assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const imports=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(item=>item.kind==='function').length,bodies=new Map();let at=8;
 const uint=()=>{let value=0,shift=0,byte;do{byte=bytes[at++];value+=(byte&127)*2**shift;shift+=7;}while(byte&128);return value;};
 while(at<bytes.length){const section=bytes[at++],size=uint(),end=at+size;if(section===10){const count=uint();for(let i=0;i<count;i++){const length=uint();if([1132,4487].includes(i+imports))bodies.set(i+imports,bytes.subarray(at,at+length));at+=length;}break;}at=end;}
 const dispatch=bodies.get(1132),physics=bodies.get(4487);assert.equal(dispatch?.length,618);assert.equal(sha(dispatch),'e9f786e6f3c4d37099c580823e4e55a850670dfe236b30b7fc436cac600513df');assert.equal(sha(physics),'13ff9f22eda0c17113c85978850e91f87789c1d70dee611c7377d7f76f34e4e3');
 for(const hex of ['20002802d0af14220120002802d4af14220346','200228020c220641940a2006280200280200110100','20022005360214'])assert.ok(dispatch.includes(Buffer.from(hex,'hex')),hex);
 const budget='200220022802f0044106746a2802fc084188274b0d010b2002410010ec08';assert.ok(physics.includes(Buffer.from(budget,'hex')));
 return{engineSHA256,dispatchFunction:1132,dispatchSHA256:sha(dispatch),physicsFunction:4487,physicsSHA256:sha(physics),playerTimers:333776,handler:12,interval:16,nextFire:20,event:1300,scriptProfileIndex:624,scriptProfileBase:1148,scriptProfileStride:64,scriptBudgetMicroseconds:5000,videoSyncMode:333708,framePacingMode:3,scope:'Original FireTimers active vector, HitTimer fields, event1300 two-i32 virtual call, and original PhysicsEngine script-budget gate; no measured trajectory or seed fitting.'};
}
