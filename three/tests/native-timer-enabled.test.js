import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createRules} from '../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-timer-enabled-native.json',import.meta.url)));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
for(const c of fixture.cases)test('native timer property scheduling: '+c.name,()=>{
 const name=c.kind==='Timer'?'Spots':'Flasher007',property=c.kind==='Timer'?'Enabled':'TimerEnabled',interval=c.kind==='Timer'?'Interval':'TimerInterval',r=createRules(`Dim FireCount\nFireCount=0\nSub ${name}_Timer\nFireCount=FireCount+1\nEnd Sub`,{objects:[{name,kind:c.kind,timer_interval:100}],collections:[]});let now=c.events[0].values[0];r.tick(now/1000);r.execute(`${name}.${interval}=100:${name}.${property}=${c.initial?'True':'False'}`);
 for(const action of c.actions)r.schedule(action.ms,`${name}.${property}=${action.code.replace(':ON',`:${name}.${property}=True`)}`);
 const ticks=[];for(const row of c.events){while(now<row.values[0]){const before=r.value('FireCount');r.tick(.001);now++;if(r.value('FireCount')!==before)ticks.push(now);}assert.deepEqual([now,r.value('FireCount'),Number(r.objects.get(name.toLowerCase())[property]),r.value(`VarType(${name}.${property})`)],row.values,`${c.name} ${row.phase} ${row.ms}ms`);}
 assert.deepEqual(ticks,c.events.filter(r=>r.phase==='fire').map(r=>r.values[0]));assert.equal(r.engine.error,null);
});
