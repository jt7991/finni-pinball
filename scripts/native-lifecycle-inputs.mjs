// A test player: ordinary authored key events only. No ball/rule/RNG setters.
import assert from 'node:assert/strict';
import {nativeInputSequence} from './native-input-sequence.mjs';
export function nativeLifecycleInputs(source){
 const driver=nativeInputSequence(source,[{ms:100,action:'launch',down:true}]);
 const original=driver.code.match(/^Sub RefInputAdvance\b[\s\S]*?^End Sub/m);assert.equal(original?.length,1);
 const code=`Dim RefLifeHolding,RefLifeRelease,RefLifeNext,RefLifeOver,RefLifeReplayed
RefLifeHolding=False:RefLifeRelease=0:RefLifeNext=100:RefLifeOver=-1:RefLifeReplayed=False
Sub RefLifeKey(ByVal action,ByVal down,ByVal key)
 Debug.Print "LIFECYCLE_INPUT|" & GameTime & "|" & RefInputIndex & "|" & action & "|" & Abs(CLng(down)) & "|" & key
 If down Then
  Table1_KeyDown key
 Else
  Table1_KeyUp key
 End If
 RefInputIndex=RefInputIndex+1
End Sub
Sub RefInputAdvance
 Dim elapsed
 If Not RefTraceOn Or RefInputStart<0 Then Exit Sub
 elapsed=GameTime-RefInputStart
 If elapsed<100 Then Exit Sub
 If hsbModeActive Then
  If elapsed>=RefLifeNext Then
   RefLifeKey "start",True,StartGameKey
   RefLifeKey "start",False,StartGameKey
   RefLifeNext=elapsed+300
  End If
 ElseIf Not bGameInPlay Then
  If RefLifeOver<0 Then RefLifeOver=elapsed
  If Not RefLifeReplayed And elapsed>=RefLifeOver+1000 Then
   RefLifeReplayed=True
   RefLifeKey "start",True,StartGameKey
   RefLifeKey "start",False,StartGameKey
   RefLifeNext=elapsed+100
  End If
 Else
  RefLifeOver=-1
  If bChooseBattle And elapsed>=RefLifeNext Then
   RefLifeKey "action",True,LockBarKey
   RefLifeKey "action",False,LockBarKey
   RefLifeNext=elapsed+1000
  ElseIf RefLifeHolding Then
   If elapsed>=RefLifeRelease Then
    RefLifeKey "launch",False,PlungerKey
    RefLifeHolding=False:RefLifeNext=elapsed+1000
   End If
  ElseIf bBallInPlungerLane And Not bAutoPlunger And elapsed>=RefLifeNext Then
   RefLifeKey "launch",True,PlungerKey
   RefLifeHolding=True:RefLifeRelease=elapsed+600
  End If
 End If
End Sub`;
 driver.code=driver.code.replace(original[0],code);driver.inputs=[];
 driver.lifecyclePolicy={initialWaitMilliseconds:100,launchHoldMilliseconds:600,nextLaunchDelayMilliseconds:1000,highScoreKeyDelayMilliseconds:300,replayDelayMilliseconds:1000,maxReplays:1,actions:['launch','start','action'],scope:'Reads authored in-lane, auto-plunger, chooser, game-in-play and high-score-entry flags; dispatches only original Table1_KeyDown/KeyUp. Confirms any offered mission with the ordinary Action key. Accepts the current high-score letters with the ordinary Start key, then starts one replay. No flippers held, ball placements, nudges, qualifications, clock/RNG writes or rescue calls.'};
 driver.scope+=' Conditional lifecycle player replaces only the generated RefInputAdvance body. Every executed key/down/clock is observed independently and becomes an external replay input.';
 return driver;
}
