// Controlled render coverage: ordinary authored key handlers, one declared
// qualification and scoop approach, and read-only state queries. No source
// handler, lane/chooser flag, RNG word or timer deadline is replaced.
export function missionRenderScenario(mission){
  if(!Number.isInteger(mission)||mission<1||mission>7)throw Error('Mission must be 1..7');
  const qualification=mission===7?6:mission>=4?3:0;
  return {mission,qualification,approach:{x:293.68433,y:530,z:25,vx:0,vy:-8,vz:0},scope:'Controlled initial qualification and one scoop approach after an independently observed physical lane exit. Chooser navigation and confirmation call the original key handlers. This does not certify natural qualification.'};
}

export function installMissionRenderController(scenario,frameCount){
  const state=window.nativeMissionRenderController={scenario,stage:'lane',actions:[],errors:[]},held=new Set();
  let pullAt=0,releasedAt=0,confirmedAt=0;
  const execute=(kind,script)=>{
    state.actions.push({kind,script,ms:nativeStartup.read()?.ms,frameIndex:nativeStartup.frameIndex()});
    finni.evaluate(script);
  };
  const query=()=>{
    execute('query','Debug.Print "RENDER_CONTROL|" & GameTime & "|" & bChooseBattle & "|" & Battlenr & "|" & Battle(CurrentPlayer,0) & "|" & BattlesToChoose');
    const rows=Array.from(document.getElementById('log').textContent.matchAll(/RENDER_CONTROL\|(\d+)\|(True|False)\|(\d+)\|(\d+)\|(\d+)/g)),row=rows.at(-1);
    if(!row)throw Error('Original chooser query did not return');
    return {ms:Number(row[1]),choosing:row[2]==='True',selected:Number(row[3]),active:Number(row[4]),choices:Number(row[5])};
  };
  const key=(name,down)=>{
    if(held.has(name)===down)return;
    down?held.add(name):held.delete(name);
    execute('key',`Table1_Key${down?'Down':'Up'} ${name}`);
  };
  const timer=setInterval(()=>{
    try{
      if(nativeWholeFrame.frames.length===frameCount){clearInterval(timer);return;}
      const snapshot=nativeStartup.read();if(!snapshot)return;
      const ms=snapshot.ms,inLane=document.body.classList.contains('ball-in-plunger');
      if(state.stage==='lane'){
        if(!inLane)return;
        key('PlungerKey',true);pullAt=ms;state.stage='charging';
      }else if(state.stage==='charging'){
        if(ms-pullAt<600)return;
        key('PlungerKey',false);releasedAt=ms;state.stage='exit';
      }else if(state.stage==='exit'){
        if(inLane){if(ms-releasedAt>3500)state.stage='lane';return;}
        if(snapshot.balls.length!==4)return;
        const p=scenario.approach;
        execute('approach',`BattlesWon(CurrentPlayer)=${scenario.qualification}:Dim RefRenderBalls,RefRenderBall:RefRenderBalls=GetBalls():Set RefRenderBall=RefRenderBalls(UBound(RefRenderBalls)):Debug.Print "RENDER_SCENARIO|" & GameTime & "|" & RefRenderBall.ID & "|" & bBallInPlungerLane:RefRenderBall.X=${p.x}:RefRenderBall.Y=${p.y}:RefRenderBall.Z=${p.z}:RefRenderBall.VelX=${p.vx}:RefRenderBall.VelY=${p.vy}:RefRenderBall.VelZ=${p.vz}:RefRenderBall.AngMomX=0:RefRenderBall.AngMomY=0:RefRenderBall.AngMomZ=0`);
        state.stage='chooser';
      }else if(state.stage==='chooser'){
        const observed=query();if(!observed.choosing)return;
        if(scenario.mission>observed.choices)throw Error('Declared qualification does not unlock the requested mission');
        if(observed.selected!==scenario.mission){
          const direction=observed.selected===1&&scenario.mission>=6?'LeftFlipperKey':'RightFlipperKey';
          execute('choose',`Table1_KeyDown ${direction}:Table1_KeyUp ${direction}`);
        }else{
          execute('confirm','Table1_KeyDown LockBarKey:Debug.Print "RENDER_MODE|" & GameTime & "|" & Battle(CurrentPlayer,0) & "|" & bMultiBallMode & "|" & BallsOnPlayfield & "|" & mBalls2Eject:Table1_KeyUp LockBarKey');
          state.stage='active';confirmedAt=ms;
        }
      }else{
        const phase=Math.floor((ms-confirmedAt)/223)%4;
        key('LeftFlipperKey',phase===0||phase===1);key('RightFlipperKey',phase===1||phase===2);
      }
    }catch(error){state.errors.push(String(error));clearInterval(timer);}
  },16);
}
