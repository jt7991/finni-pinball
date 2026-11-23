// A declared diagnostic shot, after an ordinary physical launcher exit.
// The reset is a scenario input, never computed from an expected trajectory.
import assert from 'node:assert/strict';
export function nativeControlledShot(source,ms){
  assert.ok(Number.isInteger(ms)&&ms>600&&ms<=30000);
  const shot={ms,x:293.68433,y:530,z:25,vx:0,vy:-8,vz:0};
  const handlers=source.match(/^Sub LeftFlipper_Timer\b[^\n]*\n[\s\S]*?^End Sub/gmi);assert.equal(handlers?.length,1);
  const original=handlers[0],call='    RefShotAdvance\n',observed=original.replace(/\r?\n/,newline=>newline+call);assert.equal(observed.replace(call,''),original);
  const code=`Dim RefShotApplied
RefShotApplied=False
Sub RefShotAdvance
 If RefTraceOn And RefInputStart>=0 And Not RefShotApplied Then
  If GameTime-RefInputStart>=${ms} Then
   RefShotApplied=True
   Debug.Print "GAME_SHOT|" & GameTime & "|" & RefBall.ID & "|" & Abs(CLng(bBallInPlungerLane))
   RefBall.X=${shot.x}:RefBall.Y=${shot.y}:RefBall.Z=${shot.z}
   RefBall.VelX=${shot.vx}:RefBall.VelY=${shot.vy}:RefBall.VelZ=${shot.vz}
   RefBall.AngMomX=0:RefBall.AngMomY=0:RefBall.AngMomZ=0
  End If
 End If
End Sub
${observed}`;
  return {code,shot,scope:'Single declared controlled scoop approach at a fixed input clock after an ordinary physical launch. The real lane-exit flag is observed before the reset. This one pose is an explicit scenario input. No lane/switch/rule flags, physics clocks or random states are forced. Subsequent scoop, mission and multiball outcomes run without correction under original authored logic.'};
}
