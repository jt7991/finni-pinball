// Read-only authored game state at the native animation-frame callback.
import assert from 'node:assert/strict';
export const missionFields={
  choosing:'Abs(CLng(bChooseBattle))',selected:'Battlenr',active:'Battle(CurrentPlayer,0)',
  ballsInHole:'BallsInHole',ballsOnPlayfield:'BallsOnPlayfield',score:'Score(CurrentPlayer)',
  battleReady:'Abs(CLng(bBattleReady))',skillShotReady:'Abs(CLng(bSkillShotReady))',
  player:'CurrentPlayer',ballNumber:'Balls',
  ...Object.fromEntries(Array.from({length:7},(_,i)=>['mission'+(i+1),`Battle(CurrentPlayer,${i+1})`])),
};
export function nativeMissionFrames(source,observeMultiball=false,observeNudges=false,observeDetails=false){
  const handlers=source.match(/^Sub Target010_Timer\b[^\n]*\n[\s\S]*?^End Sub/gmi);
  assert.equal(handlers?.length,1,'Existing read-only frame observer');
  const fields=observeMultiball?{...missionFields,
    battlesWon:'BattlesWon(CurrentPlayer)',choices:'BattlesToChoose',pendingBalls:'mBalls2Eject',
    multiball:'Abs(CLng(bMultiBallMode))',autoPlunger:'Abs(CLng(bAutoPlunger))',inLane:'Abs(CLng(bBallInPlungerLane))',
    saverReady:'Abs(CLng(bBallSaverReady))',saverActive:'Abs(CLng(bBallSaverActive))',saverTime:'BallSaverTime',
    ...Object.fromEntries(Array.from({length:6},(_,i)=>['shot'+(i+1),`BattleLights(${i+1})`])),
  }:{...missionFields};
  if(observeNudges)Object.assign(fields,{
    tilted:'Abs(CLng(Tilted))',tiltCount:'Tilt',tiltSensitivity:'TiltSensitivity',
    tiltRecovery:'Abs(CLng(TiltRecoveryTimer.Enabled))',playing:'Abs(CLng(bGameInPlay))',
  });
  if(observeDetails)Object.assign(fields,{
    ...Object.fromEntries(Array.from({length:7},(_,i)=>['life'+(i+1),`LifeLeft(CurrentPlayer,${i+1})`])),
    attackPower:'AttackPower',wolverineValue:'WolverineValue',dazzlerValue:'dazzlerValue',
    partyTimerEnabled:'Abs(CLng(MrSinisterTimer.Enabled))',partyTimerInterval:'MrSinisterTimer.Interval',
  });
  const original=handlers[0],logger=' If RefTraceOn Then Debug.Print "MISSION_FRAME|" & GameTime & "|" & '+Object.values(fields).map(expression=>'CStr(CDbl('+expression+'))').join(' & "|" & ')+'\n';
  const code=original.replace(/^End Sub/m,logger+'End Sub');
  assert.equal(code.replace(logger,''),original);
  return {code,fields,scope:'Read-only authored mission variables after native animation updates at the existing diagnostic frame callback. No rule calls, game-state setters, timer/deadline changes or RNG consumption.'};
}
