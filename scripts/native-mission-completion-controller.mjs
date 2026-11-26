// Controlled physical shots exercise full authored counters. These are
// external pose inputs, not natural player qualification or body corrections.
import {nativeSurfaceHeight} from '../three/native-ramp.js';
export function missionCompletionScenario(objects,mission=1){
 if(![1,2,3,4,5,6].includes(mission))throw Error('Completion coverage currently supports missions 1 through 6');
 const target=objects.find(s=>s.name==='Target001'),angle=target.rot_z*Math.PI/180,normal={x:-Math.sin(angle),y:Math.cos(angle)},front=Math.max(...target.collision_mesh.vertices.map(v=>v[1]))*target.size.y;
 const trigger=(name,side='below')=>{const s=objects.find(s=>s.name===name),surface=objects.find(p=>p.name===s.surface),left=side==='left',above=side==='above',x=left?Math.min(...s.drag_points.map(p=>p.x))-25.01:s.center.x,y=left?s.center.y:above?Math.min(...s.drag_points.map(p=>p.y))-25.01:Math.max(...s.drag_points.map(p=>p.y))+25.01;return{x,y,z:25+(surface?nativeSurfaceHeight(surface,x,y):0),vx:left?8:0,vy:left?0:above?8:-8,vz:0};};
 const approach=(name,dx,dy)=>{const s=objects.find(p=>p.name===name),surface=objects.find(p=>p.name===s.surface),distance=s.radius+25.01,x=s.center.x+dx*distance,y=s.center.y+dy*distance;return{x,y,z:25+(surface?nativeSurfaceHeight(surface,x,y):0),vx:-dx*8,vy:-dy*8,vz:0};};
 const bumper=name=>{const s=objects.find(p=>p.name===name),direction=name==='Bumper2'?-1:1;return{x:s.center.x+direction*(s.radius+25.01),y:s.center.y,z:25,vx:-direction*8,vy:0,vz:0};};
 const targetApproach=name=>{const s=objects.find(p=>p.name===name),angle=s.rot_z*Math.PI/180,normal={x:-Math.sin(angle),y:Math.cos(angle)},front=Math.max(...s.collision_mesh.vertices.map(v=>v[1]))*s.size.y;return{x:s.position.x+normal.x*(front+25.01),y:s.position.y+normal.y*(front+25.01),z:25,vx:-normal.x*8,vy:-normal.y*8,vz:0};};
 const launchSensor=objects.find(s=>s.name.toLowerCase()==='swplungerrest');
 const cross=objects.find(s=>s.name==='Trigger015'),clearance=(...names)=>{const points=names.flatMap(name=>objects.find(p=>p.name===name).drag_points);return{minX:Math.min(...points.map(p=>p.x))-27,maxX:Math.max(...points.map(p=>p.x))+27,minY:Math.min(...points.map(p=>p.y))-27,maxY:Math.max(...points.map(p=>p.y))+27};};
 return{mission,shotInterval:800,shots:{
  scoop:{x:293.68433,y:530,z:25,vx:0,vy:-8,vz:0},
  target:{x:target.position.x+normal.x*(front+25.01),y:target.position.y+normal.y*(front+25.01),z:25,vx:-normal.x*8,vy:-normal.y*8,vz:0},
  loop:trigger('Trigger010'),ramp:mission===2||mission>=4?approach('Trigger012',-Math.SQRT1_2,-Math.SQRT1_2):trigger('Trigger012'),rightRamp:trigger('Trigger013'),rightLoop:trigger('Trigger009'),
  wolverine:trigger('Trigger014','left'),cross:approach(cross.name,-1,0),
  ...Object.fromEntries(['Bumper1','Bumper2','Bumper3'].map(name=>[name,bumper(name)])),
  ...(mission>=4?{colossus:trigger('Trigger011','above'),outerLoop:trigger('Trigger005'),...Object.fromEntries(['Target001','Target002','Target003','Target004'].map(name=>[name,targetApproach(name)]))}:{}),
  ...(mission>=4?{loopExit:{...objects.find(s=>s.name==='Trigger010').center,z:25,vx:0,vy:8,vz:0}}:{}),
  ...(mission>=6?{plungerExit:{...launchSensor.center,z:25,vx:0,vy:-25,vz:0}}:{}),
 },routes:{wolverine:['Trigger014'],ramp:['Trigger012'],cross:['Trigger015']},clearance:{wolverine:clearance('Trigger014'),ramp:clearance('Trigger012'),cross:clearance(cross.name),...(mission>=4?{loop:clearance('Trigger010'),colossus:clearance('Trigger011'),outerLoop:clearance('Trigger005')}: {}),...(mission>=6?{plunger:{maxY:launchSensor.center.y-launchSensor.radius-27}}:{})
 },fields:{active:'Battle(CurrentPlayer,0)',choosing:'Abs(CLng(bChooseBattle))',selected:'Battlenr',choices:'BattlesToChoose',won:'BattlesWon(CurrentPlayer)',score:'Score(CurrentPlayer)',endJackpot:'Abs(CLng(bEndBattleJackpot))',inHole:'BallsInHole',inLane:'Abs(CLng(bBallInPlungerLane))',playing:'Abs(CLng(bGameInPlay))',attack:'AttackPower',wolverine:'WolverineValue',jackpot:'Jackpot(CurrentPlayer)',
 ...Object.fromEntries(Array.from({length:7},(_,i)=>['life'+(i+1),`LifeLeft(CurrentPlayer,${i+1})`])),
 ...Object.fromEntries(Array.from({length:7},(_,i)=>['mission'+(i+1),`Battle(CurrentPlayer,${i+1})`])),
 ...Object.fromEntries(Array.from({length:6},(_,i)=>['shot'+(i+1),`BattleLights(${i+1})`])),
 scriptRandom:'CLng(Rnd(0)*16777216)',
 ...(mission>=3?{bumperHits:'BumperHits(CurrentPlayer)',balloonState:'li001.State'}:{}),
 ...(mission>=4?{ready:'Abs(CLng(bBattleReady))',player:'CurrentPlayer',ball:'Balls',...Object.fromEntries(Array.from({length:4},(_,i)=>['dead'+(i+1),`Dead(CurrentPlayer,${i+1})`]))}:{}),
 ...(mission>=5?{megaJackpot:'MegaJackpot(CurrentPlayer)',megaCount:'MegaSuperJCount',megaSuperValue:'MegaSuperJValue'}:{}),
 ...(mission>=6?{multi:'Abs(CLng(bMultiBallMode))',onPlayfield:'BallsOnPlayfield',pinataSuper:'li069.State',queued:'mBalls2Eject'}:{}),
 },scope:'Original initialization and physical launch, declared scoop/target/lane approaches, original chooser keys, full remaining counter and physical jackpot scoop. No direct hit/completion handler calls, progress/qualification setters, timer changes or RNG overrides. Ball placement inputs are explicit; this is not natural player completion. Rnd(0) observes script state without advancing it.'+(mission>=4?' Missions '+Array.from({length:mission-1},(_,i)=>i+1).join(', ')+' are completed first; physical DEAD target-bank hits qualify each subsequent chooser and earn its unlock through original rules.':'')};
}

