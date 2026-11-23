import assert from 'node:assert/strict';
import {KEY} from '../three/rules.js';

// Native SDL logical keys and this host's constants name the same authored
// actions. Replay at the observed timer entry, after earlier native timers.
export function replayReferenceInputs(game,fixture,scenario){
  const nativeKeys=new Map(),frames=new Map(),shots=[];let applied=0;
  for(const input of scenario.inputSequence??[]){
    assert.ok(Object.hasOwn(KEY,input.action)&&Number.isInteger(input.key));
    assert.equal(typeof input.down,'boolean');
    if(nativeKeys.has(input.action))assert.equal(input.key,nativeKeys.get(input.action));else nativeKeys.set(input.action,input.key);
    if(!frames.has(input.ms))frames.set(input.ms,[]);frames.get(input.ms).push(input);
  }
  if(scenario.inputSequence){
    assert.match(fixture.runtimeInputSequence.code,/Sub LeftFlipper_Timer\b[^\n]*\n\s+RefInputAdvance/);
    const origin=Math.round(game.time*1000),execute=game.rules.engine.executeStatementThrows.bind(game.rules.engine);
    game.rules.engine.executeStatementThrows=(statement,...args)=>{
      if(/^LeftFlipper_Timer\s*$/i.test(statement)){
        const ms=Math.round(game.time*1000)-origin,inputs=frames.get(ms)??[];frames.delete(ms);
        if(scenario.controlledShot?.ms===ms){
          const observed=scenario.controlledShot,shot=fixture.runtimeControlledShot.shot;
          assert.equal(shot.ms,ms);assert.equal(observed.inLane,0);assert.equal(!!game.rules.value('bBallInPlungerLane'),false,'Replay physically exited the launcher before the declared reset');
          const record=game.physicalRecords.find(record=>game.referenceBallID(record.proxy)===observed.id);assert.ok(record,'Declared shot operates on a live ball');
          for(const [key,value]of Object.entries({x:shot.x,y:shot.y,z:shot.z,velx:shot.vx,vely:shot.vy,velz:shot.vz,angmomx:0,angmomy:0,angmomz:0}))record.proxy[key]=value;
          shots.push({ms,id:observed.id,inLane:0});
        }
        for(const input of inputs){execute(`Table1_Key${input.down?'Down':'Up'} ${KEY[input.action]}`);applied++;}
      }
      return execute(statement,...args);
    };
  }
  const count=()=>applied;count.controlledShots=shots;return count;
}
