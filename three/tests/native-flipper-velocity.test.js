import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Pinball} from '../physics.js';
import {NativeAngular} from '../native-angular.js';

test('production flipper drive matches original VPX stop boundaries and velocity updates for both flippers',()=>{
  const bytes=fs.readFileSync(new URL('fixtures/vpx-native-flipper-velocity.json.gz',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'233f9dc8c9a16b6b98633fa2b2e8c95a57050a2351933369ac45ad4042f69ebe');
  const fixture=JSON.parse(gunzipSync(bytes)),f=Math.fround;
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.functionIndex,4463);assert.equal(fixture.functionSHA256,'15295c3d687dc67673a1fa86e8c3644937b478c7d0df2a93a1d509c076b5c80f');assert.equal(fixture.cases.length,11568);
  let stops=0;
  for(const [index,{input,expected}]of fixture.cases.entries()){
    // The body facade retains Rapier's Float32 angular-velocity publication.
    // All dynamics and stop decisions run through the production method.
    let z=f(-input.speed*100);
    const body={angvel:()=>({z}),setAngvel:value=>{z=f(value.z);},resetTorques(){},setRotation(){}};
    const motion=new NativeAngular(body,input.inertia);motion.momentum=-input.momentum;motion.speed=-input.speed;
    const flipper={side:input.side,rest:Math.PI/2-input.start*Math.PI/180,raised:Math.PI/2-input.end*Math.PI/180,angle:Math.PI/2-input.angle,nativeRestAngle:input.rest,nativeRaisedAngle:input.raised,nativeAngle:input.angle,inertia:input.inertia*.0001,strength:input.strength,returnStrength:input.returnStrength,body,nativeMotion:motion};
    Pinball.prototype.driveFlippers.call({flippers:[flipper],held:{[input.side]:input.pressed},state:'playing',tilted:false,rules:{objects:new Map([[input.side+'flipper',{strength:input.strength,eostorque:input.eos,eostorqueangle:input.eosAngle}]])}});
    const actual={angle:flipper.nativeAngle,momentum:-motion.momentum,speed:-motion.speed,acceleration:f(-flipper.angularAcceleration*.0001),contactTorque:-flipper.contactTorque,contact:!!flipper.contactTorque};
    for(const field of Object.keys(actual))assert.ok(actual[field]===expected[field],`case ${index} ${input.side} ${field}: ${actual[field]} != ${expected[field]}`);
    if(actual.contact){stops++;assert.equal(z,0);}
  }
  assert.ok(stops>300,'Both velocity and angular stop thresholds are exercised');
});
