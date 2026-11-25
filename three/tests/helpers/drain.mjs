import assert from 'node:assert/strict';

// Explicit physical approach for lifecycle tests. A synthetic Drain_Hit alone
// never gave the kicker ownership, which the real collision establishes.
export function drainForTest(game,records=[...game.records]){
  for(const record of records){
    for(const [key,value]of Object.entries({x:489.532,y:2040,z:25,velx:0,vely:8,velz:0}))record.proxy.setProperty(key,{type:'Single',value});
    for(let ms=0;ms<1000&&!record.removed;ms++)game.step();
    assert.equal(record.removed,true,'the original drain collider captures and removes the incoming ball');
  }
}
