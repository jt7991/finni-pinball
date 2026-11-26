import test from 'node:test';import assert from 'node:assert/strict';import RAPIER from '@dimforge/rapier3d-compat';import {NativeBall} from '../native-ball.js';
test('native velocity retains signed zero through backend equal-write suppression and adopts external impulses',async()=>{
 await RAPIER.init();const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.ball(.25).setMass(1),body);
  const native=new NativeBall(body);native.body.setLinvel({x:-0,y:-0,z:0},true);
  assert.equal(native.body.linvel().x,-0);assert.equal(native.body.linvel().y,-0);assert.equal(native.snapshot().v.y,0);
  body.applyImpulse({x:1,y:2,z:3},true);assert.deepEqual({...native.body.linvel()},{x:1,y:2,z:3});
  const state=native.snapshot();state.v={x:-0,y:-0,z:0};state.m={x:0,y:0,z:0};native.commit(state);
  assert.deepEqual(native.snapshot().v,{x:-0,y:-0,z:0});assert.deepEqual(native.snapshot().m,{x:0,y:0,z:0});
  native.detach();world.removeRigidBody(body);assert.deepEqual(native.snapshot().v,{x:-0,y:-0,z:0});
 }finally{world.free();}
});
