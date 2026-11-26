import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
import{compareNativeHistoryState}from'./compare-native-history-state.mjs';import{kickerEjectionScenarios,kickerEjectionStatement}from'./kicker-ejection-scenarios.mjs';
export async function compareKickerEjection(fixture,{write=()=>{}}={}){
 assert.deepEqual(fixture.inputs,kickerEjectionScenarios());assert.deepEqual(fixture.errors,[]);assert.equal(fixture.observerMemoryWrites,0);
 // The paused entry is an independently observed native submission. No
 // unrecorded physics or RNG cursor may be fitted between replay and component.
 assert.deepEqual(fixture.prefix.finalObservation,fixture.prefix.frames.at(-1).snapshot);
 assert.ok(fixture.prefix.playerInputs.every(input=>input.frameIndex<fixture.prefix.frames.at(-1).frameIndex));
 const floats=new Float32Array(3),words=new Uint32Array(floats.buffer),bits=values=>{floats.set(values);return Array.from(words);};
 return compareNativeHistoryState(fixture.prefix,{write,afterReplay:game=>{
  const rows=[];game.rules.execute('Dim RefEjectedBall');
  for(const input of fixture.inputs){
   const expected=fixture.rows[input.index],existing=new Set(game.physicalRecords);
   game.rules.execute('Set RefEjectedBall='+input.kicker+'.CreateBall');
   const created=game.physicalRecords.filter(r=>!existing.has(r));assert.equal(created.length,1);const record=created[0];assert.equal(record.held,input.kicker.toLowerCase());
   game.rules.execute(input.kicker+'.Scatter='+input.scatter+':'+['X','Y','Z'].map((axis,i)=>'RefEjectedBall.'+axis+'='+input.position[i]).concat(['AngMomX','AngMomY','AngMomZ'].map((axis,i)=>'RefEjectedBall.'+axis+'='+input.momentum[i])).join(':'));
   const beforeRandom=game.random.getState(),statement=kickerEjectionStatement(input);assert.equal(statement,expected.statement);game.rules.execute(statement);
   const read=()=>{const state=game.nativeBall(record.body).snapshot();return{id:record.scriptID,position:bits(Object.values(state.p)),velocity:bits(Object.values(state.v)),momentum:bits(Object.values(state.m)),locked:!!record.held};};
   const actual={index:input.index,statement,ms:Math.round(game.time*1000),beforeRandom,afterRandom:game.random.getState(),state:read(),scatterType:game.rules.value('VarType('+input.kicker+'.Scatter)')};rows.push(actual);
   write({component:input.index,actual,expected});assert.deepEqual(actual,expected,'Original ejection input '+input.index);
   const bodies=game.physicalRecords.map(r=>game.nativeBall(r.body).snapshot()),rng=game.random.getState();game.rules.execute(statement);
   assert.deepEqual(game.physicalRecords.map(r=>game.nativeBall(r.body).snapshot()),bodies,'Empty kicker preserves every live body');assert.deepEqual(game.random.getState(),rng,'Empty kicker consumes no random word');
  }
  return{cases:rows.length};
 }});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [file,output]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync(file)),observations=[];
 try{const result=await compareKickerEjection(fixture,{write:row=>{if(row.component!==undefined||row.differences?.length)observations.push(row);}});fs.writeFileSync(output,JSON.stringify({result,observations},null,2),{flag:'wx'});console.log(JSON.stringify({result}));}
 catch(error){fs.writeFileSync(output,JSON.stringify({error:String(error),observations},null,2),{flag:'wx'});throw error;}
}
