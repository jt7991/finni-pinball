import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {createFullGame} from '../full-game.js';
import {STEP,createGame} from '../physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall} from '../../scripts/reference-physics.mjs';
const root=new URL('../../',import.meta.url);
const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));
test('production flipper trajectory matches captured native VPX samples within .01 degrees',()=>{
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-physics.mjs','--check'],{cwd:root,encoding:'utf8'}));
  assert.ok(report.maxFlipperAngleError<.01);
  assert.equal(report.samples.length,48);
});
test('physics materials retain the actual VPX rubber and metal overrides',()=>{
  const layout=json('layout');
  const peg=layout.items.find(i=>i.name==='rpeg003');
  assert.equal(peg.elasticity,.3);assert.equal(peg.contact_physics.elasticity,.9);assert.equal(peg.contact_physics.friction,.9);
});

test('physical plunger follows six native pull/release recordings and initial launch energies',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs','--check','--json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(reports.length,6);assert.ok(reports[0].maxModelSpeed<.1);assert.ok(reports.at(-1).maxModelSpeed>65);
});

// The ten spinner cases now run in native-spinner-original-controls.test.js.
// All 1,560 public observations, original controls/shot inputs, overhead misses
// and nine-rotation fast shots remain checked, with complete native initial
// state and zero-error body/RNG/rod gates. The partial vpx-spinners.json and
// its CLI comparison remain available unchanged as historical diagnostics.

test('twenty native gate recordings verify blocking, pass-through, open/close motion and overhead misses',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-gates.mjs','--check','--json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(reports.length,20);assert.equal(reports.reduce((n,r)=>n+r.samples.length,0),2400);
  assert.equal(reports.filter(r=>r.name.endsWith('-overhead')).length,4);
  assert.equal(reports.filter(r=>r.name.endsWith('-open-close')).length,4);
});

// All four switch scenarios now run in native-mechanism-clock-replay.test.js.
// Their original declared inputs, 40 samples each and isolation controls are
// required unchanged, with complete independent body/RNG/Timer/frame inputs
// and stricter zero-error internal gates. The original vpx-triggers.json data
// and its comparison CLI remain available as a partial-state diagnostic.

test('native shooter switch exits preserve the first 184ms of the independently recorded feed',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-shooter-feed.json','--report=.work/three-review/vpx-shooter-feed-comparison.json','--json'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
  assert.equal(reports.length,1);const initial=reports[0].samples.filter(s=>s.expected[0]<=184);assert.ok(initial.length>=10);
  for(const s of initial){assert.ok(s.positionError<.001,'native switch exit displacement at '+s.expected[0]);assert.ok(s.velocityError<.00001,'native initial feed velocity at '+s.expected[0]);}
  assert.equal(reports[0].physicsStats.substepBudgetExceeded,0);
  // Preserve the entire later path in the diagnostic report. This initial-feed
  // check does not certify the subsequent curved-guide trajectory.
});

test('native shooter guide retains the first two wall impacts with VPX default material physics',()=>{
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-shooter.mjs','--check'],{cwd:root,encoding:'utf8'}));
  assert.equal(report.checkedThrough,396);
  // Later contacts remain in the same report; this gate covers the measured
  // feed and first two guide impacts, not the entire subsequent curved path.
  assert.ok(report.checked.velocityError<.00001);
});

test('native target recordings preserve corner misses, completion scores and the full timed hold/release',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-targets.mjs','--check','--json'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
  assert.equal(reports.length,3);
  assert.equal(reports.find(r=>r.name==='Target010-front-corner').score,0);
  assert.equal(reports.find(r=>r.name==='Target010-front-face').score,2000);
  const hold=reports.find(r=>r.name==='Target011-timed-hold');assert.equal(hold.score,3000);
  assert.ok(hold.samples.some(s=>s.ms>=7900&&s.ms<8000));
  for(const s of hold.samples.filter(s=>s.ms<8000)){assert.deepEqual(s.dropped,[0,0,0]);assert.ok(s.positionError<.1,'native held-ball position');}
  assert.deepEqual(hold.samples.at(-1).dropped,[1,1,1]);assert.ok(hold.maxPositionError<2,'native release path');
});

