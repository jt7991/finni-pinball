// Controlled physical shots exercise full authored counters. These are
// external pose inputs, not natural player qualification or body corrections.
import {nativeSurfaceHeight} from '../three/native-ramp.js';
export function missionCompletionScenario(objects,mission=1){
 if(![1,2].includes(mission))throw Error('Completion coverage currently supports missions 1 and 2');
 const target=objects.find(s=>s.name==='Target001'),angle=target.rot_z*Math.PI/180,normal={x:-Math.sin(angle),y:Math.cos(angle)},front=Math.max(...target.collision_mesh.vertices.map(v=>v[1]))*target.size.y;
 const trigger=(name,side='below')=>{const s=objects.find(s=>s.name===name),surface=objects.find(p=>p.name===s.surface),left=side==='left',above=side==='above',x=left?Math.min(...s.drag_points.map(p=>p.x))-25.01:s.center.x,y=left?s.center.y:above?Math.min(...s.drag_points.map(p=>p.y))-25.01:Math.max(...s.drag_points.map(p=>p.y))+25.01;return{x,y,z:25+(surface?nativeSurfaceHeight(surface,x,y):0),vx:left?8:0,vy:left?0:above?8:-8,vz:0};};
 const approach=(name,dx,dy)=>{const s=objects.find(p=>p.name===name),surface=objects.find(p=>p.name===s.surface),distance=s.radius+25.01,x=s.center.x+dx*distance,y=s.center.y+dy*distance;return{x,y,z:25+(surface?nativeSurfaceHeight(surface,x,y):0),vx:-dx*8,vy:-dy*8,vz:0};};
 const cross=objects.find(s=>s.name==='Trigger015'),clearance=(...names)=>{const points=names.flatMap(name=>objects.find(p=>p.name===name).drag_points);return{minX:Math.min(...points.map(p=>p.x))-27,maxX:Math.max(...points.map(p=>p.x))+27,minY:Math.min(...points.map(p=>p.y))-27,maxY:Math.max(...points.map(p=>p.y))+27};};
 return{mission,shotInterval:800,shots:{
  scoop:{x:293.68433,y:530,z:25,vx:0,vy:-8,vz:0},
  target:{x:target.position.x+normal.x*(front+25.01),y:target.position.y+normal.y*(front+25.01),z:25,vx:-normal.x*8,vy:-normal.y*8,vz:0},
  loop:trigger('Trigger010'),ramp:mission===2?approach('Trigger012',-Math.SQRT1_2,-Math.SQRT1_2):trigger('Trigger012'),rightRamp:trigger('Trigger013'),rightLoop:trigger('Trigger009'),
  wolverine:trigger('Trigger014','left'),cross:approach(cross.name,-1,0),
 },routes:{wolverine:['Trigger014'],ramp:['Trigger012'],cross:['Trigger015']},clearance:{wolverine:clearance('Trigger014'),ramp:clearance('Trigger012'),cross:clearance(cross.name)
 },fields:{active:'Battle(CurrentPlayer,0)',choosing:'Abs(CLng(bChooseBattle))',selected:'Battlenr',choices:'BattlesToChoose',won:'BattlesWon(CurrentPlayer)',score:'Score(CurrentPlayer)',endJackpot:'Abs(CLng(bEndBattleJackpot))',inHole:'BallsInHole',inLane:'Abs(CLng(bBallInPlungerLane))',playing:'Abs(CLng(bGameInPlay))',attack:'AttackPower',wolverine:'WolverineValue',jackpot:'Jackpot(CurrentPlayer)',
 ...Object.fromEntries(Array.from({length:7},(_,i)=>['life'+(i+1),`LifeLeft(CurrentPlayer,${i+1})`])),
 ...Object.fromEntries(Array.from({length:7},(_,i)=>['mission'+(i+1),`Battle(CurrentPlayer,${i+1})`])),
 ...Object.fromEntries(Array.from({length:6},(_,i)=>['shot'+(i+1),`BattleLights(${i+1})`])),
 scriptRandom:'CLng(Rnd(0)*16777216)',
 },scope:'Original initialization and physical launch, declared scoop/target/lane approaches, original chooser keys, full remaining counter and physical jackpot scoop. No direct hit/completion handler calls, progress/qualification setters, timer changes or RNG overrides. Ball placement inputs are explicit; this is not natural player completion. Rnd(0) observes script state without advancing it.'};
}

