import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';import{Gate}from '../gate.js';import{Spinner}from '../spinner.js';

test('gate/spinner coasting and gate stop/open branches retain independently compiled native velocity bits',()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-mover-velocity-native.json.gz',import.meta.url)))),view=new DataView(new ArrayBuffer(4)),number=word=>{view.setUint32(0,word,true);return view.getFloat32(0,true);},bits=value=>{view.setFloat32(0,value,true);return view.getUint32(0,true);};
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.functions,{gate:{index:4418,slot:7238},spinner:{index:4422,slot:7241}});
 assert.deepEqual(fixture.functionSHA256,{'4418':'3379ecf34e1ad3630bf53f84f0b4c9f6f38e47b2397bb6bc1c73153da782a868','4422':'973d2cdf6e0f75b3f9e402e19440b82368d7a415cf00bc91f53e667760a39bfe'});
 assert.equal(fixture.cases.length,53018);
 for(const [kind,a,s,d,min,g,open,nextA,nextS]of fixture.cases){const actual={angle:number(a),speed:number(s),damping:number(d),min:number(min),open:!!open,spec:{gravity_factor:number(g)}};
  (kind===0?Gate:Spinner).prototype.updateVelocity.call(actual);assert.equal(bits(actual.angle),nextA,'native mover angle');assert.equal(bits(actual.speed),nextS,'native mover velocity');
 }
});
