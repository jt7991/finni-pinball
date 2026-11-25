// Public API inputs for an isolated occupied-kicker component. These extra
// balls deliberately do not enroll the authored BallsOnPlayfield counter.
export const creationQueries=['CreationBefore','CreationAfter','CreationRemoved','CreationFinal','VarType(CreationRemoved)'];
export function kickerCreationStatement(order){
  if(!['kick-destroy','destroy-kick'].includes(order))throw Error('Unknown kicker operation order');
  const kick='HellHouse.Kick 164,12,0',destroy='CreationRemoved=HellHouse.DestroyBall';
  return `Dim CreationFirst,CreationSecond,CreationBefore,CreationAfter,CreationRemoved,CreationFinal
Function CreationPose(ball)
 CreationPose=CStr(ball.ID)&","&CStr(ball.X)&","&CStr(ball.Y)&","&CStr(ball.Z)&","&CStr(ball.VelX)&","&CStr(ball.VelY)&","&CStr(ball.VelZ)
End Function
Function CreationState()
 Dim all,ball,ids
 ids="":all=GetBalls()
 For Each ball In all:ids=ids&CStr(ball.ID)&",":Next
 CreationState=CreationPose(CreationFirst)&";"&CreationPose(CreationSecond)&";"&ids
End Function
Set CreationFirst=HellHouse.CreateBall
Set CreationSecond=HellHouse.CreateBall
CreationBefore=CreationState()
${order==='kick-destroy'?kick:destroy}
CreationAfter=CreationState()
${order==='kick-destroy'?destroy:kick}
CreationFinal=CreationState()`;
}
export function decodeCreationState(value){
  const [first,second,ids]=value.split(';');
  return {first:first.split(',').map(Number),second:second.split(',').map(Number),ids:ids.split(',').filter(Boolean).map(Number)};
}
export function verifyCreationCase(row,assert){
  const before=decodeCreationState(row.values.CreationBefore),after=decodeCreationState(row.values.CreationAfter),final=decodeCreationState(row.values.CreationFinal);
  assert.deepEqual(before.first.slice(4),[0,0,0]);
  assert.deepEqual(before.second.slice(4),[.1,0,0],'a second CreateBall leaves the new ball free with its native initial velocity');
  assert.notEqual(before.first[0],before.second[0]);
  assert.equal(row.values['VarType(CreationRemoved)'],3);
  if(row.order==='kick-destroy'){
    assert.ok(Math.abs(after.first[4])>1,'Kick releases the original captured ball');
    assert.deepEqual(after.second,before.second,'Kick leaves the new free ball alone');
    assert.equal(row.values.CreationRemoved,0);
    assert.deepEqual(final,after);
  }else{
    assert.equal(row.values.CreationRemoved,1);
    assert.deepEqual(after.ids,before.ids.filter(id=>id!==before.first[0]));
    assert.deepEqual(after.second,before.second,'DestroyBall removes the original captured ball');
    assert.deepEqual(final,after,'Kick on the now empty kicker cannot claim the new free ball');
  }
  return {before,after,final};
}
