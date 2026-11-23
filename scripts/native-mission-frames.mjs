// Read-only authored game state at the native animation-frame callback.
import assert from 'node:assert/strict';
export const missionFields={
  choosing:'Abs(CLng(bChooseBattle))',selected:'Battlenr',active:'Battle(CurrentPlayer,0)',
  ballsInHole:'BallsInHole',ballsOnPlayfield:'BallsOnPlayfield',score:'Score(CurrentPlayer)',
  battleReady:'Abs(CLng(bBattleReady))',skillShotReady:'Abs(CLng(bSkillShotReady))',
  player:'CurrentPlayer',ballNumber:'Balls',
  ...Object.fromEntries(Array.from({length:7},(_,i)=>['mission'+(i+1),`Battle(CurrentPlayer,${i+1})`])),
};
export function nativeMissionFrames(source){
  const handlers=source.match(/^Sub Target010_Timer\b[^\n]*\n[\s\S]*?^End Sub/gmi);
  assert.equal(handlers?.length,1,'Existing read-only frame observer');
  const original=handlers[0],logger=' If RefTraceOn Then Debug.Print "MISSION_FRAME|" & GameTime & "|" & '+Object.values(missionFields).map(expression=>'CStr(CDbl('+expression+'))').join(' & "|" & ')+'\n';
  const code=original.replace(/^End Sub/m,logger+'End Sub');
  assert.equal(code.replace(logger,''),original);
  return {code,fields:missionFields,scope:'Read-only authored mission variables after native animation updates at the existing diagnostic frame callback. No rule calls, game-state setters, timer/deadline changes or RNG consumption.'};
}
