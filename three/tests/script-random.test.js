import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createScriptRandom,registerScriptRandom} from '../script-random.js';
import {runtimeNativeRandom} from '../native-random.js';
import {createRules} from '../rules.js';
import {VbsEngine} from '@devscholar/vbs-engine-js';

test('script Rnd and Randomize match every pinned native Single output and argument conversion',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-script-random.json',import.meta.url)));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  let outputs=0;
  for(const scenario of fixture.cases){
    const engine=new VbsEngine({hostIntegration:false}),random=createScriptRandom();registerScriptRandom(engine,random);
    engine.addCode('Dim Sample');assert.equal(engine.error,null);
    for(const sample of scenario.samples){
      const statement=scenario.statements[sample.step];engine.executeStatementThrows(statement.startsWith('Randomize')?statement:`Sample=${statement}`);
      assert.equal(engine.eval('CLng(Rnd(0)*16777216)'),sample.units,`${scenario.name} ${statement}`);
      assert.equal(engine.eval('VarType(Rnd(0))'),sample.type);assert.equal(engine.error,null);outputs++;
    }
    engine.destroy();
  }
  assert.equal(outputs,112);
});

test('omitted Randomize uses integer milliseconds and preserves the old low byte',()=>{
  const random=createScriptRandom({clock:()=>123456.9}),explicit=createScriptRandom();
  assert.equal(random.getState(),0x50000);assert.equal(random.rnd(0),.01953125);
  for(let i=0;i<7;i++){assert.equal(random.rnd(),explicit.rnd());const low=random.getState()&255;random.randomize();explicit.randomize(123.456);assert.equal(random.getState(),explicit.getState());assert.equal(random.getState()&255,low);}
});

test('script contexts and automatic coils share their own stream independently of native physics and other scripts',()=>{
  const specs={objects:[],collections:[]},a=createRules('',specs),b=createRules('',specs),oracle=createScriptRandom(),physical=runtimeNativeRandom(),state=physical.getState();
  a.execute('Dim Sample:Sample=Rnd(-1)');b.execute('Dim Sample:Sample=Rnd(-1)');oracle.rnd(-1);
  const coil=a.objects.get('hostplunger'),trigger={x:0,y:0,radius:44},ball={x:1,vely:0};coil.initimpulsep(trigger,45,0);coil.random(1);coil.addball(ball);
  for(let i=0;i<1000;i++){
    if(i%2){coil.autofire();assert.equal(ball.vely,-45+oracle.rnd());}
    else assert.equal(a.value('Rnd'),oracle.rnd());
  }
  assert.deepEqual(physical.getState(),state,'script and coil draws do not advance physics');assert.equal(physical.calls,0);
  assert.equal(b.value('CLng(Rnd(0)*16777216)'),3758214,'another script context retains its state');
  const scriptState=a.scriptRandom.getState();for(let i=0;i<1000;i++)physical();assert.equal(a.scriptRandom.getState(),scriptState,'physics draws do not advance scripts');
});
