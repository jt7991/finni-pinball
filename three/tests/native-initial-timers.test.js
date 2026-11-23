import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createRules} from '../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-initial-timers-native.json',import.meta.url)));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const setup=()=>{const events=[],source=fixture.handlers.map(({name})=>`Sub ${name}_Timer\nMsgBox "${name}"\nEnd Sub`).join('\n'),r=createRules(source,{objects:[...fixture.initial].reverse(),collections:[]},{message:name=>{const object=r.objects.get(name.toLowerCase());events.push({name,values:[Math.round(r.time*1000),Number(object.enabled),object.interval]});}});return {r,events};};
test('authored initial timer flags retain native Boolean values and core PulseTimer interval',()=>{
 const {r}=setup(),observed=fixture.events.find(row=>row.name==='properties').values.slice(1),actual=['GIUpdateTimer','FinniDmdAnimationTimer','PulseTimer'].flatMap(name=>{const o=r.objects.get(name.toLowerCase());assert.equal(r.value(`VarType(${name}.Enabled)`),11);return [Number(o.enabled),o.interval];});assert.deepEqual(actual,observed);assert.equal(r.engine.error,null);
});
test('authored initial timers preserve independently observed native callback phases and order',()=>{
 const {r,events}=setup(),start=fixture.events.find(row=>row.name==='properties').values[0],expected=fixture.events.filter(row=>row.name!=='properties'),end=expected.at(-1).values[0];for(let ms=1;ms<=end;ms++)r.tick(.001);assert.deepEqual(events.filter(row=>row.values[0]>=start),expected);assert.equal(r.engine.error,null);
});
