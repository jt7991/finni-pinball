import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {NativeBall} from '../native-ball.js';
import {NativeAngular} from '../native-angular.js';
import {collideNativeFlipper} from '../native-flipper-contact.js';

const f=Math.fround,copy=v=>({x:f(v.x),y:f(v.y),z:f(v.z)});
function collide(input){
  // Rapier's public vectors are Float32, while NativeBall preserves native
  // positions/momenta between publications. Exercise those production classes.
  let position={x:0,y:0,z:0},velocity={x:input.velocity.x,y:-input.velocity.y,z:input.velocity.z},angular={x:0,y:0,z:0};
  const body={translation:()=>({...position}),setTranslation:p=>{position=copy(p);},linvel:()=>({...velocity}),setLinvel:v=>{velocity=copy(v);},angvel:()=>({...angular}),setAngvel:w=>{angular=copy(w);},mass:()=>1};
  const native=new NativeBall(body);native.position={...input.position};native.publish();
  for(const axis of ['x','y','z'])native.setAngularMomentum(axis,input.momentum[axis]);
  const motion=new NativeAngular({setAngvel:()=>{}},input.inertia);motion.momentum=-input.flipperMomentum;motion.speed=-input.flipperSpeed;
  const flipper={p:{x:input.center.x*.01,y:(2115-input.center.y)*.01},nativeMotion:motion,contactTorque:input.inContact?-input.contactTorque:0};
  collideNativeFlipper(native.body,flipper,{normal:{x:input.normal.x,y:-input.normal.y,z:input.normal.z},gap:input.gap*.01,hitMomentBit:input.hitMomentBit},input.material,.25,0);
  const ball=native.snapshot();return {position:ball.p,velocity:ball.v,momentum:ball.m,flipperMomentum:-motion.momentum,flipperSpeed:-motion.speed};
}
test('native flipper collisions cross stop force, direction and face independently',()=>{
  const bytes=fs.readFileSync(new URL('./fixtures/vpx-native-flipper-collision.json.gz',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'ab99cc8600fa287d92694c263d3b7f4d3c0f0e0efa356ad1e41e2037b00b9f07');
  const fixture=JSON.parse(gunzipSync(bytes));
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.functionSHA256,'8ec4314512b0d276be9b96b9dbf9e90b144f3e792a0103f718863c362112c7f5');
  assert.equal(fixture.cases.length,5760);
  const differences=[],groups=new Map();let resolved=0,moving=0;
  for(const [index,{input,expected}]of fixture.cases.entries()){
    const actual=collide(input);
    if(input.inContact){const key=input.side+':'+input.contactTorque;groups.set(key,(groups.get(key)??0)+1);}else moving++;
    for(const key of ['position','velocity','momentum'])for(const axis of ['x','y','z'])if(actual[key][axis]!==expected[key][axis])differences.push({index,key:key+'.'+axis,actual:actual[key][axis],expected:expected[key][axis]});
    for(const key of ['flipperMomentum','flipperSpeed'])if(actual[key]!==expected[key])differences.push({index,key,actual:actual[key],expected:expected[key]});
    if(['x','y','z'].some(axis=>expected.velocity[axis]!==input.velocity[axis]))resolved++;
  }
  assert.ok(resolved>3000,'approaching as well as receding collisions exercised');
  assert.equal(moving,640);
  for(const side of ['LeftFlipper','RightFlipper'])for(const magnitude of [144,432,720,2160,3600])for(const sign of [-1,1])assert.equal(groups.get(side+':'+sign*magnitude),256);
  assert.equal(differences.length,0,JSON.stringify(differences.slice(0,10)));
  console.log(JSON.stringify({cases:fixture.cases.length,resolved,fixtureSHA256:createHash('sha256').update(bytes).digest('hex')}));
});
