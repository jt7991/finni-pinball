import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {VbsEngine} from '@devscholar/vbs-engine-js';import {createRules} from '../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-colon-calls-native.json',import.meta.url)));
assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
for(const scenario of fixture.cases)test('native VBScript colon calls: '+scenario.name,()=>{
 const engine=new VbsEngine({hostIntegration:false});engine.addCode(scenario.source);assert.equal(engine.error,null);assert.equal(engine.eval(scenario.expression),scenario.expected);assert.equal(engine.error,null);
});
test('the authored trigger collection runs PlaySfx once and advances its script stream',()=>{
 const sounds=[],source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),specs=JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),ball={x:500,y:1000,z:25,velx:0,vely:0,velz:0},rules=createRules(source,specs,{createBall:()=>ball,sound:name=>sounds.push(name)});
 rules.init();rules.engine._registerFunction('Timer',()=>({type:'Single',value:123.5}));rules.scriptRandom.restoreState(0x123456);sounds.length=0;
 rules.hit('Trigger005','Hit',ball);
 assert.equal(sounds.filter(name=>/^sfx\d+$/i.test(name)).length,1,'collection dispatch calls the original no-argument routine before the individual handler');assert.notEqual(rules.scriptRandom.getState(),0x123456);
});
