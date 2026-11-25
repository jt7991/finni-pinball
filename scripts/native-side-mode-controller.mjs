// Declared physical approaches earn the original side modes. The controller
// never writes progress, mode flags, timers, mechanism motion or random state.
import{nativeSurfaceHeight}from'../three/native-ramp.js';
import{nativeMusicStateFields}from'./native-music-timeline-observer.mjs';
export function sideModeScenario(objects){
 const spinner=objects.find(o=>o.name==='Spinner001'),a=spinner.rotation*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},lock=objects.find(o=>o.name.toLowerCase()==='lock'),surface=objects.find(o=>o.name===lock.surface),drain=objects.find(o=>o.name.toLowerCase()==='drain');
 const lockY=lock.center.y+lock.radius+25.01;
 return{shots:{spinner:{x:spinner.center.x-n.x*60,y:spinner.center.y-n.y*60,z:25,vx:n.x*24,vy:n.y*24,vz:0},lock:{x:lock.center.x,y:lockY,z:25+nativeSurfaceHeight(surface,lock.center.x,lockY),vx:0,vy:-8,vz:0},drain:{x:drain.center.x,y:drain.center.y-60,z:25,vx:0,vy:12,vz:0}},lock:lock.center,fields:{playing:'Abs(CLng(bGameInPlay))',inLane:'Abs(CLng(bBallInPlungerLane))',onPlayfield:'BallsOnPlayfield',queued:'mBalls2Eject',inHole:'BallsInHole',locks:'BallsInLock(CurrentPlayer)',lockEnabled:'Abs(CLng(bLockEnabled))',ninja:'Abs(CLng(bNinjaMB))',ninjaSuper:'Abs(CLng(bNinjaMBSJackpot))',multi:'Abs(CLng(bMultiBallMode))',saver:'Abs(CLng(bBallSaverActive))',saverTimer:'Abs(CLng(BallSaverTimerExpired.Enabled))',disco:'Abs(CLng(bDiscoEnabled))',discoLoops:'Abs(CLng(bDiscoLoopsEnabled))',discoMB:'Abs(CLng(bDiscoMBEnabled))',discoTimer:'Abs(CLng(DiscoLoopsTimer.Enabled))',spins:'LeftSpinnerCount(CurrentPlayer)',score:'Score(CurrentPlayer)',active:'Battle(CurrentPlayer,0)',scriptRandom:'CLng(Rnd(0)*16777216)',...nativeMusicStateFields},scope:'Original initialization and physical launch, repeated declared spinner approaches to earn 50 spins, three physical elevated Lock captures to start Friendship multiball, original queued ball launches and unmodified saver/timer expiry, physical drains to end Friendship, then physical spinner approaches to reach 100 spins and earn Disco multiball before draining to end it. Free balls are placed in explicitly recorded, separated park positions during timer waits. No progress/qualification/mode setters, direct hit/mode handler calls, timer/mechanism changes or RNG overrides. These controlled physical inputs are not natural player completion.'};
}

