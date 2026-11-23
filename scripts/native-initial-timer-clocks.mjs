// Read-only callback clocks for the authored initial timers. Their flags,
// periods and scheduling remain under the original native implementation.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export function nativeInitialTimerClocks(source,observeSounds=false){
 const handlers=['GIUpdateTimer','FinniDmdAnimationTimer'].map(name=>{
  const matches=source.match(new RegExp('^Sub '+name+'_Timer\\b[^\\n]*\\n[\\s\\S]*?^End Sub','gmi'));assert.equal(matches?.length,1);const original=matches[0],at=original.indexOf('\n')+1,logger=` If RefTraceOn Then Debug.Print "CASE_TIMER|${name}|" & GameTime & "|" & Abs(CLng(${name}.Enabled)) & "|" & ${name}.Interval\n`,observed=original.slice(0,at)+logger+original.slice(at);assert.equal(observed.replace(logger,''),original);return {name,original,originalSHA256:createHash('sha256').update(original).digest('hex'),observed};
 });
 const pulse=`Sub PulseTimer_Timer
 If RefTraceOn Then Debug.Print "CASE_TIMER|PulseTimer|" & GameTime & "|" & Abs(CLng(PulseTimer.Enabled)) & "|" & PulseTimer.Interval
 If RefTraceOn Then Debug.Print "GAME_PULSE|" & GameTime & "|before"
 vpmTimer.Update
 If RefTraceOn Then Debug.Print "GAME_PULSE|" & GameTime & "|after"
End Sub`;
 const soundHandlers=observeSounds?['PlaySoundAt'].map(name=>{const matches=source.match(new RegExp('^Sub '+name+'\\([^\\n]*\\n[\\s\\S]*?^End Sub','gmi'));assert.equal(matches?.length,1);const original=matches[0],at=original.indexOf('\n')+1,logger=' If RefTraceOn Then Debug.Print "CASE_SOUND|" & GameTime & "|" & soundname\n',observed=original.slice(0,at)+logger+original.slice(at);assert.equal(observed.replace(logger,''),original);return {name,original,originalSHA256:createHash('sha256').update(original).digest('hex'),observed};}):[];
 return {code:handlers.map(h=>h.observed).concat(pulse,...soundHandlers.map(h=>h.observed)).join('\n'),handlers,soundHandlers,periods:{GIUpdateTimer:50,FinniDmdAnimationTimer:160,PulseTimer:40},scope:'Original unmodified native timer scheduler. Every authored GI/DMD handler statement retained with an entry logger only. The generated core PulseTimer handler retains its sole original vpmTimer.Update, with read-only entry and existing before/after markers. Optional PlaySoundAt entry logging retains its whole original body. No property writes, timer isolation, deadline, clock, body or RNG replacement. Actual relative callback clocks identify starting timer state; they are not fitted from trajectory or random output.'};
}