test('millisecond native trace verifies timer phase and the coupled floor/flipper heel impacts',()=>{
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-heel.mjs','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(report.samples.length,70);assert.equal(report.firstDivergence,undefined);
  const full=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-heel-milliseconds.json','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(full.length,1);
});

test('cabinet nudges match three independently started native directional recordings',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-nudge.mjs','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,3);
});

test('a settled target/wire pocket responds to the native nudge without an invented rescue',()=>{
  // The native engine randomizes contact order, so the phase of later rebounds
  // is not a deterministic force calibration. Keep the complete error report;
  // this check covers excursion and settling. The flat directional recordings
  // above remain the strict force/trajectory gate.
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-nudge.mjs','three/tests/fixtures/vpx-pocket-nudge.json','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,1);
  const end=reports[0].samples.at(-1);
  assert.ok(Math.hypot(end.actual[1]-612.3,end.actual[2]-803.1)<.1,'same native trapped position after oscillation');
  const excursion=field=>Math.max(...reports[0].samples.map(s=>Math.hypot(s[field][1]-612.3,s[field][2]-803.1)));
  assert.ok(Math.abs(excursion('actual')-excursion('expected'))<1,'small physical nudge, without a rescue impulse');
  assert.equal(reports[0].physicsStats.substepBudgetExceeded,0);
});

test('native cabinet and primitive impacts match independent controlled geometry recordings',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-geometry.json','--json'],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
  const limits={'cabinet-top':[.01,.001],'cabinet-glass':[.01,.001],'camera-drop':[.03,.002],'upper-post-drop':[.1,.03]};
  for(const r of reports){
    if(limits[r.name]){assert.ok(r.maxPositionError<limits[r.name][0],r.name+' position');assert.ok(r.maxVelocityError<limits[r.name][1],r.name+' speed');}
    assert.equal(r.physicsStats.substepBudgetExceeded,0);
  }
  // The deeply embedded native return pocket oscillates vertically. It must
  // stay behind the source post rather than follow the old invented guide.
  const pocket=reports.find(r=>r.name==='return-pocket').samples.at(-1);
  assert.ok(Math.hypot(pocket.actual[1]-pocket.expected[1],pocket.actual[2]-pocket.expected[2])<3);
  assert.ok(pocket.actual[3]>26&&pocket.actual[3]<41);
});

test('scripted primitive rotation changes appearance while retaining the native baked collider',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-camera-animation.json','--json'],{cwd:root,encoding:'utf8'}));
  assert.ok(reports[0].maxPositionError<.03);assert.ok(reports[0].maxVelocityError<.002);
});

test('nonlegacy target front geometry restores the native initial displacement and wire-entry path',async()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-wire-entry.json',import.meta.url)));
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-wire-entry.json','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,1);
  const layout=json('layout'),objects=json('objects');applyReferencePhysics(layout,objects,fixture);
  const g=await createFullGame(layout,objects,fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();
    const c=fixture.cases[0],r=g.records[0],timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    r.body.setTranslation({x:c.x*.01,y:(2115-c.y)*.01,z:c.z*.01},true);r.body.setLinvel({x:0,y:0,z:0},true);r.body.setAngvel({x:0,y:0,z:0},true);
    g.step();const p=r.body.translation(),native=c.timerTrace.find(row=>row[0]==='STATE'&&row[1]===2).slice(2,5);
    assert.ok(Math.hypot(p.x*100-native[0],2115-p.y*100-native[1],p.z*100-native[2])<.01,'independently observed 1ms displacement');
  }finally{g.dispose();}
});

test('raw engine heel/tip, sliding and cradle contacts retain their independently measured baseline',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,11);assert.equal(reports.filter(r=>r.name.includes('cradle')).length,2);
});