export function partyFinaleScenario(objects){
 const scenario=missionCompletionScenario(objects,6);
 return{...scenario,finale:true,fields:{...scenario.fields,firstBattle:'Abs(CLng(bFirstBattle(CurrentPlayer)))',finaleEnabled:'Abs(CLng(MrSinisterTimer.Enabled))',finaleInterval:'MrSinisterTimer.Interval',dazzler:'dazzlerValue'},scope:scenario.scope+' After six actual wins and scoop jackpots, physically qualify the next chooser and select mission 7. Observe its original timer and round reset without supplying a seventh win, progress, timer or RNG result. This is finale entry/exit coverage, not a claim of mission-7 victory.'};
}

export function partyFinaleVictoryScenario(objects,approachSpeed=128){
 if(!Number.isFinite(approachSpeed)||approachSpeed<128||approachSpeed>512)throw Error('Finale approach speed must be between 128 and 512');
 const scenario=partyFinaleScenario(objects),fast=(name)=>{const shot=scenario.shots[name],speed=Math.hypot(shot.vx,shot.vy);return{...shot,vx:shot.vx/speed*approachSpeed,vy:shot.vy/speed*approachSpeed};};
 return{...scenario,completeFinale:true,shots:{...scenario.shots,finaleLoop:fast('loop'),finaleWolverine:fast('wolverine'),finaleColossus:fast('colossus'),finaleOuterLoop:fast('outerLoop')},fields:{...scenario.fields,special:'li039.State'},scope:scenario.scope.replace('Observe its original timer and round reset without supplying a seventh win, progress, timer or RNG result. This is finale entry/exit coverage, not a claim of mission-7 victory.','Within the unchanged120ms timer, declare fast physical approaches to the currently lit shots. Observe the seventh win, original round reset, Special light and physical scoop jackpot without supplying progress, completion callbacks, timer values or RNG results. These explicit pose/velocity inputs are controlled collision coverage, not natural player completion.')};
}

