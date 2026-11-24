// Replay ordinary startup and observed animation callback clocks. No native
// scene property, pose, random state or later script variable is restored.
import fs from 'node:fs';import assert from 'node:assert/strict';
import{createFullGame}from '../three/full-game.js';
import{mainPlayerSettings,mainBallSettings,mainSceneSettings}from '../three/player-settings.js';
import{gunzipSync}from 'node:zlib';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),capture=JSON.parse(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes);
const observedTimerDelivery=process.argv.includes('--observed-timer-delivery');
if(observedTimerDelivery){assert.ok(capture.timers?.events.length);assert.deepEqual(capture.timers.errors,[]);}
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(capture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(capture.reference.controlledSha256,capture.reference.sourceSha256);assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.clock.errors,[]);
const game=await createFullGame(JSON.parse(fs.readFileSync('three/public/layout.json')),JSON.parse(fs.readFileSync('three/public/objects.json')),fs.readFileSync('three/public/rules.vbs','utf8'),()=>{},{play(){},stop(){}},{frameAnimations:true,playerSettings:mainPlayerSettings,ballSettings:mainBallSettings,sceneSettings:mainSceneSettings});
try{
 game.start();let ticks=0;
 const timerCalls=[],timerTimes=new Set(observedTimerDelivery?capture.timers.events.filter(row=>row.interval>=0).map(row=>row.ms):[]);
 if(observedTimerDelivery){
  const known=new WeakSet(),watch=timer=>{if(known.has(timer))return;known.add(timer);let name=timer.handler;Object.defineProperty(timer,'handler',{configurable:true,enumerable:true,get(){timerCalls.push({ms:Math.round(game.time*1000),name:name.replace(/_Timer$/i,'')});return name;},set(value){name=value;}});};
  for(const timer of game.rules.timers.values())watch(timer);const set=game.rules.timers.set.bind(game.rules.timers);game.rules.timers.set=(key,timer)=>{watch(timer);return set(key,timer);};
 }
 const zero=values=>values.map(value=>value===0?0:value);
 const bodies=()=>game.physicalRecords.map(record=>{const ball=game.nativeBall(record.body),state=ball.snapshot();return{id:record.proxy.getProperty('ID').value,position:zero(Object.values(state.p)),velocity:zero(Object.values(state.v)),momentum:zero(Object.values(state.m)),orientation:zero([...ball.orientation.matrix]),locked:!!record.held};});
 const observed=rows=>rows.map(({id,position,velocity,momentum,orientation,locked})=>({id,position,velocity,momentum,orientation,locked}));
 const boundaries={frames:0,bodies:0,bodyMismatches:0,randomMismatches:0,examples:[]};
 const advance=ms=>{assert.ok(Number.isInteger(ms)&&ms>=Math.round(game.time*1000));while(!game.physicsStarted||Math.round(game.time*1000)<ms){
  game.step({dispatchTimers:observedTimerDelivery?timerTimes.has(ticks):true});ticks++;const row=capture.startup.boundaries[ticks-1];if(!row)continue;
  assert.equal(row.ms,ticks);boundaries.frames++;boundaries.bodies+=row.balls.length;
  const actual=bodies(),expected=observed(row.balls);try{assert.deepEqual(actual,expected);}catch{boundaries.bodyMismatches++;if(boundaries.examples.length<4)boundaries.examples.push({ms:row.ms,actual,expected});}
  if(game.random.getState().some((word,i)=>word!==row.random[i]))boundaries.randomMismatches++;
 }};
 for(const frame of capture.clock.animationFrames){advance(frame.ms);game.prepareFrame();}
 advance(capture.freeze.after.ms);
 const rows=[],missing=[];
 for(const line of capture.lines){
  assert.ok(line.endsWith("'"),'Original Debug.Print log closes its quoted message');
  const [tag,name,field,text]=line.slice(0,-1).split('|');if(tag==='SCENE_MISSING'){missing.push({name,field,text});continue;}
  const object=game.rules.objects.get(name.toLowerCase());assert.ok(object,name);
  const key=field==='GetInPlayIntensity'?'inplayintensity':field==='GetInPlayStateBool'?'getinplaystatebool':field.toLowerCase();
  const property=object[key],raw=typeof property==='function'?property():property;
  // Public IsDropped is VARIANT_BOOL; the physics host exposes its flag as0/1.
  const actual=field==='IsDropped'?!!raw:raw;
  const expected=['ImageA','ImageB','BlinkPattern'].includes(field)?text:text==='True'?true:text==='False'?false:Number(text);
  const error=typeof expected==='number'?Math.abs(actual-expected):actual===expected?0:Infinity;
  const allowance=typeof expected==='number'?5e-13+Number.EPSILON*Math.abs(expected):0;
  rows.push({name,field,expected,actual,error:Number.isFinite(error)?error:null,allowance,agrees:error<=allowance});
 }
 const actualBodies=bodies(),expectedBodies=observed(capture.freeze.after.balls);
 let bodiesAgree=true;try{assert.deepEqual(actualBodies,expectedBodies);}catch{bodiesAgree=false;}
 const report={input,ms:capture.freeze.after.ms,ticks,boundaries,timerInputs:observedTimerDelivery?{positiveDeliveryClocks:timerTimes.size,actual:timerCalls,expected:capture.timers.events.filter(row=>row.interval>=0).map(({ms,name})=>({ms,name})),scope:'Actual native timer-delivery clocks are external diagnostic inputs. Handler count/order and every physical interval are model outputs; production script-budget policy is not reconstructed.'}:undefined,animationFrames:capture.clock.animationFrames.length,properties:rows.length,mismatches:rows.filter(row=>!row.agrees),missing,bodyComparison:{agrees:bodiesAgree,actual:actualBodies,expected:expectedBodies},random:{actual:game.random.getState(),expected:capture.freeze.after.random},rows,scope:'Ordinary production FullGame initialization and Start, every physical interval through the native endpoint, and read-only observed PrepareFrame clocks. Every retained physical boundary compares bodies and RNG as well as the endpoint scene properties. No initial or later state restoration, native scene-property copies, clock fitting, lamp controls, pose setters or RNG overrides. Numeric allowance is the half-unit rounding error of native FormatNumber12 plus one JS parse ULP; body JSON values are exact apart from signed-zero normalization.'};
 fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({ms:report.ms,ticks,animationFrames:report.animationFrames,properties:rows.length,mismatches:report.mismatches.length,examples:report.mismatches.slice(0,16),bodiesAgree,random:report.random}));
 if(process.argv.includes('--check')){assert.equal(report.mismatches.length,0);assert.equal(bodiesAgree,true);assert.deepEqual(report.random.actual,report.random.expected);assert.equal(boundaries.frames,capture.startup.boundaries.length);assert.equal(boundaries.bodyMismatches,0);assert.equal(boundaries.randomMismatches,0);}
 if(process.argv.includes('--check')&&observedTimerDelivery)assert.deepEqual(timerCalls,report.timerInputs.expected);
}finally{game.dispose();}