test('the authored 10ms controller updates every playable ball through real VB arrays and angular momentum',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let i=0;i<1.7/STEP;i++)g.step();g.spawn('BallRelease');
    assert.equal(g.toyRecords.length,3);
    assert.equal(g.rules.value('UBound(GetBalls())'),4);
    assert.equal(g.rules.value('lob'),3,'authored controller skips the three bobble balls');
    const toyVelocities=g.toyRecords.map(r=>r.body.linvel());
    const [a,b]=g.records;
    for(const r of [a,b]){r.held=null;r.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);}
    a.body.setLinvel({x:60,y:30,z:3},true);b.body.setLinvel({x:-40,y:-70,z:5},true);
    for(const r of [a,b])r.body.setAngvel({x:8,y:10,z:20},true);
    g.rules.tick(.01);
    for(const [index,r]of g.toyRecords.entries())assert.deepEqual(r.body.linvel(),toyVelocities[index],'rolling controller leaves animation balls alone');
    assert.ok(Math.abs(a.body.linvel().x-52)<1e-5);assert.ok(Math.abs(a.body.linvel().y-26)<1e-5);
    assert.ok(Math.abs(b.body.linvel().x+40*52/70)<1e-5);assert.ok(Math.abs(b.body.linvel().y+52)<1e-5);
    for(const r of [a,b]){assert.ok(Math.abs(r.body.angvel().z-19)<1e-5);assert.equal(r.body.angvel().x,8);assert.equal(r.body.angvel().y,10);}
    assert.equal(a.body.linvel().z,3);assert.equal(b.body.linvel().z,5);
    assert.ok(Math.abs(a.proxy.angmomz+47.5)<1e-5);assert.ok(Math.abs(a.proxy.angvelz+.19)<1e-5);
    a.proxy.angvelz=100;assert.equal(a.body.angvel().z,19,'deprecated AngVel setters remain read-only');
  }finally{g.dispose();}
});

test('target-slot floors, elevated walls and both omitted ramps are present',()=>{
  const layout=json('layout');
  for(const name of ['hole015','hole030','apron','Wall024','Ramp001','Ramp064'])assert.ok(layout.items.some(i=>i.name===name),name);
  const floor=layout.items.find(i=>i.name==='hole015');assert.equal(floor.height_top,0);assert.equal(floor.height_bottom,-20);
  assert.equal(layout.playfield.vertices.length/3,293);assert.equal(layout.playfield.indices.length/3,339);
});

test('the target/wire pocket matches the independently recorded native VPX trap',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-slot-back.json','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].name,'slot-back');
});
test('free rolling reaches the native horizontal speed without artificial drag',async()=>{
  const layout=json('layout');layout.playfield=null;layout.items=layout.items.filter(i=>i.kind==='Kicker');layout.physics.scatter=0;
  const g=await createGame(layout);
  try{
    g.start();g.launch();g.ball.setTranslation({x:4.3,y:6.15,z:.25},true);g.ball.setLinvel({x:10,y:0,z:0},true);g.ball.setAngvel({x:0,y:0,z:0},true);
    for(let i=0;i<.15/STEP;i++)g.step();const a=g.ball.linvel().x;
    assert.ok(Math.abs(a-50/7)<.01,`native slide-to-roll speed: ${a}`);
    for(let i=0;i<.1/STEP;i++)g.step();assert.ok(Math.abs(g.ball.linvel().x-a)<.005,'no invented rolling drag');
  }finally{g.dispose();}
});
test('physical balls use the native .8 ball-ball coefficient independently of wall response',async()=>{
  const layout=json('layout');layout.physics.gravity=0;layout.physics.slope=0;
  const g=await createFullGame(layout,json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let i=0;i<1.7/STEP;i++)g.step();g.spawn('BallRelease');
    for(const mesh of g.nativeMeshes)mesh.collider.setEnabled?.(false);
    for(const mechanism of [...g.spinners,...g.triggers,...g.kickers])mechanism.collider.setEnabled(false);
    for(const gate of g.gates)gate.setCollidable(false);
    const [a,b]=g.records;
    for(const [r,x,v]of [[a,400,10],[b,500,-10]]){
      r.held=null;r.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);placeReferenceBall(g,r,{x,y:1100,z:150,vx:v});
    }
    const impacts=[],run=g.rules.run;g.rules.run=(name,...args)=>{if(name==='OnBallBallCollision')impacts.push(args[2]);return run(name,...args);};
    for(let i=0;i<.05/STEP;i++)g.step();
    assert.ok(Math.abs(a.body.linvel().x+8)<.02);assert.ok(Math.abs(b.body.linvel().x-8)<.02);
    assert.deepEqual(impacts,[20],'one callback with the incoming normal speed');
    assert.ok(Math.abs(a.proxy.x-405)<.01);assert.ok(Math.abs(b.proxy.x-495)<.01);
  }finally{g.dispose();}
});
