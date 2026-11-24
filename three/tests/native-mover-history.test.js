import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{unpackNativeHistoryState}from '../../scripts/native-history-state-package.mjs';import{compareNativeHistoryState}from '../../scripts/compare-native-history-state.mjs';

test('ordinary native gameplay retains every gate/spinner motion field alongside all bodies, flippers and UI polls',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-mover-coasting-native.json.gz',import.meta.url))));assert.equal(packet.sourceSHA256,'da81d4a2fd8f593bdf98c831de59159ea340fcea5a347f1c0842f8793a5c0886');
 const fixture=unpackNativeHistoryState(packet),names=['Gate001','Gate002','Gate3','Gate4','Spinner001','Spinner002'];
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.moverMotion.errors,[]);
 assert.deepEqual(fixture.moverMotion.resources.map(r=>r.name),names);
 for(const r of fixture.moverMotion.resources){assert.equal(r.nameOffset,132);assert.equal(r.nameWidth,1);assert.equal(r.nameIndirect,true);assert.equal(r.moverOffset,r.kind==='gate'?64:256);}
 assert.equal(fixture.frames.length,1760);assert.ok(fixture.frames.every(frame=>frame.snapshot.movers.length===6));
 for(const name of ['Gate3','Gate4','Spinner001','Spinner002'])assert.ok(fixture.startup.boundaries.filter(row=>row.movers.some(m=>m.name===name&&m.speed!==0)).length>1000,name+' actually moves during the independent recording');
 const result=await compareNativeHistoryState(fixture);
 assert.deepEqual(result,{framesChecked:1760,intervalsChecked:30007,ticks:30007,randomizeClockSamples:2,timerClockSamples:11,moverStatesChecked:201162,moverFieldsChecked:1542242});
});
