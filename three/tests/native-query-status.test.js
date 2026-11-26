import test from'node:test';import assert from'node:assert/strict';import RAPIER from'@dimforge/rapier3d-compat';import{NativeQueryStatus}from'../native-query-status.js';
import fs from'node:fs';import{createFullGame}from'../full-game.js';

test('one native candidate search reads each mesh once and the next query observes collider changes',async()=>{
 await RAPIER.init();const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const collider=world.createCollider(RAPIER.ColliderDesc.ball(.25)),query=new NativeQueryStatus();let reads=0;
  const mesh={collider:{isEnabled(){reads++;return collider.isEnabled();}}};
  query.begin();for(let i=0;i<100;i++)assert.equal(query.enabled(mesh,0),true);assert.equal(reads,1);
  // A script or event can change this flag after the synchronous search.
  collider.setEnabled(false);query.begin();for(let i=0;i<100;i++)assert.equal(query.enabled(mesh,0),false);assert.equal(reads,2);
  collider.setEnabled(true);query.begin();assert.equal(query.enabled(mesh,0),true);assert.equal(reads,3);
 }finally{world.free();}
});

test('mesh sharing across query owners cannot reuse another owner status',()=>{
 const first=new NativeQueryStatus(),second=new NativeQueryStatus();let enabled=true,reads=0;const mesh={collider:{isEnabled(){reads++;return enabled;}}};
 first.begin();assert.equal(first.enabled(mesh,0),true);enabled=false;second.begin();assert.equal(second.enabled(mesh,0),false);assert.equal(reads,2);
 first.begin();assert.equal(first.enabled(mesh,0),false);assert.equal(reads,3);
});

test('unregistered mesh records cannot share an undefined cache slot',()=>{
 const query=new NativeQueryStatus();query.begin();
 assert.equal(query.enabled({collider:{isEnabled:()=>true}}),true);
 assert.equal(query.enabled({collider:{isEnabled:()=>false}}),false);
});

test('a failed backend read is retried and revision rollover cannot alias an earlier query',()=>{
 const query=new NativeQueryStatus();let failed=true,enabled=true,reads=0;const mesh={collider:{isEnabled(){reads++;if(failed)throw Error('Unavailable collider');return enabled;}}};
 query.begin();assert.throws(()=>query.enabled(mesh,0),/Unavailable collider/);failed=false;assert.equal(query.enabled(mesh,0),true);assert.equal(reads,2);
 enabled=false;query.revision=Number.MAX_SAFE_INTEGER;query.begin();assert.equal(query.enabled(mesh,0),false);assert.equal(reads,3);
});

test('production starts a fresh mesh-status search for the next ball in the same physics interval',async()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url))),g=await createFullGame(read('layout'),read('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{},undefined,{scriptRandomClock:()=>0,scriptTimerSeconds:()=>0});
 try{
  g.start();for(let i=0;i<2200;i++)g.step();g.buildNativeTree();assert.ok(g.physicalRecords.filter(r=>!r.held).length>=2);
  const collider=g.nativeGlobalMeshes.find(mesh=>mesh.collider.isEnabled()).collider,rawEnabled=collider.isEnabled.bind(collider),rawQuery=g.nativeTree.query.bind(g.nativeTree),reads=[];let queries=0;
  collider.isEnabled=()=>{const enabled=rawEnabled();reads.push({queries,enabled});return enabled;};
  // Declared backend mutation between two synchronous ball searches. It must
  // be visible before another substep or frame begins, without setter hooks.
  g.nativeTree.query=(...args)=>{const result=rawQuery(...args);if(++queries===1)collider.setEnabled(false);return result;};
  g.step();assert.ok(queries>=2);assert.ok(reads.some(row=>row.queries===0&&row.enabled));assert.ok(reads.some(row=>row.queries===1&&!row.enabled),'The second ball rereads the actual disabled flag in the same interval');
 }finally{g.dispose();}
});
