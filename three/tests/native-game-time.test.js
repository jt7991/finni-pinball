import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRules} from '../rules.js';

test('GameTime exposes the independently compiled native millisecond LONG while timers are deferred',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-game-time-native.json',import.meta.url)));
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.functionSHA256,'13b88e40075714570a7f3a7ac77c3a8ebfd7a2e584a1d6918bb1199497d71594');
  const rules=createRules('',{objects:[],collections:[]});
  try{
    let previous=0;
    for(const row of fixture.cases){
      rules.tick((row.milliseconds-previous)/1000,false);previous=row.milliseconds;
      assert.equal(rules.value('GameTime'),row.value);
      assert.equal(rules.value('VarType(GameTime)'),fixture.variantType);
      rules.execute('Dim CapturedGameTime:CapturedGameTime=GameTime');
      assert.equal(rules.value('CapturedGameTime'),row.value);
      assert.equal(rules.value('VarType(CapturedGameTime)'),fixture.variantType);
    }
  }finally{rules.engine.destroy();}
});