export function partyNextRoundScenario(objects,throughMission=1,finaleApproachSpeed=128){
 if(!Number.isInteger(throughMission)||throughMission<1||throughMission>6)throw Error('Next-round counter coverage supports missions 1 through 6');
 const scenario=partyFinaleVictoryScenario(objects,finaleApproachSpeed);
 return{...scenario,continueRound:true,...(throughMission>1?{nextRoundThrough:throughMission}:{}),fields:{...scenario.fields,credits:'Credits'},scope:scenario.scope+' After the seventh win, physically collect Special at the Colossus loop, collect the scoop jackpot, qualify a fresh chooser and complete '+(throughMission===1?'mission1':'missions 1 through '+throughMission)+' again at the authored reduced attack power. Observe credits, counters and the '+(7+throughMission)+' earned wins without supplying their values.'};
}

export function installMissionCompletionController(scenario){
 const data=window.nativeMissionCompletionController={scenario,stage:'lane',actions:[],errors:[],completed:false};
 const missions=scenario.continueRound?Array.from({length:7+(scenario.nextRoundThrough??1)},(_,i)=>i%7+1):scenario.finale?[1,2,3,4,5,6,7]:scenario.mission>=4?Array.from({length:scenario.mission},(_,i)=>i+1):[scenario.mission];let missionIndex=0,mission=missions[0];
 if(missions.length>1)data.completions=[];
 let pullAt=0,confirmedAt=0,lastShot=-Infinity,lastQuery=-Infinity,winScore,pendingShot,pendingLoopExit,pendingPlungerExit,pendingFinaleShot,plungerPrimed=false,arrowIndex=0;const usedArrows=new Set();
 const execute=(kind,script)=>{const row={kind,script,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()};data.actions.push(row);finni.evaluate(script);return row;};
 execute('declarations','Dim RefCompletionBalls,RefCompletionBall');
 const query=()=>{
  const names=Object.keys(scenario.fields),expressions=Object.values(scenario.fields),script='Debug.Print "MISSION_COMPLETION|" & GameTime & "|" & '+[...expressions.map(e=>'CStr(CDbl('+e+'))'),...expressions.map(e=>'CStr(VarType('+e+'))')].join(' & "|" & ');
  execute('query',script);const lines=document.getElementById('log').textContent.split('\n'),line=lines.findLast(s=>s.includes('MISSION_COMPLETION|'));if(!line)throw Error('Missing native rule observation');
  data.lastQueryLine=line;const payload=/MISSION_COMPLETION\|([\d.eE+|\-]+)/.exec(line);if(!payload)throw Error('Invalid native rule marker');const numbers=payload[1].split('|').map(Number),ms=numbers.shift();if(numbers.length!==names.length*2||numbers.some(v=>!Number.isFinite(v)))throw Error('Invalid native rule observation: '+JSON.stringify({line,expected:names.length*2,numbers}));const values=numbers.slice(0,names.length),types=numbers.slice(names.length);
  const input=nativePlayerInputs.at(-1);if(input.script!==script)throw Error('Rule observation input lost its identity');if(ms!==input.ms)throw Error('Native mission-completion marker is stale');input.ruleState={names,expressions,values,types,ms};
  return Object.fromEntries(names.map((name,i)=>[name,values[i]]));
 };
 const key=(name,down)=>execute('key',`Table1_Key${down?'Down':'Up'} ${name}`);
 const place=(name,ballID)=>{
  const body=nativeStartup.read().balls.findLast(ball=>ball.id>=3&&!ball.locked&&(ballID===undefined||ball.id===ballID));if(!body)return false;
  const p=scenario.shots[name],properties={X:p.x,Y:p.y,Z:p.z,VelX:p.vx,VelY:p.vy,VelZ:p.vz,AngMomX:0,AngMomY:0,AngMomZ:0};
  execute('shot',`RefCompletionBalls=GetBalls():For Each RefCompletionBall In RefCompletionBalls:If RefCompletionBall.ID=${body.id} Then:${Object.entries(properties).map(([k,v])=>`RefCompletionBall.${k}=${v}`).join(':')}:End If:Next`);
  Object.assign(data.actions.at(-1),{shot:name,ballID:body.id,pose:p,...(missions.length>1?{mission}:{})});lastShot=nativeStartup.read().ms;return true;
 };
 const finaleShot=state=>{
  const choices={1:['finaleLoop','loop'],3:['finaleColossus','colossus'],4:['finaleWolverine','wolverine'],6:['finaleOuterLoop','outerLoop']},arrow=Object.keys(choices).find(n=>state['shot'+n]===2);if(!arrow)throw Error('No lit finale shot');const[name,clearance]=choices[arrow];
  if(place(name))pendingFinaleShot={name,clearance,life:state.life7,ballID:data.actions.at(-1).ballID,ms:lastShot};
 };
 const timer=setInterval(()=>{
  try{
   if(nativeGameplay.done||data.completed){clearInterval(timer);return;}
   const ms=nativeStartup.read()?.ms;if(ms===undefined)return;
   if(data.stage==='lane'){
    if(!document.body.classList.contains('ball-in-plunger'))return;
    key('PlungerKey',true);pullAt=ms;data.stage='charging';return;
   }
   if(data.stage==='charging'){if(ms-pullAt>=600){key('PlungerKey',false);data.stage='exit';}return;}
   if(data.stage==='exit'){if(document.body.classList.contains('ball-in-plunger'))return;if(place('scoop'))data.stage='chooser';return;}
   if(ms-lastQuery<(scenario.completeFinale&&data.stage==='finale'?1:100))return;lastQuery=ms;const state=query();data.last=state;
   if(data.stage==='qualify'){
    // Earlier approach teleports can leave the source launch-lane flag set.
    // Physically clear its switch before qualifying multiball, then let the
    // authored launcher release its queued balls without moving them away.
    if(mission===6&&!plungerPrimed){
     if(pendingPlungerExit){
      const body=nativeStartup.read().balls.find(ball=>ball.id===pendingPlungerExit.ballID);
      if(!body)throw Error('Plunger-exit ball drained before qualification');
      if(state.inLane||ms-pendingPlungerExit.ms<80||body.position[1]>=scenario.clearance.plunger.maxY)return;
      (data.plungerExits??=[]).push({ballID:body.id,ms,position:body.position,inLane:state.inLane});plungerPrimed=true;pendingPlungerExit=undefined;return;
     }
     if(!state.inLane){plungerPrimed=true;return;}
     if(state.inHole||ms-lastShot<scenario.shotInterval)return;
     if(place('plungerExit'))pendingPlungerExit={ballID:data.actions.at(-1).ballID,ms};return;
    }
    if(state.inHole||ms-lastShot<scenario.shotInterval)return;
    if(state.ready){if(place('scoop'))data.stage='chooser';}
    else{const target=[1,2,3,4].find(i=>state['dead'+i]===0);if(target)place('Target00'+target);}
    return;
   }
   if(data.stage==='chooser'){
    if(!state.choosing)return;
    if(state.selected!==mission){key('RightFlipperKey',true);key('RightFlipperKey',false);return;}
    key('LockBarKey',true);key('LockBarKey',false);confirmedAt=ms;
    if(mission===7&&scenario.finale){
     const entry=query();if(entry.active!==7||entry.won!==6||!entry.finaleEnabled)throw Error('Finale entry did not follow the six earned wins');
     data.finale={enteredAt:nativePlayerInputs.at(-1).ruleState.ms,entry};data.stage='finale';if(scenario.completeFinale)finaleShot(entry);
    }else{
     data.stage='active';if(scenario.continueRound&&missionIndex>=7){const entry=query();if(entry.attack!==1||entry.firstBattle!==0||entry['life'+mission]!==10||entry.won!==missionIndex)throw Error('New round did not retain the authored harder mission');const observation={mission,enteredAt:nativePlayerInputs.at(-1).ruleState.ms,entry};if(missionIndex===7)data.hardRound={enteredAt:observation.enteredAt,entry};if(scenario.nextRoundThrough)(data.harderMissions??=[]).push(observation);}
    }return;
   }
   if(data.stage==='finale'){
    if(scenario.completeFinale){
     if(state.won===7&&state.active===0){
      if(state.finaleEnabled||state.firstBattle!==0||state.special!==2||![1,2,3,4,5,6,7].every(n=>state['life'+n]===10&&state['mission'+n]===0)||!state.endJackpot)throw Error('Seventh victory missed the authored reset or Special award');
      Object.assign(data.finale,{win:state,wonAt:nativePlayerInputs.at(-1).ruleState.ms,outcome:'native-victory'});winScore=state.score;
      if(scenario.continueRound){data.specialAward={before:state,creditsBefore:state.credits};data.stage='special';}else data.stage='jackpot';return;
     }
     if(state.active!==7||!state.finaleEnabled)throw Error('Native finale expired before the physical victory');
     if(pendingFinaleShot){
      if(state.life7>=pendingFinaleShot.life)return;
      const body=nativeStartup.read().balls.find(b=>b.id===pendingFinaleShot.ballID),bounds=scenario.clearance[pendingFinaleShot.clearance];
      if(body){const[x,y]=body.position;if(x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY)return;}
      (data.finale.physicalExits??=[]).push({...pendingFinaleShot,observedAt:ms,position:body?.position,life:state.life7});pendingFinaleShot=undefined;
     }
     if(ms>lastShot)finaleShot(state);return;
    }
    if(state.active!==0||state.finaleEnabled)return;
    if(![1,2,3,4,5,6,7].every(n=>state['life'+n]===10&&state['mission'+n]===0)||state.firstBattle!==0)throw Error('Finale exited without the authored new-round reset');
    data.finale.exit=state;data.finale.exitedAt=nativePlayerInputs.at(-1).ruleState.ms;data.finale.outcome=state.won>data.finale.entry.won?'native-victory':'native-timer-expiry';data.completed=true;data.completedAt=ms;data.stage='finale-observed';return;
   }
   if(data.stage==='special'){
    if(state.special===0&&state.credits===data.specialAward.creditsBefore+1){Object.assign(data.specialAward,{after:state,collectedAt:nativePlayerInputs.at(-1).ruleState.ms});data.stage='jackpot';return;}
    if(state.credits>data.specialAward.creditsBefore+1)throw Error('Special awarded duplicate credits');
    if(ms-lastShot<scenario.shotInterval&&data.specialAward.approach)return;
    const body=nativeStartup.read().balls.findLast(b=>b.id>=3&&!b.locked),bounds=scenario.clearance.colossus;if(!body)return;const[x,y]=body.position;if(x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY)return;
    if(place('colossus',body.id))data.specialAward.approach={ms,ballID:body.id,from:body.position};return;
   }
   if(data.stage==='active'){
    const life=state['life'+mission];
    if(state.won===missionIndex+1&&state['mission'+mission]===1&&life<=0&&state.active===0&&state.endJackpot){if(scenario.continueRound&&missionIndex===7)Object.assign(data.hardRound,{win:state,wonAt:nativePlayerInputs.at(-1).ruleState.ms});if(scenario.nextRoundThrough&&missionIndex>=7)Object.assign(data.harderMissions.at(-1),{win:state,wonAt:nativePlayerInputs.at(-1).ruleState.ms});winScore=state.score;data.stage='jackpot';return;}
    if(state.active!==mission||ms-confirmedAt<3200)return;
    const harder=!!scenario.continueRound&&missionIndex>=7;
    if(harder&&mission===1&&life>6){if(ms-lastShot>=scenario.shotInterval)place('target');return;}
    if(mission===6&&(state.queued>0||state.inLane))return;
    if(mission===3){
     if(ms-lastShot>=scenario.shotInterval)place(['Bumper1','Bumper2','Bumper3'][arrowIndex++%3]);
    }else if(mission===2||mission>=4||harder){
     if(pendingLoopExit){
      const body=nativeStartup.read().balls.find(ball=>ball.id===pendingLoopExit.ballID),bounds=scenario.clearance.loop;
      if(!body)throw Error('Loop-exit ball drained before its declared approach');
      const [x,y]=body.position;if(ms-pendingLoopExit.ms<80||x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY)return;
      (data.loopExits??=[]).push({ballID:body.id,ms,position:body.position,life});
      if(place('loop',body.id)){pendingShot={name:'loop',life,ballID:body.id};pendingLoopExit=undefined;}
      return;
     }
     if(pendingShot){
      if(life>=pendingShot.life)return;
      const body=nativeStartup.read().balls.find(ball=>ball.id===pendingShot.ballID),bounds=scenario.clearance[pendingShot.name];
      if(body){const [x,y]=body.position;if(x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY)return;}
      (data.physicalExits??=[]).push({shot:pendingShot.name,ballID:pendingShot.ballID,ms,frameIndex:nativeStartup.frameIndex(),position:body?.position,life});pendingShot=undefined;
     }
     if(ms-lastShot<scenario.shotInterval)return;
     const arrows=mission>=4||harder?{1:'loop',2:'ramp',3:'colossus',4:'wolverine',5:'cross',6:'outerLoop'}:{2:'ramp',4:'wolverine',5:'cross'},available=Object.keys(arrows).filter(n=>state['shot'+n]===2);if(!available.length)return;
     const next=available[arrowIndex++%available.length],name=arrows[next];
     // A teleport does not clear VPX volume membership. Supply a downward
     // physical exit before the next upward left-loop entry instead.
     if((mission>=4||harder)&&name==='loop'){if(place('loopExit'))pendingLoopExit={ballID:data.actions.at(-1).ballID,ms};}
     else if(place(name))pendingShot={name,life,ballID:data.actions.at(-1).ballID};
    }else if(ms-lastShot>=scenario.shotInterval){
     if(life>6)place('target');
     else{const arrows={1:'loop',2:'ramp',4:'rightRamp',6:'rightLoop'},next=Object.keys(arrows).find(n=>state['shot'+n]===2&&!usedArrows.has(n));if(next&&place(arrows[next]))usedArrows.add(next);}
    }
    return;
   }
   if(data.stage==='jackpot'){
    if(state.endJackpot===0&&state.score>=winScore+3000000){
     if(data.completions)data.completions.push({mission,ms,score:state.score,won:state.won,choices:state.choices});
     if(++missionIndex<missions.length){mission=missions[missionIndex];pendingShot=undefined;pendingLoopExit=undefined;usedArrows.clear();arrowIndex=0;if(scenario.nextRoundThrough&&mission===6)plungerPrimed=false;data.stage='qualify';}
     else{data.completed=true;data.stage='complete';data.completedAt=ms;}
     return;
    }
    if(state.inHole===0&&ms-lastShot>=scenario.shotInterval)place('scoop');
   }
  }catch(error){data.errors.push(String(error));clearInterval(timer);}
 },16);
}
