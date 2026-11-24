// Native Timer returns are external inputs, independent of body/RNG outcomes.
// Preserve the original RndNbr/Randomize/Rnd execution rather than restoring
// later random words to make two captures agree.
import assert from 'node:assert/strict';
export function replayReferenceScriptClocks(game,fixture,scenario){
 if(!scenario.scriptClocks)return null;
 assert.ok(fixture.runtimeScriptClockObserver,'Explicit native Timer observer provenance required');
 const origin=Math.round(game.time*1000),records=scenario.scriptClocks;let consumed=0;
 for(const row of records){assert.equal(row.type,4);assert.ok(Number.isInteger(row.ms)&&row.ms>=0);assert.ok(Number.isFinite(row.value));}
 game.rules.engine._getContext().functionRegistry.register('Timer',()=>{
  const row=records[consumed++];assert.ok(row,'Every replayed Timer call has an independent native observation');assert.equal(Math.round(game.time*1000)-origin,row.ms,'Timer executes at the recorded physical clock');
  return {type:'Single',value:row.value};
 },{minArgs:0,maxArgs:0});
 return {finish(milliseconds){const expected=records.filter(row=>row.ms<=milliseconds).length;assert.equal(consumed,expected,'Every native Timer return inside the comparison window is consumed');return {consumed,throughMilliseconds:milliseconds,recorded:records.length};}};
}
