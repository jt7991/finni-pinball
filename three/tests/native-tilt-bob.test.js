import test from 'node:test';import assert from 'node:assert/strict';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';import {CabinetNudge} from '../cabinet-nudge.js';import {TiltBob} from '../tilt-bob.js';
const fixture=readReferenceFixture(new URL('fixtures/vpx-tilt-bob-native.json.gz',import.meta.url));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
for(const c of fixture.cases)test(`native tilt pendulum ${c.angle} matches every public Float32 reading and mechanical key transition`,()=>{
 let ms=0;const keys=[],cabinet=new CabinetNudge(),bob=new TiltBob(down=>keys.push([ms,Number(down)]));cabinet.nudge(c.angle,c.force);assert.equal(c.rows.length,1501);
 for(const row of c.rows){ms=row[0];assert.deepEqual([bob.position.x,bob.position.y,bob.percent].map(v=>v===0?0:v),row.slice(1).map(v=>Math.fround(v)||0),`native public NudgeTiltStatus at ${ms}ms`);if(ms){cabinet.step(Math.PI/30);bob.step(cabinet.acceleration);}}
 assert.deepEqual(keys,c.keys.map(row=>row.slice(0,2)),'actual native mechanical down/up clocks');if(c.angle===0)assert.deepEqual(keys,[[130,1],[131,0]]);else assert.deepEqual(keys,[]);
});
