// Replay only the recorded external UI/timer/frame inputs. Native bodies and
// random words are expectations, never initialization or correction inputs.
import fs from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {nativeScriptClockInputs} from './native-script-clock-inputs.mjs';
export async function compareNativeHistoryState(fixture,{write=()=>{},observeObjects=[],contactAudit}={}){
const load=name=>JSON.parse(fs.readFileSync(new URL('../three/public/'+name,import.meta.url)));
const clocks=fixture.randomizeClocks?.timerRecords?nativeScriptClockInputs(fixture.randomizeClocks,{lastFrame:fixture.frames.at(-1).frameIndex,lastMilliseconds:fixture.frames.at(-1).snapshot.ms}):null;let randomizeIndex=0,timerIndex=0;
const scriptRandomClock=clocks?()=>{assert.ok(randomizeIndex<clocks.observedRandomizeClocks.length);return clocks.observedRandomizeClocks[randomizeIndex++];}:undefined,scriptTimerSeconds=clocks?()=>{assert.ok(timerIndex<clocks.observedTimerSeconds.length);return clocks.observedTimerSeconds[timerIndex++];}:undefined;
const game=await createFullGame(load('layout.json'),load('objects.json'),fs.readFileSync(new URL('../three/public/rules.vbs',import.meta.url),'utf8'),()=>{},undefined,{frameAnimations:true,scriptBudget:{videoSyncMode:2},scriptRandomClock,scriptTimerSeconds});
if(contactAudit){const hit=game.rules.hit.bind(game.rules);game.rules.hit=(name,kind,ball,...parameters)=>{if(kind==='Collide'&&/^(Left|Right)Flipper$/i.test(name))contactAudit.push({ms:Math.round(game.time*1000),name,speed:parameters[0]});return hit(name,kind,ball,...parameters);};}
const timers=new Set(fixture.timers.events.filter(row=>row.interval>=0).map(row=>row.ms));
let ticks=0,inputIndex=0,intervalsChecked=0,framesChecked=0;
const pendingAnimationBoundaries=new Map();
const cursor=clock=>Number((BigInt(clock.current)-BigInt(clock.start))/1000n);
// A clock import inside an ordinary UI call can observe that call's effects
// at the same physical cursor. Compare those rows after the recorded UI calls,
// rather than comparing their post-input RNG to the preceding physical step.
const uiTicks=new Set(fixture.playerInputs.filter(input=>input.frameIndex>2).map(input=>input.ms+1));
const boundaries=new Map((fixture.startup?.boundaries??[]).filter(row=>row.ms>=1).map(row=>[cursor(row.physicsClock),row]));
const advance=due=>{assert.ok(due>=ticks,'Physical cursor moved backward');while(ticks<due){assert.equal(pendingAnimationBoundaries.size,0,'Recorded frame animation must precede the next physical interval');game.step({dispatchTimers:timers.has(ticks)});ticks++;const boundary=boundaries.get(ticks);if(boundary&&!uiTicks.has(ticks)){
 // The first clock import of a physical interval can follow PrepareFrame at
 // the same physical cursor. A Dropped callback can already have changed
 // toy velocities and sound RNG. Its recorded animation clock identifies
 // this phase independently of any body difference; check the entire row
 // after our own animation, rather than treating it as a pre-frame state.
 if(boundary.lastAnimationMilliseconds>game.lastAnimationTime)pendingAnimationBoundaries.set(ticks,boundary);
 else{intervalsChecked++;if(!compare(boundary,'interval'))throw Error('First differing native physical boundary at '+ticks);}
}}};
function compare(row,phase){
 const actual=game.physicalRecords.map(record=>{const ball=game.nativeBall(record.body),state=ball.snapshot();return {position:Object.values(state.p),velocity:Object.values(state.v),momentum:Object.values(state.m),orientation:[...ball.orientation.matrix]};});
 const differences=[];
 for(let i=0;i<Math.max(actual.length,row.balls.length);i++){
  if(!actual[i]||!row.balls[i]){differences.push({ball:i,actual:actual[i],expected:row.balls[i]});continue;}
  for(const key of ['position','velocity','momentum','orientation'])for(let j=0;j<actual[i][key].length;j++)if(actual[i][key][j]!==row.balls[i][key][j])differences.push({ball:i,key,component:j,actual:actual[i][key][j],expected:row.balls[i][key][j]});
 }
 const random=game.random.getState();if(random.some((word,i)=>word!==row.random[i]))differences.push({key:'random',actual:random,expected:row.random});
 if(row.flippers)for(const expected of row.flippers){const flipper=game.flippers.find(f=>f.side===expected.name),actual={angle:flipper.nativeAngle,momentum:-flipper.nativeMotion.momentum,speed:-flipper.nativeMotion.speed,inertia:flipper.nativeMotion.inertia};for(const [key,value]of Object.entries(actual))if(value!==expected[key])differences.push({flipper:expected.name,key,actual:value,expected:expected[key]});const renderAngle=Math.fround(Math.PI/2-flipper.angle);if(renderAngle!==expected.angle)differences.push({flipper:expected.name,key:'renderAngle',actual:renderAngle,expected:expected.angle});}
 if(phase!=='interval'||differences.length)write({frame:row.frameIndex,phase,ticks,ms:row.ms,differences,objects:observeObjects.map(name=>{const object=game.rules.objects.get(name.toLowerCase());return {name,visible:object.visible,uservalue:object.uservalue,timerenabled:object.timerenabled,timerinterval:object.timerinterval,next:game.rules.timers.get(name.toLowerCase()+':timer')?.at};})});
 return differences.length===0;
}
try{
 game.prepareFrame();
 for(const [i,frame] of fixture.frames.entries()){
  while(inputIndex<fixture.playerInputs.length&&fixture.playerInputs[inputIndex].frameIndex<frame.frameIndex){const input=fixture.playerInputs[inputIndex++];if(input.frameIndex>2)advance(input.ms+1);if(!input.script.split(':').some(statement=>statement.startsWith('DisableStaticPrerendering=')))await game.rules.execute(input.script);if(input.uiState){const balls=game.rules.value('Balls'),actual={score:game.rules.value('Score(CurrentPlayer)'),ball:balls===0?'—':String(balls),playing:game.rules.value('bGameInPlay'),plunger:game.rules.value('bBallInPlungerLane')};assert.deepEqual(actual,input.uiState,'Ordinary player state poll at '+input.ms+'ms');}if(input.frameIndex>2&&fixture.playerInputs[inputIndex]?.ms!==input.ms){const boundary=boundaries.get(ticks);if(boundary){intervalsChecked++;if(!compare(boundary,'after-ui'))throw Error('Native UI boundary differs at '+ticks);}}}
  const preparation=fixture.clock.preparedFrames.find(row=>row.frameIndex===frame.frameIndex);
  advance(i<2?0:cursor(preparation.physicsClock));
  if(!compare(preparation,'prepare'))throw Error('Native frame state differs at '+frame.frameIndex);
  if(i>0){game.prepareFrame();game.sync();}
  if(pendingAnimationBoundaries.has(ticks)){const boundary=pendingAnimationBoundaries.get(ticks);assert.equal(boundary.lastAnimationMilliseconds,game.lastAnimationTime);intervalsChecked++;if(!compare(boundary,'after-animation'))throw Error('Native frame-animation boundary differs at '+ticks);pendingAnimationBoundaries.delete(ticks);}
  advance(i<2?0:cursor(frame.snapshot.physicsClock));
  if(!compare({...frame.snapshot,frameIndex:frame.frameIndex},'submit'))throw Error('Native frame state differs at '+frame.frameIndex);
  framesChecked++;
 }
 if(clocks){assert.equal(randomizeIndex,clocks.observedRandomizeClocks.length);assert.equal(timerIndex,clocks.observedTimerSeconds.length);}
 assert.equal(pendingAnimationBoundaries.size,0,'Every native physical boundary is checked');
 return {framesChecked,intervalsChecked,ticks,randomizeClockSamples:randomizeIndex,timerClockSamples:timerIndex};
}finally{game.dispose();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await compareNativeHistoryState(JSON.parse(fs.readFileSync(process.argv[2])),{write:row=>console.log(JSON.stringify(row)),observeObjects:process.argv.filter(arg=>arg.startsWith('--observe=')).map(arg=>arg.slice(10))});console.log(JSON.stringify({result}));}
