import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import RAPIER from '@dimforge/rapier3d-compat';
import {createFullGame} from '../full-game.js';
import {NativeDynamicTree} from '../native-dynamic-tree.js';
import {nativeMeshQuery} from '../native-mesh-contact.js';
import {placeReferenceBall} from '../../scripts/reference-physics.mjs';
import {nativeBallStorageOrder} from '../native-ball-collision.js';
const root=new URL('../../',import.meta.url);
const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));

test('recycled body storage keeps its collision rank while the handle generation changes',async()=>{
  await RAPIER.init();const world=new RAPIER.World({x:0,y:0,z:0});
  try{
    const first=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()),second=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()),rank=nativeBallStorageOrder(first.handle);
    assert.ok(rank<nativeBallStorageOrder(second.handle));world.removeRigidBody(first);
    const replacement=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());assert.notEqual(replacement.handle,first.handle,'A new lifetime has a distinct opaque handle');assert.equal(nativeBallStorageOrder(replacement.handle),rank,'Pointer-style collision rank follows reused storage');assert.ok(nativeBallStorageOrder(replacement.handle)<nativeBallStorageOrder(second.handle),'A later ball can precede an older live ball in storage order');
  }finally{world.free();}
});

test('production ball collisions match native head-on, glancing, vertical and embedded recordings',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-ball-pairs.mjs','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.deepEqual(reports.map(r=>r.name),['head-on','glancing','height-offset','embedded']);
  for(const r of reports)assert.equal(r.impacts.length,1,'one impact callback for the reciprocal collision pair');
  assert.equal(reports[0].impacts[0].speed,24);
});

test('a native-created locked ball retains its exact position while the incoming ball rebounds',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-ball-pairs.mjs','three/tests/fixtures/vpx-frozen-ball.json','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].impacts.length,1);
  for(const s of reports[0].samples){assert.equal(s.actual[9],Math.fround(153.00056));assert.equal(s.actual[10],2061);assert.equal(s.actual[11],25);assert.deepEqual(s.actual.slice(12,15),[0,0,0]);}
});

test('scalar dynamic tree preserves source order through splits and mid-frame insertion',()=>{
  const records=[10,180,100,20,170,110,0].map((x,id)=>({id,x}));
  const bounds=r=>({box:{left:r.x-1,right:r.x+1,top:-1,bottom:1,low:-1,high:1}}),tree=new NativeDynamicTree();tree.update(records,bounds);
  const q=nativeMeshQuery({x:.9,y:21.15,z:0},{x:400,y:0,z:0},.25,.001),visited=[];
  tree.query(q,null,r=>visited.push(r.id));assert.deepEqual(visited,[0,3,6,1,2,4,5]);
  let calculated=0;const replacement={id:7,x:90};tree.sync([...records.slice(0,6),replacement],r=>{calculated++;return bounds(r);});
  assert.equal(calculated,1,'only a new body recalculates its bounds during the current physics millisecond');
  const next=[];tree.query(q,null,r=>next.push(r.id));assert.ok(next.includes(7));assert.ok(!next.includes(6));assert.equal(new Set(next).size,7);
});

test('a kicker-held ball has infinite collision mass and a quiet embedded pair uses native separation',async()=>{
  const layout=json('layout');layout.physics.gravity=0;layout.physics.slope=0;
  const g=await createFullGame(layout,json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let ms=0;ms<1700;ms++)g.step();g.spawn('BallRelease');
    for(const m of g.nativeMeshes)m.collider.setEnabled?.(false);
    for(const m of [...g.spinners,...g.triggers,...g.kickers])m.collider.setEnabled(false);
    for(const gate of g.gates)gate.setCollidable(false);
    const [a,b]=g.records;
    for(const r of [a,b]){r.held=null;r.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);}
    placeReferenceBall(g,a,{x:400,y:1100,z:150,vx:10});placeReferenceBall(g,b,{x:450,y:1100,z:150});
    b.held='lock';b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    const impacts=[],run=g.rules.run;g.rules.run=(name,...args)=>{if(name==='OnBallBallCollision')impacts.push(args[2]);return run(name,...args);};
    for(let ms=0;ms<50;ms++)g.step();
    assert.equal(a.proxy.velx,-8);assert.equal(b.proxy.velx,0);assert.equal(b.proxy.x,450);assert.deepEqual(impacts,[10]);
    assert.ok(Math.abs(a.proxy.x-360)<.01);
    b.held=null;b.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    placeReferenceBall(g,a,{x:400,y:1100,z:150});placeReferenceBall(g,b,{x:447,y:1100,z:150});impacts.length=0;
    g.step();assert.ok(Math.abs(a.proxy.velx+.045)<1e-6);assert.ok(Math.abs(b.proxy.velx-.045)<1e-6);assert.equal(impacts.length,0);
    assert.ok(b.proxy.x-a.proxy.x>49.9,'the source penetration correction separates both bodies');assert.equal(g.physicsStats.substepBudgetExceeded,0);
  }finally{g.dispose();}
});
