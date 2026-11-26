import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createFullGame}from'../full-game.js';import{STEP}from'../game-constants.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url))),source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
for(const fallback of [false,true])test((fallback?'fallback':'native')+' integration preserves backend configuration and event ownership',async()=>{
 const layout=read('layout');if(fallback)layout.physics.native_displacements=false;
 const g=await createFullGame(layout,read('objects'),source,()=>{},undefined,{scriptRandomClock:()=>0,scriptTimerSeconds:()=>0});
 let caches=[];
 try{
  g.start();for(let i=0;i<2200;i++)g.step();const counts={steps:0,drains:0,timestepWrites:0,gravityWrites:0};
  const step=g.world.step.bind(g.world),drain=g.events.drainCollisionEvents.bind(g.events),descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(g.world),'timestep');assert.ok(descriptor?.get&&descriptor?.set);
  g.world.step=(...args)=>{counts.steps++;return step(...args);};g.events.drainCollisionEvents=(...args)=>{counts.drains++;return drain(...args);};
  Object.defineProperty(g.world,'timestep',{configurable:true,get:()=>descriptor.get.call(g.world),set:value=>{counts.timestepWrites++;descriptor.set.call(g.world,value);}});
  for(const record of g.physicalRecords){assert.equal(record.body.gravityScale(),0);const set=record.body.setGravityScale.bind(record.body);record.body.setGravityScale=(...args)=>{counts.gravityWrites++;return set(...args);};}
  for(let i=0;i<100;i++)g.step();assert.equal(g.world.timestep,Math.fround(STEP));
  if(fallback){assert.ok(counts.steps>0);assert.equal(counts.drains,100);assert.ok(counts.timestepWrites>0);assert.ok(counts.gravityWrites>0);}
  else assert.deepEqual(counts,{steps:0,drains:0,timestepWrites:0,gravityWrites:0});
  assert.equal(g.nativeBallStorage.size,fallback?0:g.physicalRecords.length,'only bodies moved by the native integrator own caches');
  caches=[...g.nativeBallStorage];
 }finally{g.dispose();assert.equal(g.nativeBallStorage.size,0);assert.ok(caches.every(storage=>!storage.active));}
});
