import test from 'node:test';
import assert from 'node:assert/strict';
import {Object3D,Quaternion,Vector3} from 'three';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {TargetMotion} from '../target-motion.js';
import {applyTargetAnimation,targetAnimationAxis,TARGET_SCALE} from '../target-render.js';

test('stand-up motion preserves native frame state through repeated hits, visibility and script setters',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-standup-compiled-motion.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.bodySha256,'1a0c4d86e0689f25c3aabbded715e4afee3ff13539e2e4f31435ca3c32993027');
  assert.equal(fixture.cases.length,32);
  for(const [index,scenario]of fixture.cases.entries()){
    let now=scenario.startMilliseconds;const events=[],target=new TargetMotion(scenario.spec,{setEnabled(){}},()=>now,event=>events.push(event));
    assert.equal(target.drop,false);
    for(const action of scenario.actions){
      if(action.type==='hit')target.hit({});
      else if(action.type==='drop')target.setDropped(action.value,{});
      else if(action.type==='visible')target.visible=action.value;
      else{now+=action.milliseconds;target.update(action.milliseconds);assert.deepEqual({offset:target.offset,dropped:target.dropped,pending:target.hitPending,moving:target.moving,down:target.down},action.expected,`native stand-up sequence ${index} at ${now}`);}
    }
    assert.ok(events.every(event=>event==='Animate'),'stand-up motion does not emit drop/raise events');
  }
});

test('all authored stand-up pivots and axes reproduce native posed vertices and normals within Float32 rounding',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-standup-render-vertices.json.gz',import.meta.url));
  assert.equal(fixture.bodySha256,'e623749d5087bd25ce62ed1e331bf678a2fee0fcb1a0d85a6df8b65de2081b9f');assert.equal(fixture.cases.length,11);
  const ulp=value=>2**(Math.floor(Math.log2(Math.max(Number.MIN_VALUE,Math.abs(value))))-23);
  for(const target of fixture.cases){
    assert.equal(target.rest.length,161);assert.equal(target.poses.length,4);
    const object=new Object3D(),rest={position:new Vector3(...target.baseGLB),quaternion:new Quaternion()},axis=targetAnimationAxis(target.rotZ);
    for(const pose of target.poses){
      applyTargetAnimation(object,{drop:false,offset:pose.offset},rest,axis);object.updateMatrix();assert.deepEqual(object.position,rest.position,'the authored pivot stays fixed');
      for(const [index,vertex]of target.rest.entries()){
        const local=new Vector3(vertex[0]-Math.fround(target.position.x),vertex[2]-Math.fround(target.position.z),vertex[1]-Math.fround(target.position.y)).multiplyScalar(TARGET_SCALE).applyMatrix4(object.matrix),actual=[local.x/TARGET_SCALE,local.z/TARGET_SCALE,local.y/TARGET_SCALE],expected=pose.expected[index];
        const positionError=Math.hypot(...actual.map((value,i)=>value-expected[i])),positionRoundoff=2*ulp(Math.max(...expected.slice(0,3).map(Math.abs)));
        assert.ok(positionError<=positionRoundoff,`${target.name} ${pose.offset}deg vertex ${index}: ${positionError} VPU`);
        const normal=new Vector3(vertex[3],vertex[5],vertex[4]).applyQuaternion(object.quaternion),actualNormal=[normal.x,normal.z,normal.y],normalError=Math.hypot(...actualNormal.map((value,i)=>value-expected[i+3])),normalRoundoff=4*ulp(Math.max(...expected.slice(3,6).map(Math.abs)));
        assert.ok(normalError<=normalRoundoff,`${target.name} ${pose.offset}deg normal ${index}: ${normalError}`);
      }
    }
  }
});
