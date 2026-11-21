import test from 'node:test';
import assert from 'node:assert/strict';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {TargetMotion} from '../target-motion.js';

test('queued target hits retain native animation state across script resets and hidden frames',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-target-compiled-queue.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.bodySha256,'1a0c4d86e0689f25c3aabbded715e4afee3ff13539e2e4f31435ca3c32993027');
  assert.equal(fixture.setterSha256,'e0e509106057a509cb11970386312a176de657aaa213ea398fe02c7cd3a20805');
  assert.equal(fixture.cases.length,32);let hiddenPending=0,completedDrops=0;
  for(const [index,scenario]of fixture.cases.entries()){
    let now=scenario.startMilliseconds;
    const target=new TargetMotion(scenario.spec,{setEnabled(){}},()=>now,()=>{});
    for(const action of scenario.actions){
      if(action.type==='hit')target.hit({});
      else if(action.type==='drop')target.setDropped(action.value,{});
      else if(action.type==='visible')target.visible=action.value;
      else{
        assert.equal(action.type,'frame');now+=action.milliseconds;target.update(action.milliseconds);
        assert.deepEqual({offset:target.offset,dropped:target.dropped,pending:target.hitPending,moving:target.moving,down:target.down},action.expected,`native sequence ${index} at ${now}ms`);
        if(!target.visible&&target.hitPending)hiddenPending++;
        if(target.dropped&&!target.moving)completedDrops++;
      }
    }
  }
  assert.ok(hiddenPending>0,'hidden frames preserve the native pending flag');
  assert.ok(completedDrops>0,'queued hits complete after the scripted reset');
});
