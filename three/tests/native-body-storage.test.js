import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {NativeBodyStorage} from '../native-body-storage.js';
import {NativeBall} from '../native-ball.js';

const vector=v=>({x:v.x,y:v.y,z:v.z});
async function scenario(run){
  await RAPIER.init();const world=new RAPIER.World({x:0,y:0,z:0});
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  world.createCollider(RAPIER.ColliderDesc.ball(.25).setMass(1),body);
  try{await run(body,world);}finally{world.free();}
}

test('native storage reads each unchanged backend vector once',()=>scenario(body=>{
  const counts={translation:0,linvel:0,angvel:0};
  for(const name of Object.keys(counts)){
    const original=body[name];body[name]=function(){counts[name]++;return original.call(this);};
  }
  const storage=new NativeBodyStorage(body);
  try{
    for(let i=0;i<10;i++)for(const name of Object.keys(counts)){
      assert.deepEqual(vector(storage[name]()),{x:0,y:0,z:0});
    }
    assert.deepEqual(counts,{translation:1,linvel:1,angvel:1});
    body.setTranslation({x:2,y:3,z:4},true);body.setLinvel({x:1,y:2,z:3},true);body.setAngvel({x:4,y:5,z:6},true);
    assert.deepEqual(vector(storage.translation()),{x:2,y:3,z:4});assert.deepEqual(vector(storage.linvel()),{x:1,y:2,z:3});assert.deepEqual(vector(storage.angvel()),{x:4,y:5,z:6});
    assert.deepEqual(counts,{translation:2,linvel:2,angvel:2});
  }finally{storage.release();}
}));

test('raw impulses, rotation locks, sleep, body types and mass changes invalidate native reads',()=>scenario(body=>{
  const storage=new NativeBodyStorage(body),compare=()=>{
    for(const name of ['translation','linvel','angvel'])assert.deepEqual(vector(storage[name]()),vector(body[name]()));
  };
  try{
    const mutations=[
      ()=>body.setLinvel({x:1,y:2,z:3},true),()=>body.setAngvel({x:2,y:3,z:4},true),
      ()=>body.applyImpulse({x:1,y:-2,z:3},true),()=>body.applyTorqueImpulse({x:1,y:2,z:3},true),
      ()=>body.applyImpulseAtPoint({x:0,y:1,z:0},{x:1,y:0,z:0},true),
      ()=>body.setRotation({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},true),
      ()=>body.setAdditionalMass(2,true),()=>body.recomputeMassPropertiesFromColliders(),
      ()=>body.lockTranslations(true,true),()=>body.lockRotations(true,true),
      ()=>body.setEnabledTranslations(true,true,true,true),()=>body.setEnabledRotations(true,true,true,true),
      ()=>body.sleep(),()=>body.wakeUp(),
      ()=>body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true),
      ()=>body.setNextKinematicTranslation({x:1,y:2,z:3}),
      ()=>body.setNextKinematicRotation({x:0,y:0,z:0,w:1}),
      ()=>body.setLinvel({x:8,y:9,z:10},true), // May be rejected: read the actual backend value.
      ()=>body.setBodyType(RAPIER.RigidBodyType.Dynamic,true),
      ()=>body.setEnabled(false),()=>body.setEnabled(true),
    ];
    compare();for(const mutate of mutations){mutate();compare();}
  }finally{storage.release();}
}));

test('storage retries failed reads and mutations, then restores body methods without replacing later owners',()=>{
  let x=1,reads=0,fail=true,released=0;
  const body={translation(){reads++;if(fail)throw Error('read failed');return{x,y:0,z:0};},setTranslation(value){x=value.x;throw Error('partially applied');}};
  const descriptor=Object.getOwnPropertyDescriptor(body,'setTranslation'),storage=new NativeBodyStorage(body,()=>released++);
  assert.throws(()=>storage.translation(),/read failed/);fail=false;assert.equal(storage.translation().x,1);assert.equal(reads,2);
  assert.throws(()=>body.setTranslation({x:2}),/partially applied/);assert.equal(storage.translation().x,2);
  storage.release();storage.release();assert.equal(released,1);assert.deepEqual(Object.getOwnPropertyDescriptor(body,'setTranslation'),descriptor);
  const second=new NativeBodyStorage(body),wrapped=body.setTranslation,later=function(...args){return wrapped.apply(this,args);};body.setTranslation=later;
  second.release();assert.equal(body.setTranslation,later);x=3;assert.equal(second.translation().x,3);
});

test('cached native momentum and signed zero survive raw mutations and detached body reuse',()=>scenario((body,world)=>{
  const native=new NativeBall(body,{cacheStorage:true});native.setParameters(25,1);
  native.body.setLinvel({x:-0,y:-0,z:0},true);assert.deepEqual(native.snapshot().v,{x:-0,y:0,z:0});
  for(const method of ['translation','linvel','angvel']){
    const before=native.body[method](),returned=native.body[method]();returned.x=999;
    assert.deepEqual(native.body[method](),before,'public vectors remain independent of cached observations');
  }
  body.applyImpulse({x:1,y:2,z:3},true);assert.deepEqual(native.snapshot().v,{x:1,y:-2,z:3});
  const state=native.snapshot();state.v={x:0,y:0,z:0};state.m={x:0,y:0,z:0};native.commit(state);
  const storage=native.storage;native.detach();assert.equal(storage.active,false);world.removeRigidBody(body);
  const replacement=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(3,4,5));
  replacement.setLinvel({x:10,y:20,z:30},true);
  assert.deepEqual(native.snapshot().v,{x:0,y:0,z:0});assert.deepEqual(native.snapshot().m,{x:0,y:0,z:0});
  native.setPosition('x',123.25);assert.equal(native.snapshot().p.x,123.25);assert.equal(replacement.translation().x,3);
}));

test('ordinary NativeBall reads still observe backend integration without caching',()=>scenario((body,world)=>{
  const native=new NativeBall(body);native.body.setLinvel({x:1,y:0,z:0},true);
  assert.equal(native.storage,body);const before=native.snapshot().p.x;world.step();assert.ok(native.snapshot().p.x>before);
}));
