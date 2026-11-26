import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync}from'node:zlib';import {createHash}from'node:crypto';
import {createFullGame}from'../full-game.js';import {nativeBallHit,collideNativeBalls}from'../native-ball-collision.js';import {nativeMeshQuery}from'../native-mesh-contact.js';
import {ballParameterScenarios}from'../../scripts/ball-parameter-scenarios.mjs';import {nativeSourceAssets}from'../../scripts/native-source-assets.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),f=Math.fround;

test('native ball creation, setters, inertia and both collision directions retain all 96 original parameter cases',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-ball-parameters-native.json.gz',import.meta.url));assert.equal(sha(bytes),'b28fb3a9161855edc478374ff13d1d5dbafa910f107cea78e1cc3f95b88d663e');
 const observed=JSON.parse(gunzipSync(bytes)),cases=ballParameterScenarios();assert.deepEqual(observed.scenarios,cases);
 assert.equal(observed.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(observed.reference.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(observed.reference.sourceSha256,observed.reference.controlledSha256);assert.deepEqual(observed.reference.controlledOverrides,{});
 assert.equal(observed.probeSHA256,sha(fs.readFileSync(new URL('../../scripts/probe-native-ball-parameters.mjs',import.meta.url))));assert.equal(observed.scenarioSHA256,sha(fs.readFileSync(new URL('../../scripts/ball-parameter-scenarios.mjs',import.meta.url))));
 assert.deepEqual(observed.errors,[]);assert.equal(observed.observerMemoryWrites,0);assert.equal(observed.rows.length,96);assert.equal(observed.initial.ms,observed.after.ms);assert.equal(observed.after.balls.length,observed.initial.balls.length+192);
 for(const ball of observed.initial.balls)assert.deepEqual(observed.after.balls.find(b=>b.id===ball.id),ball);
 const assets=nativeSourceAssets(observed.reference.sourceSha256),game=await createFullGame(assets.json('layout.json'),assets.json('objects.json'),assets.text('rules.vbs'),()=>{});
 const names=['RefPortParamA','RefPortParamB'];let hitsChecked=0,stagesChecked=0;
 const read=name=>game.rules.value(name),states=balls=>balls.map(b=>{const s=b.snapshot();return{p:Object.values(s.p),v:Object.values(s.v)};});
 try{
  game.rules.execute('Dim '+names.join(','));
  for(const [index,scenario]of cases.entries()){
   const row=observed.rows[index];assert.equal(row.index,index);assert.deepEqual(row.types,[4,4,4,4]);
   const previous=new Set(game.physicalRecords);
   for(const [i,b]of scenario.balls.entries()){
    const args=b.method==='CreateBall'?'':'('+[b.createRadius??b.radius,...b.method==='CreateSizedBallWithMass'?[b.createMass??b.mass]:[]].join(',')+')';
    game.rules.execute('Set '+names[i]+'=HellHouse.'+b.method+args+':HellHouse.Kick 0,0');
    const created=row.creation[i];assert.equal(read(names[i]+'.Radius'),created.radius,'creation radius case '+index);assert.equal(read(names[i]+'.Mass'),created.mass,'creation mass case '+index);
    for(const [j,axis]of ['X','Y','Z'].entries()){assert.equal(read(names[i]+'.'+axis),created.p[j]);assert.equal(read(names[i]+'.Vel'+axis),created.v[j]);}
   }
   const records=game.physicalRecords.filter(r=>!previous.has(r));assert.equal(records.length,2);
   game.rules.execute(scenario.balls.flatMap((b,i)=>['Radius='+b.radius,'Mass='+b.mass,...['X','Y','Z'].map((axis,j)=>axis+'='+b.p[j]),...['VelX','VelY','VelZ'].map((axis,j)=>axis+'='+b.v[j]),...['AngMomX','AngMomY','AngMomZ'].map((axis,j)=>axis+'='+b.momentum[j])].map(s=>names[i]+'.'+s)).join(':'));
   const native=records.map(r=>game.nativeBall(r.body));
   for(const [i,b]of scenario.balls.entries()){
    assert.equal(read(names[i]+'.Radius'),row.inputs[i].radius);assert.equal(read(names[i]+'.Mass'),row.inputs[i].mass);assert.equal(native[i].body.mass(),row.inputs[i].mass);
    assert.equal(records[i].radius,b.radius*.01);assert.equal(records[i].collider.radius(),f(b.radius*.01));
    for(const [j,axis]of ['X','Y','Z'].entries())assert.equal(read(names[i]+'.AngVel'+axis),f(row.angular[i*3+j]),'original inertia arithmetic case '+index);
   }
   const hits=native.map((b,i)=>{const other=native[1-i],v=other.body.linvel(),query=nativeMeshQuery(b.body.translation(),b.body.linvel(),records[i].radius,scenario.duration*.01);return nativeBallHit(query,{p:other.sync(),v:{x:v.x,y:-v.y,z:v.z}},records[1-i].radius,scenario.duration*.01);});
   for(const [i,h]of hits.entries()){
    const expected=row.queries[i];assert.equal(h?f(h.time*100):-1,expected.time,'original hit time case '+index);
    if(h){assert.equal(f(h.gap*100),expected.gap);assert.deepEqual([h.normal.x,-h.normal.y,h.normal.z],expected.normal);hitsChecked++;}
   }
   if(!hits.every(Boolean)){assert.deepEqual(row.stages,[]);continue;}
   const dt=f(hits[0].time*100);
   game.rules.execute(scenario.balls.flatMap((b,i)=>['X','Y','Z'].map((axis,j)=>names[i]+'.'+axis+'='+f(b.p[j]+f(b.v[j]*dt)))).join(':'));
   // The original component's relative addresses are declared environment
   // inputs to these isolated calls. Production ball ordering is untouched.
   const balls=native.map((b,i)=>({order:row.addresses.filter(address=>address<row.addresses[i]).length,collisionGap:f(hits[i].gap*100),snapshot:()=>b.snapshot(),commit:s=>b.commit(s)}));
   assert.deepEqual(states(balls),row.stages[0]);
   for(let i=0;i<2;i++){collideNativeBalls(balls[i],balls[1-i],hits[i],false,row.swapped,()=>{});assert.deepEqual(states(balls),row.stages[i+1],'original collision stage case '+index);stagesChecked++;}
  }
  assert.equal(hitsChecked,162);assert.equal(stagesChecked,162);
  // Native Radius/Mass setters only replace those fields. Reconfigure the
  // final pair without assigning momentum, then compare with the separately
  // observed native 12.5-radius/.5-mass angular getters for that momentum.
  for(const name of names){
   const momentum=['X','Y','Z'].map(axis=>read(name+'.AngMom'+axis));
   game.rules.execute(name+'.Radius=12.5:'+name+'.Mass=0.5');
   for(const [i,axis]of ['X','Y','Z'].entries()){
    assert.equal(read(name+'.AngMom'+axis),momentum[i]);
    assert.equal(read(name+'.AngVel'+axis),f(observed.rows[0].angular[i]));
   }
  }
 }finally{game.dispose();}
});
