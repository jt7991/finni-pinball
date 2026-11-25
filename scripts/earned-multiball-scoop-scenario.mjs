// Declared physical approaches earn the original three-lock multiball. All
// qualification, queued creation, capture and release remain authored rules.
export const earnedScoopFields={
  ms:'GameTime',hole:'BallsInHole',balls:'BallsOnPlayfield',choosing:'bChooseBattle',
  ready:'bBattleReady',mode:'Battle(CurrentPlayer,0)',multi:'bMultiBallMode',
  ninja:'bNinjaMB',locks:'BallsInLock(CurrentPlayer)',lockLit:'bLockEnabled',
  inLane:'bBallInPlungerLane',queued:'CLng(mBalls2Eject)',
  lockReleases:'EarnedQLockReleases',scoopHits:'EarnedQScoopHits',
  scoopKicks:'EarnedQScoopKicks',starts:'EarnedQStarts',generation:'FinniChooserGeneration',
  ids:'EarnedQIDs()'
};
export const earnedScoopBooleans=new Set(['choosing','ready','multi','ninja','lockLit','inLane']);
export const earnedScoopApproaches={
  lock:{x:811.675,y:608.7665,z:100.95452880859375,velx:0,vely:-8,velz:0,angmomx:0,angmomy:0,angmomz:0},
  scoop:{x:293.68433,y:530,z:25,velx:0,vely:-8,velz:0,angmomx:0,angmomy:0,angmomz:0}
};
export function observeEarnedScoop(source){
  const sub=(name,counter)=>{
    const original=source.match(new RegExp('^Sub '+name+'\\b[^\\n]*[\\s\\S]*?^End Sub','mi'))?.[0];
    if(!original)throw Error('Missing original '+name);
    const increment=`${counter}=${counter}+1`;
    return name==='kickBallOut'
      ?original.replace(/(If BallsinHole> 0 Then)/i,'$1\n    '+increment)
      :original.replace(/\n/,'\n    '+increment+'\n');
  };
  return `Dim EarnedQLockReleases,EarnedQScoopHits,EarnedQScoopKicks,EarnedQStarts
EarnedQLockReleases=0:EarnedQScoopHits=0:EarnedQScoopKicks=0:EarnedQStarts=0
Function EarnedQIDs()
 Dim all,ball,result
 result="":all=GetBalls()
 For Each ball In all:If ball.ID>=3 Then result=result&CStr(ball.ID)&","
 Next
 EarnedQIDs=result
End Function
${sub('ExitLock','EarnedQLockReleases')}
${sub('HellHouse_Hit','EarnedQScoopHits')}
${sub('kickBallOut','EarnedQScoopKicks')}
${sub('StartBattle','EarnedQStarts')}`;
}
export function earnedScoopPose(id,shot){
  const pose=earnedScoopApproaches[shot];if(!Number.isInteger(id)||!pose)throw Error('Invalid approach');
  return `Dim EarnedQAll,EarnedQBall:EarnedQAll=GetBalls():For Each EarnedQBall In EarnedQAll:If EarnedQBall.ID=${id} Then:`+
    Object.entries(pose).map(([key,value])=>`EarnedQBall.${key}=${value}`).join(':')+':End If:Next';
}
export async function runEarnedScoop({read,execute,input,advance,assert}){
  const rows=[],actions=[];
  const observe=async phase=>{const state=await read();rows.push({phase,...state});return state;};
  const wait=async(predicate,label,limit=12000)=>{
    const initial=await read();let state=initial;
    for(let n=0;n<limit/10+50;n++){
      if(predicate(state))return state;
      if(state.ms-initial.ms>limit)break;
      await advance(10);state=await read();
    }
    throw Error(label+' timed out: '+JSON.stringify(state));
  };
  const delay=async ms=>{const start=(await read()).ms;await wait(s=>s.ms-start>=ms,'delay '+ms,ms+2000);};
  const pose=async(id,shot)=>{
    const state=await read(),statement=earnedScoopPose(id,shot);
    actions.push({kind:'approach',ms:state.ms,id,shot,pose:earnedScoopApproaches[shot],statement});await execute(statement);
  };
  const press=async action=>{actions.push({kind:'button',ms:(await read()).ms,action});await input(action,true);await input(action,false);};
  let state=await observe('launched');assert.equal(state.balls,1);assert.equal(state.lockLit,true);
  const first=state.ids[0];assert.ok(first>=3);
  for(let i=1;i<=3;i++){
    await pose(first,'lock');
    await wait(s=>i===3?s.ninja:s.locks===i,'physical lock '+i);
    await observe('lock-'+i);await wait(s=>s.lockReleases===i,'original lock release '+i,4500);
  }
  state=await wait(s=>s.balls===3&&s.queued===0&&!s.inLane,'authored multiball queue',15000);
  assert.equal(state.ninja,true);assert.equal(state.multi,true);assert.equal(state.lockLit,false);
  assert.equal(state.ids.length,3);await observe('earned-multiball');
  for(const id of state.ids){const count=(await read()).hole;await pose(id,'scoop');await wait(s=>s.hole===count+1,'physical scoop capture');await delay(80);}
  state=await observe('chooser-holds-three');assert.equal(state.hole,3);assert.equal(state.choosing,true);assert.equal(state.scoopKicks,0);assert.equal(state.ids.length,0);
  await delay(2300);
  // A whole burst uses one execute packet, retaining ordinary key handlers.
  const left='Table1_KeyDown LeftFlipperKey:Table1_KeyUp LeftFlipperKey',right='Table1_KeyDown RightFlipperKey:Table1_KeyUp RightFlipperKey',action='Table1_KeyDown LockBarKey:Table1_KeyUp LockBarKey';
  const burst=Array.from({length:30},(_,i)=>i%2?left:right).concat(Array(30).fill(action)).join(':');
  actions.push({kind:'key-burst',ms:(await read()).ms,statement:burst});await execute(burst);
  state=await observe('confirmed-once');assert.equal(state.choosing,false);assert.equal(state.mode,1);assert.equal(state.starts,1);assert.equal(state.generation,1);
  const confirmed=state.ms;await delay(2200);state=await observe('authored-delay');assert.equal(state.hole,3);assert.equal(state.scoopKicks,0);
  state=await wait(s=>s.hole===0&&s.scoopKicks===3,'three original delayed ejections',2500);
  assert.ok(state.ms-confirmed>=2900);assert.equal(state.starts,1);assert.equal(state.ids.length,3);await observe('released-three');
  // The authored queue schedules one more 350ms callback after its last ball.
  // Let that empty callback finish before isolating ordinary active-mode entry.
  // Approaches explicitly supply zero spin, including after the earlier kicks.
  await delay(450);
  const incoming=(await read()).ids.slice(0,2);
  for(const id of incoming){const count=(await read()).hole;await pose(id,'scoop');await wait(s=>s.hole===count+1,'active-mode physical scoop capture');await delay(80);}
  state=await observe('active-mode-holds-two');assert.equal(state.choosing,false);assert.equal(state.mode,1);assert.equal(state.hole,2);
  await press('action');state=await wait(s=>s.hole===0&&s.scoopKicks===5,'active-mode ejections',3500);
  assert.equal(state.choosing,false);assert.equal(state.starts,1);assert.equal(state.generation,1);
  await observe('active-mode-released');return{rows,actions};
}
