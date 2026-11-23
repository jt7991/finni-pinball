// Diagnostic entry observer only: retain the original authored function and
// argument Variants. Native CASE_SOUND observes this same pre-body boundary.
import assert from 'node:assert/strict';
export function observeReferenceSoundCalls(game,fixture,scenario,origin){
 if(!scenario.soundCalls)return undefined;
 assert.ok(fixture.runtimeInitialTimerClocks.soundHandlers.some(handler=>handler.name==='PlaySoundAt'));
 const entry=game.rules.engine.interpreter.getContext().functionRegistry.get('PlaySoundAt');
 assert.ok(entry?.isUserDefined);const original=entry.func,calls=[];
 entry.func=function(args,...rest){
  assert.equal(args[0].type,'String');
  calls.push({ms:Math.round(game.time*1000)-origin,name:args[0].value});
  return original.call(this,args,...rest);
 };
 return calls;
}
