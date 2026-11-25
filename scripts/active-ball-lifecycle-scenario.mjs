// Read-only observations inside the original scoop handler. The separate
// retained dispatch reference must survive even when global ActiveBall changes.
export const activeBallQueries=['ActiveQBefore','ActiveQAfter','ActiveQSaved','ActiveQAfterType','ActiveQSavedType','ActiveQRemaining','ActiveQCaptured'];
export function observeScoopActiveBall(source){
  const handler=source.match(/^Sub HellHouse_Hit\b[^\n]*[\s\S]*?^End Sub/mi)?.[0];
  if(!handler||[...handler.matchAll(/HellHouse\.destroyball/gi)].length!==1)throw Error('Original scoop destruction changed');
  return `Dim ActiveQRetained,ActiveQBefore,ActiveQAfter,ActiveQSaved,ActiveQAfterType,ActiveQSavedType,ActiveQRemaining,ActiveQCaptured
ActiveQCaptured=False
Function ActiveQIDs()
 Dim all,ball,result
 result="":all=GetBalls()
 For Each ball In all:result=result&CStr(ball.ID)&",":Next
 ActiveQIDs=result
End Function
${handler.replace(/HellHouse\.destroyball/i,`Set ActiveQRetained=ActiveBall
    ActiveQBefore=ActiveBall.ID
    HellHouse.destroyball
    ActiveQAfter=ActiveBall.ID
    ActiveQSaved=ActiveQRetained.ID
    ActiveQAfterType=VarType(ActiveBall.ID)
    ActiveQSavedType=VarType(ActiveQRetained.X)
    ActiveQRemaining=ActiveQIDs()
    ActiveQCaptured=True`)}`;
}
export const activeBallApproach='Dim ActiveQAll,ActiveQBall:ActiveQAll=GetBalls():For Each ActiveQBall In ActiveQAll:If ActiveQBall.ID=3 Then:ActiveQBall.X=293.68433:ActiveQBall.Y=530:ActiveQBall.Z=25:ActiveQBall.VelX=0:ActiveQBall.VelY=-8:ActiveQBall.VelZ=0:End If:Next';
export function verifyActiveBallObservation(values,assert){
  const ids=values.ActiveQRemaining.split(',').filter(Boolean).map(Number);
  assert.equal(values.ActiveQCaptured,true);assert.equal(values.ActiveQBefore,3);
  assert.ok(ids.length>=3);assert.ok(!ids.includes(values.ActiveQBefore));
  assert.equal(values.ActiveQAfter,ids[0],'native DestroyBall selects the first remaining physical ball');
  assert.equal(values.ActiveQSaved,values.ActiveQBefore,'a separately saved Ball dispatch retains the removed identity');
  assert.equal(values.ActiveQAfterType,3);assert.equal(values.ActiveQSavedType,4);
}
