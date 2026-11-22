// Original compiled Trigger::UpdateAnimation on every authored trigger, including
// invisible shooter switches. Expected values never come from the port model.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {nativeMechanisms} from './native-mechanism-compiled-harness.mjs';
const sourceDirectory=process.argv[2];assert.ok(sourceDirectory,'Supply an unmodified extracted gameitems directory');
const native=await nativeMechanisms(),objects=JSON.parse(fs.readFileSync('three/public/objects.json')).objects,cases=[];
const actions=[['hit'],['frame',1],['frame',7],['frame',16],['unhit'],['frame',4],['frame',33],['hit'],['unhit'],['frame',5],['hit'],['frame',100],['frame',16],['unhit'],['frame',1],['frame',100]];
for(const object of objects.filter(object=>object.kind==='Trigger')){
 const bytes=fs.readFileSync(sourceDirectory+'/Trigger.'+object.name+'.json'),spec={kind:'Trigger',...JSON.parse(bytes).Trigger};native.trigger.reset(spec);
 const recorded=[];
 for(const [action,value]of actions){const entry={action,value};if(action==='frame'){native.trigger.update(value);entry.expected=native.trigger.read();}else native.trigger.hit(action==='unhit');recorded.push(entry);}
 const singleHitFrames={};if(spec.name==='Trigger005')for(let milliseconds=1;milliseconds<=150;milliseconds++){native.trigger.reset(spec);native.trigger.hit(false);native.trigger.update(milliseconds);singleHitFrames[milliseconds]=native.trigger.read();}
 cases.push({name:spec.name,sourceSHA256:createHash('sha256').update(bytes).digest('hex'),spec:{shape:spec.shape,radius:spec.radius,anim_speed:spec.anim_speed,is_visible:spec.is_visible},actions:recorded,...(Object.keys(singleHitFrames).length?{singleHitFrames}:{})});
}
assert.equal(cases.length,19);
const fixture={engineSHA256:'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8',upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',triggerBodySHA256:native.hashes[4332],cases,scope:'Unchanged compiled native Trigger::UpdateAnimation body on all 19 authored trigger properties, from read-only original extraction. Explicit hit/unhit/frame inputs; no port values or fitted animation states.'};
fs.writeFileSync('three/tests/fixtures/vpx-authored-trigger-animation-native.json.gz',gzipSync(JSON.stringify(fixture),{level:9}));
console.log(JSON.stringify({triggers:cases.length,frames:cases.reduce((sum,c)=>sum+c.actions.filter(action=>action.expected).length,0),invisible:cases.filter(c=>!c.spec.is_visible).map(c=>c.name)}));
