// Paired physics/rules timing with identical declared controls and external
// script clocks. The correctness pass hashes every generated body interval.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
import{createFullGame}from'../three/full-game.js';import{mainPlayerSettings}from'../three/player-settings.js';import{nativeSourceAssets}from'./native-source-assets.mjs';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9),base=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11)??'258757c';assert.ok(output&&!fs.existsSync(output));assert.match(base,/^[a-f0-9]{7,40}$/);
const physicsFile=path.resolve('three/.query-physics-baseline-'+process.pid+'.js'),gameFile=path.resolve('three/.query-game-baseline-'+process.pid+'.js'),assets=nativeSourceAssets('1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');
const physics=execFileSync('git',['show',base+':three/physics.js']),gameSource=execFileSync('git',['show',base+':three/full-game.js'],{encoding:'utf8'}).replace("'./physics.js'",JSON.stringify('./'+path.basename(physicsFile)));
fs.writeFileSync(physicsFile,physics,{flag:'wx'});fs.writeFileSync(gameFile,gameSource,{flag:'wx'});
try{
 const {createFullGame:baseline}=await import(pathToFileURL(gameFile));
 const run=async(create,verify=false)=>{
  const g=await create(assets.json('layout.json'),assets.json('objects.json'),assets.text('rules.vbs'),()=>{},undefined,{frameAnimations:true,playerSettings:mainPlayerSettings,scriptRandomClock:()=>0,scriptTimerSeconds:()=>0});
  assert.equal(g.nativeDisplacements,true);const hash=createHash('sha256'),storage=new Float32Array(18),wordView=new Uint32Array(storage.buffer);let ticks=0,intervals=0;
  const state=()=>{const rows=g.physicalRecords.map(record=>{const native=g.nativeBall(record.body),s=native.snapshot();storage.set([...Object.values(s.p),...Object.values(s.v),...Object.values(s.m),...native.orientation.matrix]);return{id:record.scriptID,held:record.held,words:Array.from(wordView)};});return{rows,random:g.random.getState(),scriptRandom:g.rules.scriptRandom.getState(),score:g.rules.value('Score(CurrentPlayer)'),hole:g.rules.value('BallsInHole'),choosing:g.rules.value('bChooseBattle')};};
  const advance=n=>{for(let i=0;i<n;i++){g.step();if(++ticks%17===0){g.prepareFrame();g.finishFrame();}if(verify){hash.update(JSON.stringify(state()));intervals++;}}};
  try{
   g.start();advance(2200);const start=performance.now();g.input('launch',true);advance(650);g.input('launch',false);
   for(let i=0;i<10;i++){const side=i%2?'left':'right';g.input(side,true);advance(350);g.input(side,false);advance(350);}
   const milliseconds=performance.now()-start,final=state();return{milliseconds,...verify?{intervals,traceSHA256:hash.digest('hex')}:{},final,physicsStats:{...g.physicsStats}};
  }finally{g.dispose();}
 };
 const before=await run(baseline,true),after=await run(createFullGame,true);assert.equal(before.traceSHA256,after.traceSHA256,'Every body/RNG/rule interval must agree');assert.deepEqual(after.final,before.final);assert.deepEqual(after.physicsStats,before.physicsStats);
 for(let i=0;i<2;i++){await run(baseline);await run(createFullGame);}
 const samples=[];for(const candidate of [false,true,true,false,true,false,false,true]){const result=await run(candidate?createFullGame:baseline);assert.deepEqual(result.final,before.final);samples.push({variant:candidate?'candidate':'baseline',milliseconds:result.milliseconds});}
 const means=Object.fromEntries(['baseline','candidate'].map(name=>[name,samples.filter(s=>s.variant===name).reduce((sum,s)=>sum+s.milliseconds,0)/4]));
 const report={scope:'Desktop Node physics/rules component with fixed declared clocks and controls. Full correctness hashes preserve native Float32 words and generated body identities, physical and script RNG, score and scoop state at every interval. Timings exclude initialization and correctness hashing, with balanced sample order. No rendering, real-time or phone speed claim.',baseline:base,baselinePhysicsSHA256:createHash('sha256').update(physics).digest('hex'),candidatePhysicsSHA256:createHash('sha256').update(fs.readFileSync('three/physics.js')).digest('hex'),queryStatusSHA256:createHash('sha256').update(fs.readFileSync('three/native-query-status.js')).digest('hex'),controls:{startupSteps:2200,launchHoldSteps:650,alternatingCycles:10,holdSteps:350,releaseSteps:350,prepareEverySteps:17,scriptClock:0,scriptTimer:0},correctness:{baseline:before,candidate:after},samples,means};fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({traceSHA256:before.traceSHA256,intervals:before.intervals,means}));
}finally{fs.unlinkSync(gameFile);fs.unlinkSync(physicsFile);}
