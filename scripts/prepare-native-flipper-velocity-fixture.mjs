import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {nativeFlipperVelocity} from './native-flipper-velocity-compiled-harness.mjs';

const output=process.argv[2];assert.ok(output,'Supply a new fixture path');assert.equal(fs.existsSync(output),false,'Preserve existing reference observations');
const oracle=await nativeFlipperVelocity(),f=Math.fround,cases=[];
const inertia=f(f(f(1/3)*f(1))*f(f(114.7)*f(114.7)));
function record(side,pressed,strength,eos,angle,speed){
  const start=side==='left'?120:240,end=side==='left'?68:292;
  const input={side,start,end,rest:f(start*f(Math.PI/180)),raised:f(end*f(Math.PI/180)),angle,speed,momentum:f(speed*inertia),inertia,strength,returnStrength:.04,eos,eosAngle:10,pressed};
  cases.push({input,expected:oracle.update(input)});
}
for(const side of ['left','right'])for(const pressed of [false,true])for(const strength of [720,3600])for(const eos of [.3,.6]){
  const start=side==='left'?120:240,end=side==='left'?68:292,rest=f(start*f(Math.PI/180)),raised=f(end*f(Math.PI/180));
  for(const endpoint of [rest,raised])for(const distance of [0,.009999,.01,.010001,-.009999,-.01,-.010001])for(const speed of [0,f(.01),-f(.01),f(.010000001),-f(.010000001),f(.009999999),-f(.009999999)])record(side,pressed,strength,eos,f(endpoint+f(distance)),speed);
}
let seed=0x2671125;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<10000;i++){
  const side=i%2?'left':'right',start=side==='left'?120:240,end=side==='left'?68:292,rest=f(start*f(Math.PI/180)),raised=f(end*f(Math.PI/180));
  record(side,!!(i&2),i&4?720:3600,i&8?.3:.6,f(rest+(raised-rest)*random()),f((random()-.5)*.5));
}
const fixture={format:'native-flipper-velocity-v1',engineSHA256:oracle.engineSHA256,functionIndex:oracle.index,functionSHA256:oracle.functionSHA256,upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',scope:'Unchanged original FlipperMoverObject::UpdateVelocities with only an export added. Explicit scratch states cover both authored flippers, source SOS/full strength, hold torque, pressed/released, inclusive stop boundaries and deterministic generated angles/speeds. Source coil ramp-up is zero. This is component coverage, not a clean full-game trajectory. JSON scalar outputs treat signed zero as numerical zero.',cases};
const bytes=gzipSync(JSON.stringify(fixture),{level:9,mtime:0});fs.writeFileSync(output,bytes,{flag:'wx'});console.log(JSON.stringify({output,cases:cases.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
