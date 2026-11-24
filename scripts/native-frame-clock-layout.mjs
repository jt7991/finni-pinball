// Verify the compiled Player::PrepareFrame assignment, independently of any
// simulated state or timing outcome. The source header places these two uint32
// clocks directly after m_time_sec (whose wasm32 offset32 is already pinned).
import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
export function nativeFrameClockLayout(bytes){
 const sha=data=>createHash('sha256').update(data).digest('hex'),engineSHA256=sha(bytes);
 assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const imports=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(item=>item.kind==='function').length;
 let at=8,body,indexGetter;const uint=()=>{let value=0,shift=0,byte;do{byte=bytes[at++];value+=(byte&127)*2**shift;shift+=7;}while(byte&128);return value;};
 while(at<bytes.length){const section=bytes[at++],size=uint(),end=at+size;if(section===10){const count=uint();for(let i=0;i<count;i++){const length=uint();if(i+imports===1123)body=bytes.subarray(at,at+length);if(i+imports===1347)indexGetter=bytes.subarray(at,at+length);at+=length;}break;}at=end;}
 assert.ok(body);assert.equal(body.length,26585);const functionSHA256=sha(body);assert.equal(functionSHA256,'e7dbad2ee8e355ec8d9a9b097e08bf42201cfe3a5e6ea78d82690937d8658173');
 // Save prior frame clock@44, read current clock@40 and store it back@44.
 const assignment='200028022c210520002000280228220736022c20052007460d00',offset=body.indexOf(Buffer.from(assignment,'hex'));assert.ok(offset>=0);assert.equal(body.indexOf(Buffer.from(assignment,'hex'),offset+1),-1);
 assert.equal(sha(indexGetter),'4ef4fbc3ce44d7e6e327504e5329ee64bc7011d0a69d20bb07e2f23eeb35be90');
 assert.equal(indexGetter.toString('hex'),'0041a0ffb00428020022004504404183808180780f0b200120002802b0b71436020041000b');
 return{engineSHA256,functionIndex:1123,functionSHA256,functionBytes:body.length,assignment,assignmentOffset:offset,playerGlobal:9191328,currentMilliseconds:40,lastAnimationMilliseconds:44,frameIndex:334768,frameIndexGetter:{functionIndex:1347,functionSHA256:sha(indexGetter),functionBytes:indexGetter.length},scope:'Pinned original compiled PrepareFrame clock assignment, adjacent typed source fields and original FrameIndex getter. No pose, clock or numeric outcome fitting.'};
}
