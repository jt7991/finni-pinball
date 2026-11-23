import assert from 'node:assert/strict';
import {KEY} from '../three/rules.js';

// Native SDL logical keys and this host's constants name the same authored
// actions. Replay at the observed timer entry, after earlier native timers.
export function replayReferenceInputs(game,fixture,scenario){
  const nativeKeys=new Map(),frames=new Map();let applied=0;
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
        for(const input of inputs){execute(`Table1_Key${input.down?'Down':'Up'} ${KEY[input.action]}`);applied++;}
      }
      return execute(statement,...args);
    };
  }
  return ()=>applied;
}