export function installSideModeController(scenario){
 const data=window.nativeSideModeController={scenario,stage:'lane',actions:[],milestones:[],errors:[],completed:false};let pullAt,lastQuery=-Infinity,lastShot=-Infinity,lastPark=-Infinity,pendingDrain,drainingMode;
 const execute=(kind,script)=>{const row={kind,script,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()};data.actions.push(row);finni.evaluate(script);return row;};
 execute('declarations','Dim RefSideBalls,RefSideBall');
 const query=()=>{
  const names=Object.keys(scenario.fields),expressions=Object.values(scenario.fields),script='Debug.Print "SIDE_MODE|" & GameTime & "|" & '+[...expressions.map(e=>'CStr(CDbl('+e+'))'),...expressions.map(e=>'CStr(VarType('+e+'))')].join(' & "|" & ');execute('query',script);
  const line=document.getElementById('log').textContent.split('\n').findLast(s=>s.includes('SIDE_MODE|')),match=line&&/SIDE_MODE\|([\d.eE+|\-]+)/.exec(line);if(!match)throw Error('Missing native side-mode observation');const numbers=match[1].split('|').map(Number),ms=numbers.shift();if(numbers.length!==names.length*2||numbers.some(v=>!Number.isFinite(v)))throw Error('Invalid native side-mode observation');const input=nativePlayerInputs.at(-1);if(input.script!==script||input.ms!==ms)throw Error('Native side-mode marker lost its input/time');input.ruleState={names,expressions,values:numbers.slice(0,names.length),types:numbers.slice(names.length),ms};return Object.fromEntries(names.map((name,i)=>[name,numbers[i]]));
 };
 const key=(name,down)=>execute('key',`Table1_Key${down?'Down':'Up'} ${name}`),milestone=(name,state)=>{if(!data.milestones.some(row=>row.name===name))data.milestones.push({name,ms:nativeStartup.read().ms,state});};
 const free=()=>nativeStartup.read().balls.filter(ball=>ball.id>=3&&!ball.locked&&!(ball.position[0]>800&&ball.position[1]>1600));
 const properties=p=>Object.entries({X:p.x,Y:p.y,Z:p.z,VelX:p.vx,VelY:p.vy,VelZ:p.vz,AngMomX:0,AngMomY:0,AngMomZ:0}).map(([name,value])=>`RefSideBall.${name}=${value}`).join(':');
 const place=(name,id)=>{const ball=id===undefined?free().at(-1):free().find(b=>b.id===id);if(!ball)return false;const pose=scenario.shots[name];Object.assign(execute('shot',`RefSideBalls=GetBalls():For Each RefSideBall In RefSideBalls:If RefSideBall.ID=${ball.id} Then:${properties(pose)}:End If:Next`),{shot:name,ballID:ball.id,pose});lastShot=nativeStartup.read().ms;return true;};
 const park=ms=>{
  if(ms-lastPark<400)return;const balls=free().filter(ball=>ball.id!==pendingDrain?.id&&!(Math.hypot(ball.position[0]-scenario.lock.x,ball.position[1]-scenario.lock.y)<60&&ball.position[2]>50));if(!balls.length)return;
  const poses=balls.map((ball,i)=>({ballID:ball.id,pose:{x:330+i*100,y:1400,z:25,vx:0,vy:0,vz:0}}));Object.assign(execute('park','RefSideBalls=GetBalls():For Each RefSideBall In RefSideBalls:'+poses.map(({ballID,pose})=>`If RefSideBall.ID=${ballID} Then:${properties(pose)}:End If`).join(':')+':Next'),{poses});lastPark=ms;
 };
 const beginDrain=(mode,state)=>{drainingMode=mode;data.stage='drain';milestone(mode+'-ready-to-drain',state);};
 const timer=setInterval(()=>{try{
  if(nativeGameplay.done||data.completed){clearInterval(timer);return;}const ms=nativeStartup.read()?.ms;if(ms===undefined)return;
  if(data.stage==='lane'){if(document.body.classList.contains('ball-in-plunger')){key('PlungerKey',true);pullAt=ms;data.stage='charging';}return;}
  if(data.stage==='charging'){if(ms-pullAt>=600){key('PlungerKey',false);data.stage='exit';}return;}
  if(ms-lastQuery<100)return;lastQuery=ms;const state=query();data.last=state;
  if(!state.playing)throw Error('Game ended before the physical side-mode sequence completed');
  if(data.stage==='exit'){if(!state.inLane){milestone('launched',state);data.stage='disco-loops';}return;}
  if(data.stage==='disco-loops'){
   if(state.discoLoops){milestone('disco-loops',state);data.stage='friends';return;}if(ms-lastShot>=800)place('spinner');return;
  }
  if(data.stage==='friends'){
   if(state.locks===1)milestone('friend-one',state);if(state.locks===2)milestone('friend-two',state);
   if(state.ninja){milestone('friendship',state);data.stage='ninja-balls';return;}
   if(ms-lastShot>=2100)place('lock');return;
  }
  if(data.stage==='ninja-balls'){
   park(ms);if(state.onPlayfield>=3&&!state.queued&&!state.inLane){milestone('three-friends',state);data.stage='ninja-saver';}return;
  }
  if(data.stage==='ninja-saver'){
   park(ms);if(!state.saver&&!state.queued&&!state.inLane){if(!state.ninja)throw Error('Friendship ended before controlled physical drains');beginDrain('friendship',state);}return;
  }
  if(data.stage==='drain'){
   park(ms);if(pendingDrain){if(nativeStartup.read().balls.some(ball=>ball.id===pendingDrain.id))return;(data.drains??=[]).push({...pendingDrain,observedAt:ms,state});pendingDrain=undefined;}
   if(state.onPlayfield===1&&!state.queued){
    if(drainingMode==='friendship'){if(state.ninja)throw Error('Last physical multiball drain did not stop Friendship');milestone('friendship-ended',state);data.stage='disco-expiry';}
    else{if(state.discoMB)throw Error('Last physical multiball drain did not stop Disco');milestone('disco-ended',state);data.completed=true;data.completedAt=ms;data.stage='done';}return;
   }
   if(state.saver||state.queued||state.inLane)return;const ball=free().at(-1);if(ball&&state.onPlayfield>1&&place('drain',ball.id))pendingDrain={id:ball.id,ms,mode:drainingMode};return;
  }
  if(data.stage==='disco-expiry'){park(ms);if(!state.discoLoops){milestone('disco-loops-expired',state);data.stage='disco-multiball';}return;}
  if(data.stage==='disco-multiball'){
   if(state.discoMB){milestone('disco-multiball',state);data.stage='disco-balls';return;}if(ms-lastShot>=800)place('spinner');return;
  }
  if(data.stage==='disco-balls'){park(ms);if(state.onPlayfield>=2&&!state.queued&&!state.inLane&&!state.saver)beginDrain('disco',state);return;}
 }catch(error){data.errors.push(String(error));clearInterval(timer);}},16);
}
