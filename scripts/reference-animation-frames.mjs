// Replay independently recorded PrepareFrame clocks. A renderer frame can
// dispatch authored rules and draw physics randomness between two intervals.
import assert from 'node:assert/strict';
export function replayReferenceAnimationFrames(game,fixture,scenario){
 const rows=scenario.animationFrames;if(!rows?.length)return null;
 assert.ok(fixture.instrumentation?.animationFrameTrace,'Original frame observer provenance required');
 const names=fixture.instrumentation.animationFrameTrace.targets??['Target009','Target010','Target011'];
 const targets=names.map(name=>game.targetMotions.get(name.toLowerCase()));assert.ok(targets.every(Boolean));
 assert.ok(rows[0][0]>0,'A frame at the initial reset needs separately observed preparation state');
 for(let i=1;i<rows.length;i++)assert.equal(rows[i][0]-rows[i-1][0],rows[i][1],'Uninterrupted original animation clocks');
 game.frameAnimations=true;game.lastAnimationTime=Math.round(game.time*1000)+rows[0][0]-rows[0][1];let consumed=0;
 return {advance(milliseconds){
  while(rows[consumed]?.[0]===milliseconds){
   const row=rows[consumed];assert.equal(row.length,3+2*names.length);game.prepareFrame();
   const actual=[...targets.map(target=>target.offset),...targets.map(target=>Number(target.dropped)),game.rules.value('Score(CurrentPlayer)')],expected=row.slice(2).map((value,i)=>i<names.length?Math.fround(value):value);
   assert.deepEqual(actual,expected,'Original target poses, flags and score after PrepareFrame at '+milliseconds+'ms');consumed++;
  }
  assert.ok(!rows[consumed]||rows[consumed][0]>milliseconds,'No native frame clock skipped');
 },finish(milliseconds){const expected=rows.filter(row=>row[0]<=milliseconds).length;assert.equal(consumed,expected,'Every native frame inside the comparison window is prepared');return {consumed,throughMilliseconds:milliseconds,recorded:rows.length};}};
}
