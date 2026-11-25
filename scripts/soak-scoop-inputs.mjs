// Ordinary control exploration, separate from independent native comparisons.
// The LCG schedules external buttons only; both game RNGs retain their normal
// initialization. No qualification, rule counter, physical pose or rescue input.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {mainPlayerSettings,mainScriptBudget} from '../three/player-settings.js';
const option=(name,fallback)=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const seconds=Number(option('seconds',120)),count=Number(option('cases',6)),output=option('output',null);
assert.ok(Number.isInteger(seconds)&&seconds>=1&&seconds<=3600);assert.ok(Number.isInteger(count)&&count>=1&&count<=100);assert.ok(output&&!fs.existsSync(output),'choose a new output path');
const read=name=>JSON.parse(fs.readFileSync('three/public/'+name+'.json','utf8')),source=fs.readFileSync('three/public/rules.vbs','utf8'),cases=[];
const queries=['BallsInHole','BallsOnPlayfield','bChooseBattle','bBattleReady','Battle(CurrentPlayer,0)','bMultiBallMode','bMechSuitMBStarted','mBalls2Eject'];
for(let seed=1;seed<=count;seed++){
  const game=await createFullGame(read('layout'),read('objects'),source,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings,scriptBudget:mainScriptBudget});
  let inputState=seed,nextFrame=0,nextAction=0,nextNudge=8000,nextStart=0,launchUp=0,games=0,maxBalls=0,scoopHits=0,multiballMilliseconds=0,chooseMilliseconds=0,holeSince,flag,error;
  const random=()=>((inputState=(Math.imul(inputState,1664525)+1013904223)>>>0)/4294967296),inputs=[],events=[],randomizeInputs=[];
  const flip={left:{down:false,next:0},right:{down:false,next:0}};
  const state=()=>Object.fromEntries(queries.map(name=>[name,game.rules.value(name)]));
  const event=value=>{events.push({ms:Math.round(game.time*1000),...value});if(events.length>100)events.shift();};
  const input=(action,down)=>{inputs.push({ms:Math.round(game.time*1000),action,down});game.input(action,down);};
  const randomize=game.rules.scriptRandom.randomize.bind(game.rules.scriptRandom);
  game.rules.scriptRandom.randomize=argument=>{randomizeInputs.push({ms:Math.round(game.time*1000),argument});return randomize(argument);};
  const hit=game.rules.hit.bind(game.rules);game.rules.hit=(name,kind,ball,...args)=>{
    if(name.toLowerCase()==='hellhouse'&&kind==='Hit'){scoopHits++;event({kind:'scoopHit',id:ball.getProperty('ID').value,...state()});}
    return hit(name,kind,ball,...args);
  };
  const kick=game.kick.bind(game);game.kick=(name,...args)=>{if(name.toLowerCase()==='hellhouse')event({kind:'scoopKick',id:game.captures.get('hellhouse')?.scriptID,...state()});return kick(name,...args);};
  const initialPhysicsRandom=game.random.getState(),initialScriptRandom=game.rules.scriptRandom.getState();
  try{
    game.start();games++;
    for(let ms=0;ms<seconds*1000;ms++){
      if(game.gameState.entering&&ms>=nextAction){input('launch',true);input('launch',false);nextAction=ms+200;}
      else if(game.state==='over'&&ms>=nextStart){game.start();games++;inputs.push({ms:Math.round(game.time*1000),action:'startGame',players:1});nextStart=ms+2000;}
      if(game.state==='playing'){
        if(launchUp&&ms>=launchUp){input('launch',false);launchUp=0;}
        if(game.inLane&&!launchUp&&!game.plunger.fireTimer){input('launch',true);launchUp=ms+300+Math.floor(random()*850);}
        for(const side of ['left','right'])if(ms>=flip[side].next){const f=flip[side];f.down=!f.down;input(side,f.down);f.next=ms+35+Math.floor(random()*(f.down?650:300));}
        if(ms>=nextAction){const burst=1+Math.floor(random()*8);for(let i=0;i<burst;i++){input('action',true);input('action',false);}nextAction=ms+180+Math.floor(random()*1400);}
        if(ms>=nextNudge&&!game.inLane){const action=['nudgeLeft','nudgeForward','nudgeRight'][Math.floor(random()*3)];input(action,true);input(action,false);nextNudge=ms+8000+Math.floor(random()*8000);}
      }
      game.step();
      if(ms>=nextFrame){game.prepareFrame();game.finishFrame();nextFrame+=1000/60;}
      maxBalls=Math.max(maxBalls,game.records.length);
      if(game.records.length>1)multiballMilliseconds++;
      if(ms%20===0){
        const values=state();if(values.bChooseBattle)chooseMilliseconds+=20;
        if(values.BallsInHole>0&&!values.bChooseBattle){holeSince??=ms;}else holeSince=undefined;
        const held=game.records.find(record=>record.held==='hellhouse');
        if(!flag&&(held||holeSince!==undefined&&ms-holeSince>30000))flag={ms,reason:held?'physical scoop ball survives its authored Hit handler':'virtual scoop queue has no chooser for over 30 seconds',id:held?.scriptID,values,delays:game.rules.delays.map(d=>({...d})),timers:[...game.rules.timers.values()].map(t=>({handler:t.handler,nextMilliseconds:t.nextMilliseconds})),events:structuredClone(events)};
      }
    }
  }catch(cause){error=String(cause);}finally{
    const result={seed,seconds,games,maxBalls,scoopHits,multiballMilliseconds,chooseMilliseconds,flag,error,initialPhysicsRandom,initialScriptRandom,finalPhysicsRandom:game.random.getState(),finalScriptRandom:game.rules.scriptRandom.getState(),randomizeInputs,scriptStats:game.scriptStats,final:state(),inputs};cases.push(result);game.dispose();
    console.log(JSON.stringify({...result,inputs:result.inputs.length,randomizeInputs:result.randomizeInputs.length}));
  }
}
const report={scope:'Model-only exploration using ordinary Start, launch, flipper, Action and nudge inputs. Input LCG never replaces either game RNG. Real wall Timer inputs and a declared 60Hz frame cadence remain its own, not observed native clocks. Source counters, qualifications, physical poses, timer deadlines and outputs are not supplied or rescued. Flags are diagnostic observations requiring native investigation; absence of flags is finite coverage, not complete VPX parity or proof of reported multiball reachability.',source:read('source-table'),cases};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
assert.ok(cases.every(row=>!row.error),'a scenario raised an error');
assert.ok(cases.every(row=>!row.flag),'a scoop hold requires investigation');
