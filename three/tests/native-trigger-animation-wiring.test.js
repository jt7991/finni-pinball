import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createFullGame} from '../full-game.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-authored-trigger-animation-native.json.gz',import.meta.url))));
test('authored trigger hit/unhit callbacks and prepared frames retain all native animation offsets',async()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.triggerBodySHA256,'e1473de5ad8f30d9c3e297e0b24728dd8cd20fcd0eb9279a3a4241e392b3fece');assert.equal(fixture.cases.length,19);
 const layout=JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),objects=JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
 const game=await createFullGame(layout,objects,source,()=>{},null,{frameAnimations:true,storage:{load:()=>'',save:()=>{}}});
 try{
  const record=game.physicalRecords[0];assert.ok(record,'Original table bobble ball provides a real native-compatible ActiveBall');
  let frames=0;
  for(let index=0;index<fixture.cases[0].actions.length;index++){
   const first=fixture.cases[0].actions[index];
   if(first.action==='frame'){
    game.time+=first.value/1000;game.prepareFrame();
    for(const scenario of fixture.cases){const expected=scenario.actions[index].expected,motion=game.visualMotions.get(scenario.name.toLowerCase());assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key=>[key,motion[key]])),expected,scenario.name+' source animation at frame '+frames);assert.equal(game.rules.objects.get(scenario.name.toLowerCase()).currentanimoffset,expected.offset,scenario.name+' live getter');}
    frames++;
   }else for(const scenario of fixture.cases){const trigger=game.triggers.find(trigger=>trigger.spec.name===scenario.name);assert.ok(trigger);trigger.emit(first.action==='unhit'?'UnHit':'Hit',record);}
  }
  assert.equal(frames,10);
 }finally{game.dispose();}
});
