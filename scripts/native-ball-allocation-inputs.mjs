// VPX chooses a reciprocal ball collision by native pointer comparison. The
// allocator's identities are environmental inputs, independent of BallS. This
// opt-in diagnostic must not silently turn body expectations into corrections.
import assert from 'node:assert/strict';

export function nativeBallAllocationInputs(fixture){
 const identities=new Map();
 const observe=row=>{
  const live=new Set();
  for(const ball of row.balls??[]){
   assert.ok(Number.isInteger(ball.id)&&ball.id>=0,'Native allocation has a ball ID');
   assert.ok(Number.isInteger(ball.address)&&ball.address>=65536&&ball.address<=0xffffffff&&ball.address%4===0,'Native allocation has a wasm32 address');
   assert.ok(!live.has(ball.address),'Live native balls have distinct allocations');live.add(ball.address);
   if(identities.has(ball.id))assert.equal(identities.get(ball.id),ball.address,'Native identity stays fixed for its lifetime');
   else identities.set(ball.id,ball.address);
  }
 };
 for(const row of fixture.startup?.records??[])observe(row);
 for(const row of fixture.startup?.boundaries??[])observe(row);
 for(const row of fixture.clock?.preparedFrames??[])observe(row);
 for(const frame of fixture.frames??[])observe(frame.snapshot);
 assert.ok(identities.size,'Native allocation identities were observed');
 return{format:'native-ball-allocation-inputs-v1',engineSHA256:fixture.engineSHA256,sourceTableSHA256:fixture.reference.sourceSha256,identities:[...identities].sort((a,b)=>a[0]-b[0]).map(([id,address])=>({id,address})),scope:'Explicit native allocator identities for reciprocal collision selection only. No position, velocity, momentum, orientation, lock state or RNG is supplied to the simulation. Equality with these inputs does not establish equality for a different allocator.'};
}

export function installNativeBallAllocationInputs(game,fixture,inputs){
 assert.equal(inputs.format,'native-ball-allocation-inputs-v1');assert.equal(inputs.engineSHA256,fixture.engineSHA256);assert.equal(inputs.sourceTableSHA256,fixture.reference.sourceSha256);
 const identities=new Map(),used=new Set();
 for(const{id,address}of inputs.identities){assert.ok(Number.isInteger(id)&&id>=0&&!identities.has(id),'One allocation per native identity');assert.ok(Number.isInteger(address)&&address>=65536&&address<=0xffffffff&&address%4===0,'Valid wasm32 allocation address');identities.set(id,address);}
 const assign=record=>{assert.ok(record,'Created ball is present in physics');assert.ok(identities.has(record.scriptID),'Every created ball has an explicit native allocation input');assert.ok(!used.has(record.scriptID),'A native identity is allocated once');game.nativeBall(record.body).order=identities.get(record.scriptID);used.add(record.scriptID);};
 for(const record of game.physicalRecords)assign(record);
 const spawn=game.spawn.bind(game);game.spawn=(...args)=>{const proxy=spawn(...args);assign(game.physicalRecords.find(record=>record.proxy===proxy));return proxy;};
 return()=>{assert.equal(used.size,identities.size,'Every supplied allocation identity was consumed');return used.size;};
}