export function installMissionCompletionController(scenario){
 const data=window.nativeMissionCompletionController={scenario,stage:'lane',actions:[],errors:[],completed:false};
 let pullAt=0,confirmedAt=0,lastShot=-Infinity,lastQuery=-Infinity,winScore,pendingShot,arrowIndex=0;const usedArrows=new Set();
 const execute=(kind,script)=>{const row={kind,script,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()};data.actions.push(row);finni.evaluate(script);return row;};
 execute('declarations','Dim RefCompletionBalls,RefCompletionBall');
 const query=()=>{
  const names=Object.keys(scenario.fields),expressions=Object.values(scenario.fields),script='Debug.Print "MISSION_COMPLETION|" & GameTime & "|" & '+[...expressions.map(e=>'CStr(CDbl('+e+'))'),...expressions.map(e=>'CStr(VarType('+e+'))')].join(' & "|" & ');
  execute('query',script);const lines=document.getElementById('log').textContent.split('\n'),line=lines.findLast(s=>s.includes('MISSION_COMPLETION|'));if(!line)throw Error('Missing native rule observation');
  data.lastQueryLine=line;const payload=/MISSION_COMPLETION\|([\d.eE+|\-]+)/.exec(line);if(!payload)throw Error('Invalid native rule marker');const numbers=payload[1].split('|').map(Number),ms=numbers.shift();if(numbers.length!==names.length*2||numbers.some(v=>!Number.isFinite(v)))throw Error('Invalid native rule observation: '+JSON.stringify({line,expected:names.length*2,numbers}));const values=numbers.slice(0,names.length),types=numbers.slice(names.length);
  const input=nativePlayerInputs.at(-1);if(input.script!==script)throw Error('Rule observation input lost its identity');input.ruleState={names,expressions,values,types,ms};
  return Object.fromEntries(names.map((name,i)=>[name,values[i]]));
 };
 const key=(name,down)=>execute('key',`Table1_Key${down?'Down':'Up'} ${name}`);
 const place=name=>{
  const body=nativeStartup.read().balls.findLast(ball=>ball.id>=3&&!ball.locked);if(!body)return false;
  const p=scenario.shots[name],properties={X:p.x,Y:p.y,Z:p.z,VelX:p.vx,VelY:p.vy,VelZ:p.vz,AngMomX:0,AngMomY:0,AngMomZ:0};
  execute('shot',`RefCompletionBalls=GetBalls():For Each RefCompletionBall In RefCompletionBalls:If RefCompletionBall.ID=${body.id} Then:${Object.entries(properties).map(([k,v])=>`RefCompletionBall.${k}=${v}`).join(':')}:End If:Next`);
  Object.assign(data.actions.at(-1),{shot:name,ballID:body.id,pose:p});lastShot=nativeStartup.read().ms;return true;
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
   if(ms-lastQuery<100)return;lastQuery=ms;const state=query();data.last=state;
   if(data.stage==='chooser'){
    if(!state.choosing)return;
    if(state.selected!==scenario.mission){key('RightFlipperKey',true);key('RightFlipperKey',false);return;}
    key('LockBarKey',true);key('LockBarKey',false);confirmedAt=ms;data.stage='active';return;
   }
   if(data.stage==='active'){
    const life=state['life'+scenario.mission];
    if(state.won===1&&state['mission'+scenario.mission]===1&&life<=0&&state.active===0&&state.endJackpot){winScore=state.score;data.stage='jackpot';return;}
    if(state.active!==scenario.mission||ms-confirmedAt<3200)return;
    if(scenario.mission===2){
     if(pendingShot){
      if(life>=pendingShot.life)return;
      const body=nativeStartup.read().balls.find(ball=>ball.id===pendingShot.ballID),bounds=scenario.clearance[pendingShot.name];
      if(body){const [x,y]=body.position;if(x>=bounds.minX&&x<=bounds.maxX&&y>=bounds.minY&&y<=bounds.maxY)return;}
      (data.physicalExits??=[]).push({shot:pendingShot.name,ballID:pendingShot.ballID,ms,frameIndex:nativeStartup.frameIndex(),position:body?.position,life});pendingShot=undefined;
     }
     if(ms-lastShot<scenario.shotInterval)return;
     const arrows={2:'ramp',4:'wolverine',5:'cross'},available=Object.keys(arrows).filter(n=>state['shot'+n]===2);if(!available.length)return;
     const next=available[arrowIndex++%available.length],name=arrows[next];if(place(name))pendingShot={name,life,ballID:data.actions.at(-1).ballID};
    }else if(ms-lastShot>=scenario.shotInterval){
     if(life>6)place('target');
     else{const arrows={1:'loop',2:'ramp',4:'rightRamp',6:'rightLoop'},next=Object.keys(arrows).find(n=>state['shot'+n]===2&&!usedArrows.has(n));if(next&&place(arrows[next]))usedArrows.add(next);}
    }
    return;
   }
   if(data.stage==='jackpot'){
    if(state.endJackpot===0&&state.score>=winScore+3000000){data.completed=true;data.stage='complete';data.completedAt=ms;return;}
    if(state.inHole===0&&ms-lastShot>=scenario.shotInterval)place('scoop');
   }
  }catch(error){data.errors.push(String(error));clearInterval(timer);}
 },16);
}
