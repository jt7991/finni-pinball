import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
import{compareNativeHistoryState}from'./compare-native-history-state.mjs';import{ballStateScenarios}from'./ball-state-scenarios.mjs';
export async function compareNativeBallState(fixture,{write=()=>{}}={}){
 assert.deepEqual(fixture.inputs,ballStateScenarios());assert.deepEqual(fixture.errors,[]);assert.equal(fixture.observerMemoryWrites,0);
 assert.deepEqual(fixture.prefix.finalObservation,fixture.prefix.frames.at(-1).snapshot);
 assert.ok(fixture.prefix.playerInputs.every(input=>input.frameIndex<fixture.prefix.frames.at(-1).frameIndex),'Every observed prefix input precedes the checked final frame');
 const floats=new Float32Array(3),words=new Uint32Array(floats.buffer),bits=values=>{floats.set(values);return Array.from(words);};
 return compareNativeHistoryState(fixture.prefix,{write,afterReplay:game=>{
  let stagesChecked=0;const differences=[];game.rules.execute('Dim RefStateBall');
  for(const input of fixture.inputs){
   const expected=fixture.rows[input.index],previous=new Set(game.physicalRecords),random=game.random.getState(),unrelated=Array.from(previous,record=>game.nativeBall(record.body).snapshot());
   game.rules.execute('Set RefStateBall='+input.kicker+'.CreateBall');const created=game.physicalRecords.filter(r=>!previous.has(r));assert.equal(created.length,1);const record=created[0];
   let stageIndex=0;const observe=(phase,script)=>{
    const native=game.nativeBall(record.body).snapshot(),state={id:record.scriptID,position:bits(Object.values(native.p)),velocity:bits(Object.values(native.v)),momentum:bits(Object.values(native.m)),locked:!!record.held};
    const actual={phase,...script?{script}:{},state};
    const target=expected.stages[stageIndex++];assert.equal(actual.phase,target.phase);assert.equal(actual.script,target.script);
    for(const key of ['id','position','velocity','momentum','locked'])if(JSON.stringify(state[key])!==JSON.stringify(target.state[key]))differences.push({case:input.index,phase,script,field:key,actual:state[key],expected:target.state[key]});
    for(const [field,prefix]of [['position',''],['velocity','Vel'],['momentum','AngMom']]){
     const publicBits=bits(['X','Y','Z'].map(axis=>game.rules.value('RefStateBall.'+prefix+axis)));
     if(JSON.stringify(publicBits)!==JSON.stringify(target.state[field]))differences.push({case:input.index,phase,script,field:'public '+field,actual:publicBits,expected:target.state[field]});
    }
    stagesChecked++;
   };
   observe('created');
   for(const setter of input.setters){const script='RefStateBall.'+setter.property+'='+setter.value;game.rules.execute(script);observe('setter',script);}
   const script=input.kicker+'.'+input.kick;game.rules.execute(script);observe('ejected',script);
   assert.equal(stageIndex,expected.stages.length);assert.equal(Math.round(game.time*1000),expected.ms);assert.deepEqual(game.random.getState(),random);assert.deepEqual(game.random.getState(),expected.random);
   assert.deepEqual(Array.from(previous,record=>game.nativeBall(record.body).snapshot()),unrelated,'No setter or ejection changes an unrelated live body');
  }
  write({componentResult:{cases:fixture.inputs.length,stagesChecked,differences}});
  assert.equal(differences.length,0,JSON.stringify(differences.slice(0,6)));
  return{cases:fixture.inputs.length,stagesChecked};
 }});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [file,output]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync(file)),observations=[];
 try{const result=await compareNativeBallState(fixture,{write:row=>{if(row.componentResult||row.differences?.length)observations.push(row);}});fs.writeFileSync(output,JSON.stringify({result,observations},null,2),{flag:'wx'});console.log(JSON.stringify({result}));}
 catch(error){fs.writeFileSync(output,JSON.stringify({error:String(error),observations},null,2),{flag:'wx'});throw error;}
}
