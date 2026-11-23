import {materialEventCases} from './material-event-cases.mjs';
import {targetEventCases} from './target-event-cases.mjs';
import {flipperEventCases} from './flipper-event-cases.mjs';
// Controlled native VPX contact measurements. All state comes from the live
// engine; every case resets both linear velocity and angular momentum.
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeBallMemoryObserver} from './native-ball-memory-observer.mjs';
import {nativePlungerMemoryObserver} from './native-plunger-memory-observer.mjs';
import {nativeInputSequence} from './native-input-sequence.mjs';
import {nativeRngSites,installNativeRngSites} from './native-rng-sites.mjs';
const [debug,base,output]=process.argv.slice(2);
const outputName=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14);
if(outputName)assert.match(outputName,/^[a-z0-9.-]+\.json$/i,'Explicit capture filename stays in the review directory');
const requestedBallIndex=process.argv.find(a=>a.startsWith('--ball-index='))?.slice(13),ballIndex=requestedBallIndex===undefined?undefined:Number(requestedBallIndex);
if(ballIndex!==undefined)assert.ok(Number.isInteger(ballIndex)&&ballIndex>=0,'Measured native body index must be a nonnegative integer');
const probeKind=process.argv.includes('--target-events')?'target-events':process.argv.includes('--material-events')?'material-events':process.argv.includes('--flipper-events')?'flipper-events':process.argv.includes('--slingshots')?'slingshots':process.argv.includes('--bumpers')?'bumpers':process.argv.includes('--autofire')?'autofire':process.argv.includes('--ball-pairs')?'ball-pairs':process.argv.includes('--triggers')?'triggers':process.argv.includes('--targets')?'targets':process.argv.includes('--gates')?'gates':process.argv.includes('--spinners')?'spinners':process.argv.includes('--plunger')?'plunger':process.argv.includes('--nudge')?'nudge':'contacts';
const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();
const inputSequencePath=process.argv.find(a=>a.startsWith('--input-sequence='))?.slice(17);
if(inputSequencePath){
 assert.equal(probeKind,'plunger');
 reference.runtimeInputSequence=nativeInputSequence(await readFile('.work/vpx-animation-frame-rng-reference/extracted/script.vbs','utf8'),JSON.parse(await readFile(inputSequencePath,'utf8')));
}
const observeScriptClocks=process.argv.includes('--observe-script-clocks');
const scriptClockObserver='Function RndNbr(n)\nDim RefScriptClock\nRefScriptClock=Timer\nIf RefTraceOn Then Debug.Print "SCRIPT_CLOCK|" & GameTime & "|" & VarType(RefScriptClock) & "|" & CStr(CDbl(RefScriptClock))\nRandomize RefScriptClock\nRndNbr=Int((n*Rnd)+1)\nEnd Function';
if(observeScriptClocks){assert.ok(reference.instrumentation?.nativeScriptRngMarkers);reference.runtimeScriptClockObserver={code:scriptClockObserver,scope:'Diagnostic runtime declaration of the original RndNbr body with its sole Timer read retained in a Variant and observed before the unchanged Randomize/Rnd. No clock values or RNG results replaced.'};reference.instrumentation.scriptClockInputs=reference.runtimeScriptClockObserver.scope;}
const recordTimers=!!reference.instrumentation&&!process.argv.includes('--no-timer-trace');
const recordAllBalls=process.argv.includes('--all-ball-state');
const recordKickers=process.argv.includes('--kickers');
const recordTrails=process.argv.includes('--ball-trails');
const recordRng=process.argv.includes('--rng-state');
const recordInternals=process.argv.includes('--native-internals');
const recordRngSites=process.argv.includes('--native-rng-sites');
if(recordRngSites){assert.ok(recordInternals);reference.runtimeRngSites=nativeRngSites(await readFile('.work/three-review/reference-engine.wasm'));}
const liveBodyState=process.argv.includes('--live-body-state');
if(liveBodyState){assert.ok(recordInternals,'Live bodies require the validated full native memory observer');reference.liveBodyState=true;}
const recordContactSlots=process.argv.includes('--contact-slots');
const recordPlunger=process.argv.includes('--plunger-state');
const recordAnimationFrames=process.argv.includes('--animation-frames');
const recordScriptRng=process.argv.includes('--script-rng-state');
if(recordScriptRng)assert.ok(recordInternals&&reference.instrumentation?.nativeScriptRngMarkers,'script state requires the separately instrumented table and full memory capture');
if(recordAnimationFrames)assert.ok(recordRng&&reference.instrumentation?.animationFrameTrace,'animation clocks require the separately instrumented native table and RNG observer');
if(recordPlunger)assert.ok(recordInternals,'plunger state requires pinned native memory capture');
const plungerSpec=recordPlunger?JSON.parse(await readFile(new URL('../three/public/layout.json',import.meta.url),'utf8')).items.find(item=>item.kind==='Plunger'):undefined;
if(recordContactSlots)assert.ok(recordInternals,'retained contact slots require pinned native memory capture');
if(recordContactSlots)reference.nativeContactStorageCapture='Read-only retained CollisionEvent vector slots (48-byte ABI). Physics clears vector size after a pass; slots beyond the previous pass may be stale. These diagnostics are not the current active contact list.';
if(recordInternals)assert.ok(recordRng&&recordAllBalls,'native internals require pinned memory capture and all body states');
const omitStateTrace=process.argv.includes('--no-state-trace');
if(omitStateTrace)assert.ok(reference.instrumentation?.optionalStateTrace,'reference supports disabling the expensive per-frame state strings');
if(recordTrails)assert.ok(reference.instrumentation?.ballTrails,'trail capture requires the separately instrumented native table');
if(recordTrails)assert.ok(recordAllBalls,'trail capture requires all initial body states');
if(recordRng){
  assert.ok(reference.instrumentation?.nativeRngMarkers,'random capture requires the separately instrumented table');
  const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),sha=createHash('sha256').update(wasm).digest('hex');
  // This pinned binary's MWC64X sites all load/store the same uint64 global.
  // The address is verified from its i64 multiplier instruction, not guessed
  // by trying seeds or trajectories. Reject any other compiled engine.
  assert.equal(sha,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8','native random-state layout requires the pinned engine');
  assert.ok(wasm.includes(Buffer.from('41d0cdd303290300','hex')),'verified uint64 MWC64X global load');
  reference.nativeRandom={algorithm:'MWC64X',engineSha256:sha,stateAddress:7661264,wordOrder:['low','high'],capture:'Read-only WASM memory reads synchronized to native Debug.Print frame markers.'};
}
if(recordInternals){
  if(reference.nativePhysicsMaxLoops===undefined)assert.equal(reference.sourceSha256,'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a','legacy reference physics loop limit belongs to the pinned table');
  // Legacy metadata predates this field; its verified source table stores
  // physics_max_loops=1694228, multiplied by10000/1000 in PhysicsEngine.
  reference.nativePhysicsMaxLoops??=16942280;
}
const ballStateFields=['X','Y','Z','VelX','VelY','VelZ','AngMomX','AngMomY','AngMomZ','Mass','Radius','ID'];
if(recordAllBalls)reference.initialBallStateColumns=ballStateFields;
const referenceNumber=value=>{const parts=value.split('@');return parts.length===2?Number(parts[0])*2**Number(parts[1]):Number(value);};
// Native CStr(CDbl()) can lose the exponent of tiny velocities/momenta in
// this engine. Encode those Single getters as an exact integer times 2^e.
// Multiplication/division by two preserves every Single bit in a Double.
const ballStateRow=()=>ballStateFields.map((property,index)=>{
  const separator=index?'RefInitTrace=RefInitTrace & ":":':'';
  if(!/^(Vel|AngMom)/.test(property))return separator+`RefInitTrace=RefInitTrace & CStr(CDbl(RefInitBall.${property}))`;
  return separator+`RefExactValue=CDbl(RefInitBall.${property}):RefExactExponent=0:If RefExactValue<>0 Then:Do While Abs(RefExactValue)<8388608:RefExactValue=RefExactValue*2:RefExactExponent=RefExactExponent-1:Loop:Do While Abs(RefExactValue)>=16777216:RefExactValue=RefExactValue/2:RefExactExponent=RefExactExponent+1:Loop:End If:RefInitTrace=RefInitTrace & CStr(CLng(RefExactValue)) & "@" & CStr(RefExactExponent)`;
}).join(':');
if(recordAllBalls)reference.initialBallStateScalarEncoding='Velocity and momentum are exact signed integer mantissas times 2^exponent, encoded mantissa@exponent in raw rows; parsed numeric columns are unchanged. Other fields use native Double text.';
const traceMilliseconds=Number(process.argv.find(a=>a.startsWith('--trace-ms='))?.slice(11)??70);
const captureThroughText=process.argv.find(a=>a.startsWith('--capture-through-ms='))?.split('=')[1],captureThrough=captureThroughText===undefined?undefined:Number(captureThroughText);
if(captureThrough!==undefined){assert.ok(recordTimers&&Number.isInteger(captureThrough)&&captureThrough>=1&&captureThrough<=traceMilliseconds,'Capture window must fit the native trace duration');reference.captureThroughMilliseconds=captureThrough;}
// RNG/body and animation markers continue while RefTraceOn is true; the
// expensive text trace has its own short RefTraceUntil window. Keep the
// original trace-window gate and independently validate this longer recording.
const recordThroughText=process.argv.find(a=>a.startsWith('--record-through-ms='))?.split('=')[1],recordThrough=recordThroughText===undefined?undefined:Number(recordThroughText);
if(recordThrough!==undefined){assert.ok(recordRng&&recordInternals&&recordAnimationFrames&&Number.isInteger(recordThrough)&&recordThrough>=1&&recordThrough<=30000,'Long recording requires complete native body/RNG and animation clocks, at most30s');reference.recordThroughMilliseconds=recordThrough;}
if(reference.runtimeInputSequence)assert.ok(recordThrough>=reference.runtimeInputSequence.inputs.at(-1).ms,'Native input sequence fits the complete capture window');
const traceFrom=Number(process.argv.find(a=>a.startsWith('--trace-from-ms='))?.split('=')[1]??0);
assert.ok(Number.isInteger(traceMilliseconds)&&traceMilliseconds>=1&&traceMilliseconds<=1000,'trace duration must be 1..1000ms');
assert.ok(Number.isInteger(traceFrom)&&traceFrom>=0&&traceFrom<traceMilliseconds,'trace start must precede its end');
if(traceFrom)assert.ok(reference.instrumentation?.stateTraceWindow,'reference supports a bounded state-trace window');
reference.timerTraceCaptured=recordTimers;
if(recordTimers)reference.traceMilliseconds=traceMilliseconds;
if(traceFrom)reference.traceFromMilliseconds=traceFrom;
assert.deepEqual(reference.controlledOverrides,{scatter:0,default_scatter:0},'controlled native table metadata');
const runtimeOverrides={'LeftFlipper.Scatter':0,'RightFlipper.Scatter':0};
reference.flipperAngleScalarEncoding='Native Float32 COM angles formatted through CStr(CDbl()), preserving every Single bit after parsing as Float32.';
const columns=['ms','x','y','z','vx','vy','vz','wx','wy','wz','left','right',...(probeKind==='triggers'?['balls_over']:probeKind==='plunger'?['plunger_position']:probeKind==='targets'?['target009_dropped','target010_dropped','target011_dropped','target009_offset','target010_offset','target011_offset','score']:['spinners','gates'].includes(probeKind)?[probeKind==='gates'?'gate_angle':'spinner_angle','score','left_spinner_count']:[])];
if(probeKind==='autofire')columns.push('plunger_position','coil_balls');
if(probeKind==='bumpers')columns.push('score','bumper_hits');
if(probeKind==='slingshots'||probeKind==='material-events'||probeKind==='target-events')columns.push('score');
if(recordKickers)columns.push('ball_count','score','balls_in_hole');
if(probeKind==='ball-pairs')columns.push('other_x','other_y','other_z','other_vx','other_vy','other_vz','other_wx','other_wy','other_wz');
reference.timerSynchronization='RollingTimer disabled/enabled immediately before each initial state, resetting its 10ms phase.';
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const script=code=>evaluate(`finni.evaluate(${JSON.stringify(code)})`);
const marker=async label=>evaluate(`document.getElementById('log').textContent.split(${JSON.stringify(label+'|')}).at(-1).split(String.fromCharCode(10))[0]`);
const reset=(x,y,vx,vy,z=25,vz=0)=>`RefBall.X=${x}:RefBall.Y=${y}:RefBall.Z=${z}:RefBall.VelX=${vx}:RefBall.VelY=${vy}:RefBall.VelZ=${vz}:RefBall.AngMomX=0:RefBall.AngMomY=0:RefBall.AngMomZ=0`;
const cases=[{name:'slide',x:430,y:1500,vx:10,vy:0}];
for(const side of ['left','right'])for(const offset of [35,105])for(const delay of [0,40])cases.push({name:`${side}-${offset}-${delay}`,side,delay,x:(side==='left'?274.4583:592.20245)+(side==='left'?offset:-offset),y:1736.8932,vx:0,vy:6});
for(const side of ['left','right']){
  const a=(side==='left'?22:158)*Math.PI/180,sy=side==='left'?.43:-.43;
  cases.push({name:`${side}-cradle-release`,side,startRaised:true,press:false,delay:100,sampleCount:24,
    x:(side==='left'?274.4583:592.20245)+100*(.35*Math.cos(a)-sy*Math.sin(a)),
    y:1786.8932-100*(.35*Math.sin(a)+sy*Math.cos(a)),vx:0,vy:0});
}
cases.push({name:'wire-entry',x:610.5,y:832.5,z:20.7,vx:0,vy:0,sampleCount:96});
cases.push({name:'slot-back',x:612.3,y:803.1,z:25,vx:0,vy:0,sampleCount:96});
if(process.argv.includes('--geometry')){
  reference.geometryProbe=true;cases.length=0;
  cases.push(
    {name:'cabinet-top',x:430,y:40,z:150,vx:0,vy:-12},
    {name:'cabinet-left',x:40,y:1100,z:150,vx:-12,vy:0},
    {name:'cabinet-glass',x:430,y:1100,z:245,vx:0,vy:0,vz:12,sampleCount:24},
    {name:'camera-drop',x:113.558655,y:1671.6152,z:180,vx:0,vy:0,vz:-4,sampleCount:24},
    {name:'upper-post-drop',x:547.42035,y:206.22552,z:160,vx:0,vy:0,vz:-2,sampleCount:24},
    {name:'return-pocket',x:843.1,y:1035.1,z:25,vx:0,vy:5,sampleCount:96});
}
if(process.argv.includes('--shooter')){
  reference.shooterProbe=true;cases.length=0;
  for(const speed of [36,52])cases.push({name:`shooter-feed-${speed}`,x:905,y:1800,z:25,vx:0,vy:-speed,sampleCount:96});
}
if(process.argv.includes('--feed')){
  cases.length=0;
  cases.push({name:'ballrelease-feed',x:839.7799,y:1804.9163,z:25,vx:4,vy:0,sampleCount:120});
}
if(recordKickers){
  cases.length=0;
  cases.push({name:'hellhouse-capture',kicker:'HellHouse',x:293.68433,y:530,z:25,vx:0,vy:-8,sampleCount:120});
}
if(probeKind==='ball-pairs'){
  cases.length=0;
  for(const [name,x,y,z,speed]of [['head-on',500,1200,180,12],['glancing',500,1230,180,12],['height-offset',500,1200,195,12],['embedded',427,1200,180,2]]){
    cases.push({name,x:380,y:1200,z:180,vx:speed,vy:0,otherBall:{index:1,x,y,z,vx:-speed,vy:0,vz:0},sampleCount:12,maximumMilliseconds:80});
  }
  cases.push({name:'frozen-kicker',x:90,y:2061,z:25,vx:12,vy:0,otherBall:{index:4,spawn:'la',x:153.00056,y:2061,z:25,vx:0,vy:0,vz:0},sampleCount:12,maximumMilliseconds:80});
}
if(probeKind==='triggers'){
  cases.length=0;
  cases.push(
    {name:'shooter-circle',trigger:'swPlunger',x:906.8096,y:1820,z:25,vx:0,vy:12},
    {name:'wire-crossing',trigger:'Trigger005',x:840,y:317,z:25,vx:12,vy:0},
    {name:'wire-overhead',trigger:'Trigger005',x:840,y:317,z:130,vx:12,vy:0},
    {name:'circle-overhead',trigger:'Trigger014',x:309.22223,y:128.25934,z:100,vx:0,vy:0,vz:-6});
  for(const c of cases)c.sampleCount=40;
}
if(probeKind==='bumpers'){
  assert.ok(reference.instrumentation?.bumperTrace,'bumper capture requires its instrumented table');
  reference.ruleControls='Score(CurrentPlayer)=0:BumperHits(CurrentPlayer)=0:Battle(CurrentPlayer,0)=0:bSkillShotReady=False:Tilted=False';
  cases.length=0;
  const specs=JSON.parse(await readFile(new URL('../three/public/layout.json',import.meta.url),'utf8')).items.filter(s=>s.kind==='Bumper');
  for(const spec of specs)for(const speed of [.5,2,12])cases.push({name:`${spec.name}-${speed}`,bumper:spec.name,x:spec.center.x+spec.radius+25.01,y:spec.center.y,z:25,vx:-speed,vy:0,sampleCount:12,maximumMilliseconds:100});
  const initial=cases.find(c=>c.name==='Bumper1-2');
  for(const [suffix,overrides]of [['threshold',{Threshold:100}],['force',{Force:4}],['no-event',{HasHitEvent:false}],['disabled',{Collidable:false}]])cases.push({...initial,name:'Bumper1-'+suffix,bumperOverrides:overrides});
  cases.push({...initial,name:'Bumper1-repeat',repeatBumperReset:true,delay:40});
}
if(probeKind==='slingshots'){
  assert.ok(reference.instrumentation?.slingshotTrace,'slingshot capture requires its instrumented table');
  reference.ruleControls='Score(CurrentPlayer)=0:Tilted=False';cases.length=0;
  const specs=JSON.parse(await readFile(new URL('../three/public/layout.json',import.meta.url),'utf8')).items.filter(s=>/slingshot/i.test(s.name));
  for(const spec of specs){
    const index=spec.drag_points.findIndex(p=>p.is_slingshot),a=spec.drag_points[index],b=spec.drag_points[(index+1)%spec.drag_points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    for(const fraction of [.2,.5,.8])for(const speed of [1,6])cases.push({name:`${spec.name}-${fraction}-${speed}`,slingshot:spec.name,x:a.x+dx*fraction+nx*25.01,y:a.y+dy*fraction+ny*25.01,z:25,vx:-nx*speed,vy:-ny*speed,sampleCount:12,maximumMilliseconds:100});
    const initial=cases.find(c=>c.slingshot===spec.name&&c.name.endsWith('0.5-6'));
    for(const [suffix,overrides]of [['disabled',{Disabled:true}],['threshold',{SlingshotThreshold:100}],['noncollidable',{Collidable:false}]])cases.push({...initial,name:spec.name+'-'+suffix,slingshotOverrides:overrides});
  }
}
if(probeKind==='flipper-events'){
  assert.ok(reference.instrumentation?.flipperTrace,'flipper event capture requires its instrumented table');
  reference.ruleControls='Tilted=False';cases.length=0;
  cases.push(...flipperEventCases(JSON.parse(await readFile(new URL('../three/public/layout.json',import.meta.url),'utf8'))));
}
if(probeKind==='material-events'){
  assert.ok(reference.instrumentation?.materialTrace,'material event capture requires its instrumented table');
  reference.ruleControls='Score(CurrentPlayer)=0:Tilted=False';cases.length=0;
  cases.push(...materialEventCases(JSON.parse(await readFile(new URL('../three/public/layout.json',import.meta.url),'utf8'))));
}
if(probeKind==='target-events'){
  assert.ok(reference.instrumentation?.targetTrace,'target capture requires its instrumented table');
  reference.ruleControls='Score(CurrentPlayer)=0:Tilted=False';cases.length=0;
  cases.push(...targetEventCases(JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8'))));
}
const selected=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
const exactDelay=process.argv.find(a=>a.startsWith('--exact-input-delay='))?.split('=')[1];
if(exactDelay!==undefined)assert.ok(reference.instrumentation&&Number.isFinite(Number(exactDelay))&&Number(exactDelay)>0,'exact clock input requires the separate instrumented table');
reference.inputScheduling=exactDelay!==undefined?{kind:'native-flipper-timer',requestedDelay:Number(exactDelay)}:{kind:'vpmtimer'};
if(probeKind==='plunger'){
  cases.length=0;
  for(const delay of [50,100,200,400,600,1000])cases.push({name:`plunger-${delay}`,plunger:true,delay,x:906.5192,y:1900.1128,z:25,vx:0,vy:0,sampleCount:100});
}
if(probeKind==='autofire'){
  reference.impulseOverrides={randomOut:0};
  cases.length=0;
  cases.push({name:'coil-rest',autofire:true,delay:40,x:906.8096,y:1904.0642,z:25,vx:0,vy:0,sampleCount:24});
  cases.push({name:'coil-edge',autofire:true,delay:40,x:906.8096,y:1862.0642,z:25,vx:0,vy:0,sampleCount:24});
  cases.push({name:'coil-miss',autofire:true,delay:40,x:906.8096,y:1840,z:25,vx:0,vy:0,sampleCount:24});
}
if(probeKind==='nudge'){
  cases.length=0;
  const pocket=process.argv.includes('--pocket');reference.nudgeScenario=pocket?'target-wire-pocket-delayed':'flat';
  for(const angle of [0,90,270])cases.push({name:`nudge-${angle}`,nudgeAngle:angle,force:2,x:pocket?612.3:430,y:pocket?803.1:1500,z:25,vx:0,vy:0,sampleCount:pocket?120:24,...(pocket?{delay:1000}:{})});
}
if(probeKind==='spinners'){
  cases.length=0;
  const specs=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects;
  for(const spinner of specs.filter(s=>s.kind==='Spinner'))for(const [direction,speed]of [[1,6],[1,12],[-1,12],[1,24]]){
    const a=spinner.rotation*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},p=spinner.center;
    cases.push({name:`${spinner.name}-${direction>0?'forward':'reverse'}-${speed}`,spinner:spinner.name,direction,speed,x:p.x-n.x*60*direction,y:p.y-n.y*60*direction,z:25,vx:n.x*speed*direction,vy:n.y*speed*direction,sampleCount:180,parkFromSample:12});
  }
  for(const c of cases.filter(c=>c.name.endsWith('forward-12')))cases.push({...c,name:c.name.replace('forward','overhead'),z:120,sampleCount:60});
}
if(probeKind==='gates'){
  cases.length=0;
  const specs=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects;
  for(const gate of specs.filter(s=>s.kind==='Gate'))for(const [direction,open,overhead]of [[1,false,false],[-1,false,false],[1,true,false],[1,false,true]]){
    const a=gate.rotation*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},p=gate.center,z=gate.surface?115:25;
    cases.push({name:`${gate.name}-${overhead?'overhead':open?'open':direction>0?'forward':'reverse'}`,gate:gate.name,direction,open,x:p.x-n.x*60*direction,y:p.y-n.y*60*direction,z:z+(overhead?100:0),vx:n.x*12*direction,vy:n.y*12*direction,sampleCount:120,parkFromSample:12});
  }
  for(const gate of specs.filter(s=>s.kind==='Gate'))cases.push({name:gate.name+'-open-close',gate:gate.name,open:true,closeDelay:400,x:430,y:1500,z:25,vx:0,vy:0,sampleCount:120,parkFromSample:0});
}
if(probeKind==='targets'){
  cases.length=0;
  const spec=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects.find(s=>s.name==='Target010'),a=spec.rot_z*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},offset=.181738*spec.size.y;
  for(const name of ['Target001','Target005','Target013']){
    const target=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects.find(s=>s.name===name),angle=target.rot_z*Math.PI/180,normal={x:-Math.sin(angle),y:Math.cos(angle)},front=Math.max(...target.collision_mesh.vertices.map(v=>v[1]))*target.size.y;
    cases.push({name:name+'-standup-front',target:name,x:target.position.x+normal.x*(front+25.01),y:target.position.y+normal.y*(front+25.01),z:25,vx:-normal.x*8,vy:-normal.y*8,sampleCount:60});
    const tangent={x:Math.cos(angle),y:Math.sin(angle)};
    cases.push({name:name+'-standup-face',target:name,x:target.position.x+normal.x*(front+25.01)+tangent.x*target.size.x*.4,y:target.position.y+normal.y*(front+25.01)+tangent.y*target.size.x*.4,z:45,vx:-normal.x*8,vy:-normal.y*8,sampleCount:60});
  }
  cases.push({name:'Target010-front-corner',target:'Target010',x:590.6739702224731,y:837.7343965530396,z:25.33487311553955,vx:-8.314886093139648,vy:-4.348639488220215,vz:-.29163968563079834,sampleCount:60});
  cases.push({name:'Target010-front-face',target:'Target010',x:spec.position.x+n.x*(offset+40),y:spec.position.y+n.y*(offset+40),z:25,vx:-n.x*8,vy:-n.y*8,sampleCount:60});
  cases.push({name:'Target011-timed-hold',target:'Target011',x:612.3,y:803.1,z:25,vx:0,vy:0,sampleCount:540,setupCode:'bLilDPMB=True:bMultiBallMode=True:LilDPHits=4:LilDPHitsNeeded(CurrentPlayer)=1:LilDPJackpot(CurrentPlayer)=500000:LilDPTimer.Enabled=False:LilDPTimer.Interval=100:LilDPTimer.Enabled=True'});
  cases.push({name:'Target011-soak-hold',target:'Target011',x:612.3,y:803.1,z:25,vx:0,vy:0,sampleCount:1080,setupCode:'bLilDPMB=True:bMultiBallMode=True:LilDPHits=4:LilDPHitsNeeded(CurrentPlayer)=3:LilDPJackpot(CurrentPlayer)=790000:LilDPTimer.Enabled=False:LilDPTimer.Interval=350:LilDPTimer.Enabled=True'});
}
if(exactDelay!==undefined){
  const driven=cases.filter(s=>!selected||s.name===selected);
  assert.ok(driven.length&&driven.every(s=>s.side||s.plunger),'exact clock scheduling requires selected flipper or plunger scenarios');
}
try{
  await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  if(recordRng)await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.nativeReferenceMemories=[];
    for(const method of ['instantiate','instantiateStreaming']){
      const original=WebAssembly[method];if(!original)continue;
      WebAssembly[method]=async function(...args){const result=await original.apply(WebAssembly,args),instance=result.instance??result;
        for(const value of Object.values(instance.exports??{}))if(value instanceof WebAssembly.Memory&&!window.nativeReferenceMemories.includes(value))window.nativeReferenceMemories.push(value);
        return result;
      };
    }
  `});
  if(recordRngSites)await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeRngSites.toString()+')('+JSON.stringify(reference.runtimeRngSites)+')'});
  await call('Page.navigate',{url:base});console.log('Loading native contact reference');
  await wait('!!window.finni && !document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("playing")');
  // Table startup creates three bobble-animation balls before its delayed
  // playable ball. Waiting for the real plunger switch avoids measuring a toy
  // that the authored rolling/spin controller deliberately skips.
  await wait('document.body.classList.contains("ball-in-plunger")');
  if(reference.runtimeInputSequence)await script(reference.runtimeInputSequence.code);
  if(observeScriptClocks){await script(scriptClockObserver+'\nDebug.Print "SCRIPT_CLOCK_OBSERVER_READY|1"');assert.ok((await evaluate('document.getElementById("log").textContent')).includes('SCRIPT_CLOCK_OBSERVER_READY|1'),'native diagnostic function declaration accepted');}
  if(recordRng)await evaluate(`(()=>{
    const memory=window.nativeReferenceMemories.find(m=>m.buffer.byteLength>${reference.nativeRandom.stateAddress+8});if(!memory)throw Error('Native WASM memory was not observed');
    const element=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');window.nativeRandomRecords=[];window.nativeAnimationRecords=[];window.nativeScriptClocks=[];window.nativeInputRecords=[];window.nativeFlipperContacts=[];window.nativePulseRecords=[];
    ${recordInternals?`window.nativeBallObserver=(${nativeBallMemoryObserver.toString()})(memory,[0,0.17098337411880493,-1.626798152923584],${reference.nativePhysicsMaxLoops},${recordContactSlots},${liveBodyState});window.nativeInternalSnapshots=[];`:''}
    ${recordPlunger?`window.nativePlungerObserver=(${nativePlungerMemoryObserver.toString()})(memory,${JSON.stringify(plungerSpec)});window.nativePlungerLayout=window.nativePlungerObserver.scan();const readBallState=window.nativeBallObserver.read;window.nativeBallObserver.read=rows=>({...readBallState(rows),plunger:window.nativePlungerObserver.read()});`:''}
    Object.defineProperty(element,'textContent',{get(){return descriptor.get.call(this);},set(value){
      const line=String(value).split('\\n').at(-1),match=line.match(/(RNG_FRAME|CONTACT_INIT)\\|(\\d+)/);
      ${reference.runtimeInputSequence?`if(line.includes('GAME_PULSE|')){const [ms,phase]=line.slice(line.indexOf('GAME_PULSE|')+11).replace(/'$/,'').split('|');window.nativePulseRecords.push({ms:Number(ms),phase});return;}`:''}
      ${reference.runtimeInputSequence?`if(line.includes('GAME_INPUT|')){const [ms,index,key]=line.slice(line.indexOf('GAME_INPUT|')+11).replace(/'$/,'').split('|').map(Number);if(!Number.isInteger(ms)||!Number.isInteger(index)||!Number.isInteger(key))throw Error('Invalid native input observation');window.nativeInputRecords.push({ms,index,key});return;}if(line.includes('GAME_FLIPPER|')){const [ms,side,speed,id]=line.slice(line.indexOf('GAME_FLIPPER|')+13).replace(/'$/,'').split('|');window.nativeFlipperContacts.push({ms:Number(ms),side,speed:Math.fround(Number(speed)),id:Number(id)});return;}`:''}
      ${reference.instrumentation?.scriptClockInputs?`if(line.includes('SCRIPT_CLOCK|')){const fields=line.slice(line.indexOf('SCRIPT_CLOCK|')+13).replace(/'$/,'').split('|').map(Number);if(fields.length!==3||fields[1]!==4||!fields.every(Number.isFinite))throw Error('Invalid native script clock input');window.nativeScriptClocks.push({ms:fields[0],type:fields[1],value:Math.fround(fields[2])});return;}`:''}
      ${recordAnimationFrames?`if(line.includes('ANIMATION_FRAME|')){const row=line.slice(line.indexOf('ANIMATION_FRAME|')+16).replace(/'$/,'').split('|').map(Number);if(row.length!==9||!row.every(Number.isFinite))throw Error('Invalid native animation-frame observation');window.nativeAnimationRecords.push(row);return;}`:''}
      ${recordPlunger?`if(line.includes('PLUNGER_ABI_CHECK|')){const expected=Number(line.slice(line.indexOf('PLUNGER_ABI_CHECK|')+18).replace(/'$/,'')),actual=window.nativePlungerObserver.read().position;window.nativePlungerValidation={expected,actual,agrees:Math.fround(expected)===actual};}`:''}
      ${recordInternals?`if(line.includes('BALL_SCAN|')||line.includes('BALL_INIT|')){try{const kind=line.includes('BALL_SCAN|')?'BALL_SCAN':'BALL_INIT',payload=line.slice(line.indexOf(kind+'|')),[,clock,bodyRows]=payload.split('|'),rows=bodyRows.replace(/'$/,'').split(';').filter(Boolean).map(row=>row.split(':').map((${referenceNumber.toString()})));if(kind==='BALL_SCAN')window.nativeBallLayout=window.nativeBallObserver.scan(rows);else window.nativeInternalSnapshots.push({ms:Number(clock),...window.nativeBallObserver.read(rows)});}catch(error){window.nativeBallObserverFailure=error.message;}}`:''}
      // The RNG marker is a diagnostic memory-read clock. Rendering it into
      // the log at 1000Hz can exhaust VPX's timer budget and skip callbacks.
      if(match?.[1]!=='RNG_FRAME')descriptor.set.call(this,value);if(!match)return;
      const data=new DataView(memory.buffer),low=data.getUint32(${reference.nativeRandom.stateAddress},true),high=data.getUint32(${reference.nativeRandom.stateAddress+4},true);
      ${recordRngSites?`if(match[1]==='CONTACT_INIT'){nativeRngSiteObservation.records.length=0;nativeRngSiteObservation.origin=Number(match[2]);nativeRngSiteObservation.armed=true;}`:''}
      const record={kind:match[1],ms:Number(match[2]),low,high${recordInternals?`,internals:window.nativeBallLayout?window.nativeBallObserver.read():undefined`:''}};
      ${recordScriptRng?`if(match[1]==='RNG_FRAME'){const state=Number(line.slice(line.indexOf('RNG_FRAME|')).replace(/'$/,'').split('|')[2]);if(!Number.isInteger(state)||state<0||state>=16777216)throw Error('Invalid native script RNG state');if(record.internals)record.internals.scriptRandom=state;}`:''}
      window.nativeRandomRecords.push(record);
    }});return true;
  })()`);
  if(recordPlunger){
    await script('Debug.Print "PLUNGER_ABI_CHECK|" & CStr(CDbl(Plunger.Position))');
    reference.nativePlungerMemory=await evaluate('({layout:window.nativePlungerLayout,validation:window.nativePlungerValidation})');
    assert.ok(reference.nativePlungerMemory.validation?.agrees,'native plunger COM Position validates the memory ABI');
  }
  if(omitStateTrace){await script('RefStateTraceOn=False');reference.stateTraceCaptured=false;}
  const rawAnimation=process.argv.includes('--raw-animation')||probeKind==='ball-pairs';
  await script(`Dim RefBalls,RefBall:RefBalls=GetBalls:Set RefBall=RefBalls(${ballIndex??(rawAnimation?'0':'UBound(RefBalls)')})`);
  if(probeKind==='ball-pairs')await script('Dim RefOtherBall:Set RefOtherBall=RefBalls(1)');
  if(recordAllBalls)await script('Dim RefInitBalls,RefInitBall,RefInitIdx,RefInitTrace,RefExactValue,RefExactExponent');
  if(recordInternals){
    await script('RefInitBalls=GetBalls:RefInitTrace="":For RefInitIdx=0 To UBound(RefInitBalls):Set RefInitBall=RefInitBalls(RefInitIdx):'+ballStateRow()+':RefInitTrace=RefInitTrace & ";":Next:Debug.Print "BALL_SCAN|" & GameTime & "|" & RefInitTrace');
    reference.nativeMemoryLayout=await evaluate('window.nativeBallLayout');assert.ok(reference.nativeMemoryLayout,await evaluate('window.nativeBallObserverFailure'));
  }
  await script('Debug.Print "REFERENCE_RULE_STATE|" & (UBound(RefBalls)+1) & ":" & CLng(RollingTimer.Enabled) & ":" & maxvel & ":" & lob');
  const state=(await marker('REFERENCE_RULE_STATE')).split(':').map(parseFloat);assert.equal(state.length,4);assert.ok(state.every(Number.isFinite));
  const measuredBallIndex=ballIndex??(rawAnimation?0:state[0]-1);assert.ok(measuredBallIndex<state[0],'Measured native body exists');
  reference.nativeRuleState={ballCount:state[0],measuredBallIndex,measuredBallRole:measuredBallIndex<state[3]?'animation':'playable',rollingTimerEnabled:!!state[1],maxvel:state[2],lockedBallOffset:state[3]};console.log('Native rule state',JSON.stringify(reference.nativeRuleState));
  reference.comparisonScope=reference.nativeRuleState.measuredBallRole==='animation'?'raw physical ball excluded by the authored playable-ball spin/speed controller':'playable ball including authored spin and speed controls';
  assert.ok(state[0]>state[3],'playable ball exists after the animation balls');
  await script('LeftFlipper.Scatter=0:RightFlipper.Scatter=0');
  const disabled=process.argv.find(a=>a.startsWith('--disable='))?.slice(10).split(',')??[];
  for(const name of disabled){
    assert.match(name,/^[A-Za-z][A-Za-z0-9_]*$/);
    await script(`${name}.Collidable=False`);runtimeOverrides[`${name}.Collidable`]=false;
  }
  if(process.argv.includes('--rotate-camera')){
    await script('Camera1.RotY=90');runtimeOverrides['Camera1.RotY']=90;
  }
  if(['spinners','gates','triggers','ball-pairs','bumpers','slingshots','flipper-events','material-events','target-events'].includes(probeKind)){
    const specs=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects;
    const overrides=[];
    for(const s of specs){
      if(s.name==='playfield_mesh'||!Number.isInteger(s.native_source_order))continue;
      const property=['Wall','Ramp','Primitive','HitTarget','Bumper','Gate','Rubber'].includes(s.kind)?'Collidable':s.kind==='Trigger'?'Enabled':null;
      if(property){overrides.push({name:s.name,property});runtimeOverrides[`${s.name}.${property}`]=false;}
    }
    await script('Dim RefElement');
    for(let i=0;i<overrides.length;i+=20){
      const batch=overrides.slice(i,i+20),lookup=o=>`Set RefElement=GetElementByName("${o.name.replaceAll('"','""')}")`;
      await script(batch.map(o=>`${lookup(o)}:RefElement.${o.property}=False`).join(':'));
      const label=`ISOLATION_FLAGS_${i}`;
      await script(`Debug.Print "${label}|" & `+batch.map(o=>`CLng(GetElementByName("${o.name.replaceAll('"','""')}").${o.property})`).join(' & ":" & '));
      await wait(`document.getElementById('log').textContent.includes(${JSON.stringify(label+'|')})`);
      const flags=(await marker(label)).split(':').map(parseFloat);assert.equal(flags.length,batch.length);assert.ok(flags.every(n=>n===0),'native mechanism isolation setters took effect');
    }
    reference.isolation='Other authored solid geometry and switches disabled; cabinet bounds and the playfield retained. From parkFromSample onward, reset the measured ball to a remote flat spot immediately before each observation so the plate coasts without further strikes.';
    const settingsKey=probeKind==='gates'?'nativeGateProperties':'nativeSpinnerProperties';if(!['triggers','ball-pairs','bumpers','slingshots','flipper-events','material-events','target-events'].includes(probeKind))reference[settingsKey]={};
    for(const name of ['triggers','ball-pairs','bumpers','slingshots','flipper-events','material-events','target-events'].includes(probeKind)?[]:probeKind==='gates'?['Gate001','Gate002','Gate3','Gate4']:['Spinner001','Spinner002']){
      const properties=['Height','Length','Rotation','Damping',...(probeKind==='gates'?['OpenAngle','CloseAngle']:['AngleMin','AngleMax']),'Elasticity'];
      await script('Debug.Print "SPINNER_SETTINGS|" & '+properties.map(p=>`${name}.${p}`).join(' & ":" & '));
      const values=(await marker('SPINNER_SETTINGS')).split(':').map(parseFloat);assert.ok(values.every(Number.isFinite));
      reference[settingsKey][name]=Object.fromEntries(properties.map((p,i)=>[p,values[i]]));
    }
    if(process.argv.includes('--isolate-animation-balls')){
      await script('Dim RefToyBall');reference.animationBallIsolation=[];
      for(let i=0;i<state[3];i++){
        const x=-10000-i*200;await script(`Set RefToyBall=RefBalls(${i}):RefToyBall.X=${x}:RefToyBall.Y=0:RefToyBall.Z=-1000:RefToyBall.VelX=0:RefToyBall.VelY=0:RefToyBall.VelZ=0`);
        reference.animationBallIsolation.push({index:i,x,y:0,z:-1000});
      }
    }
  }
  if(probeKind==='plunger'){
    const properties=['ParkPosition','Stroke','PullSpeed','FireSpeed','MomentumXfer','MechStrength'];
    await script('Debug.Print "PLUNGER_SETTINGS|" & '+properties.map(p=>`Plunger.${p}`).join(' & ":" & '));
    const values=(await marker('PLUNGER_SETTINGS')).split(':').map(parseFloat);assert.equal(values.length,properties.length);assert.ok(values.every(Number.isFinite));
    reference.nativePlungerProperties=Object.fromEntries(properties.map((p,i)=>[p,values[i]]));console.log('Native plunger settings',JSON.stringify(reference.nativePlungerProperties));
  }
  if(probeKind==='autofire'){
    await script('PlungerIM.Random 0:Dim RefCoilBalls,RefCoilBall,RefCoilTrace');
    await script('Debug.Print "COIL_SETTINGS|" & PlungerIM.Strength & ":" & PlungerIM.Time & ":" & PlungerIM.RandomOut');
    const [strength,time,randomOut]=(await marker('COIL_SETTINGS')).split(':').map(parseFloat);
    reference.nativeImpulsePlungerProperties={strength,time,randomOut};assert.equal(strength,45);assert.equal(randomOut,0);
  }
  if(process.argv.includes('--isolate-floor')){
    await script('Ramp020.Collidable=False:Target011.Collidable=False:rpeg001.Collidable=False');
    Object.assign(runtimeOverrides,{'Ramp020.Collidable':false,'Target011.Collidable':false,'rpeg001.Collidable':false});
    await script('Debug.Print "ISOLATE|" & Ramp020.Collidable & ":" & Target011.Collidable & ":" & playfield_mesh.Collidable');
    const flags=await marker('ISOLATE');assert.ok(flags.startsWith('False:False:True'),'slot neighbors disabled');console.log('Slot neighbor isolation flags',flags);
  }
  const results=[];
  for(const scenario of cases.filter(s=>!selected||s.name===selected)){
    if(recordRng)await evaluate('window.nativeRandomRecords.length=0;window.nativeAnimationRecords.length=0;window.nativeScriptClocks.length=0;window.nativeInputRecords.length=0;window.nativeFlipperContacts.length=0;window.nativePulseRecords.length=0');
    if(recordTrails)await script('RefTrailOn=True');
    await script(`SolLFlipper 0:SolRFlipper 0:${reset(430,1400,0,0)}`);await new Promise(r=>setTimeout(r,400));
    if(scenario.plunger){await script('Plunger.Fire');await new Promise(r=>setTimeout(r,600));}
    if(scenario.startRaised){await script(`Sol${scenario.side==='left'?'L':'R'}Flipper 1`);await new Promise(r=>setTimeout(r,200));}
    if(scenario.gate){
      scenario.runtimeOverrides={[`${scenario.gate}.Collidable`]:true,[`${scenario.gate}.Open`]:scenario.open};
      await script(`${scenario.gate}.Collidable=True:${scenario.gate}.Open=False`);
      await script(`Debug.Print "GATE_STATE|" & CLng(${scenario.gate}.Collidable) & ":" & CLng(${scenario.gate}.Open)`);
      assert.deepEqual((await marker('GATE_STATE')).split(':').map(parseFloat),[-1,0]);
    }
    if(scenario.trigger){scenario.runtimeOverrides={[`${scenario.trigger}.Enabled`]:true};await script(`${scenario.trigger}.Enabled=True`);}
    if(scenario.bumper){
      for(const name of ['Bumper1','Bumper2','Bumper3'])await script(`${name}.Collidable=False`);
      scenario.runtimeOverrides=Object.fromEntries(Object.entries({Collidable:true,Threshold:1,Force:10,HasHitEvent:true,...scenario.bumperOverrides}).map(([key,value])=>[`${scenario.bumper}.${key}`,value]));
      await script(reference.ruleControls+':'+Object.entries(scenario.runtimeOverrides).map(([key,value])=>`${key}=${typeof value==='boolean'?value?'True':'False':value}`).join(':'));
      const keys=['Collidable','Threshold','Force','HasHitEvent'];
      await script('Debug.Print "BUMPER_SETTINGS|" & '+keys.map(key=>(key==='Collidable'||key==='HasHitEvent'?'CLng('+scenario.bumper+'.'+key+')':scenario.bumper+'.'+key)).join(' & ":" & '));
      const actual=(await marker('BUMPER_SETTINGS')).split(':').map(parseFloat),expected=keys.map(key=>{const value=scenario.runtimeOverrides[scenario.bumper+'.'+key];return typeof value==='boolean'?value?-1:0:value;});assert.deepEqual(actual,expected,'native bumper runtime setters took effect');
    }
    if(scenario.slingshot){
      await script(reference.ruleControls);
      await script('Leftslingshot.Collidable=False:Rightslingshot.Collidable=False');
      scenario.runtimeOverrides=Object.fromEntries(Object.entries({Collidable:true,Disabled:false,SlingshotThreshold:3,...scenario.slingshotOverrides}).map(([key,value])=>[`${scenario.slingshot}.${key}`,value]));
      for(const [path,value]of Object.entries(scenario.runtimeOverrides))await script(path+'='+(typeof value==='boolean'?value?'True':'False':value));
      const keys=['Collidable','Disabled','SlingshotThreshold'];await script('Debug.Print "SLING_SETTINGS|" & '+keys.map(key=>key==='SlingshotThreshold'?scenario.slingshot+'.'+key:'CLng('+scenario.slingshot+'.'+key+')').join(' & ":" & '));
      assert.deepEqual((await marker('SLING_SETTINGS')).split(':').map(parseFloat),keys.map(key=>{const value=scenario.runtimeOverrides[scenario.slingshot+'.'+key];return typeof value==='boolean'?value?-1:0:value;}),'native slingshot runtime setters took effect');
    }
    if(probeKind==='material-events'){
      await script(reference.ruleControls);
      const objects=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects;
      await script([...new Set(cases.map(c=>c.object))].map(name=>name+'.Collidable=False').join(':'));
      const spec=objects.find(o=>o.name===scenario.object),settings={Collidable:true,HasHitEvent:spec.hit_event,...(spec.kind==='Rubber'?{}:{Threshold:spec.threshold}),...scenario.objectOverrides};
      scenario.runtimeOverrides=Object.fromEntries(Object.entries(settings).map(([key,value])=>[scenario.object+'.'+key,value]));
      for(const [path,value]of Object.entries(scenario.runtimeOverrides))await script(path+'='+(typeof value==='boolean'?value?'True':'False':value));
      await script('Debug.Print "MATERIAL_SETTINGS|" & '+Object.keys(settings).map(key=>'CLng('+scenario.object+'.'+key+')').join(' & ":" & '));
      assert.deepEqual((await marker('MATERIAL_SETTINGS')).split(':').map(parseFloat),Object.values(settings).map(value=>typeof value==='boolean'?value?-1:0:value),'native material runtime setter readback');
    }
    if(probeKind==='target-events'){
      await script(reference.ruleControls);
      await script([...new Set(cases.map(c=>c.object))].map(name=>name+'.Collidable=False').join(':'));
      const settings={Collidable:true,HasHitEvent:true,Threshold:2,IsDropped:false,...scenario.objectOverrides};
      scenario.runtimeOverrides=Object.fromEntries(Object.entries(settings).map(([key,value])=>[scenario.object+'.'+key,value]));
      for(const [path,value]of Object.entries(scenario.runtimeOverrides))await script(path+'='+(typeof value==='boolean'?value?'True':'False':value));
      await script('Debug.Print "TARGET_SETTINGS|" & '+Object.keys(settings).map(key=>'CLng('+scenario.object+'.'+key+')').join(' & ":" & '));
      assert.deepEqual((await marker('TARGET_SETTINGS')).split(':').map(parseFloat),Object.values(settings).map(value=>typeof value==='boolean'?value?-1:0:value),'native target setter readback');
    }
    const command=scenario.setupCode??((scenario.repeatBumperReset||scenario.repeatFlipperReset)?reset(scenario.x,scenario.y,scenario.vx,scenario.vy,scenario.z,scenario.vz):scenario.autofire?'PlungerIM.AutoFire':scenario.gate?`${scenario.gate}.Open=${scenario.open?'True':'False'}`:scenario.plunger?'Plunger.Fire':scenario.nudgeAngle!==undefined?`Nudge ${scenario.nudgeAngle},${scenario.force}`:scenario.side?`Sol${scenario.side==='left'?'L':'R'}Flipper ${scenario.press===false?0:1}`:'');
    const inputMarker=`CONTACT_INPUT_${scenario.name}`;
    const input=`Debug.Print "${inputMarker}|" & GameTime:${command}`;
    let drive=command?(scenario.delay?`vpmtimer.addtimer ${scenario.delay},"${input.replaceAll('"','""')} '"`:input):'';
    if(exactDelay!==undefined&&(scenario.side||scenario.plunger))drive=`RefDriveMarker="${inputMarker}":RefDriveSide=${scenario.plunger?3:scenario.side==='left'?1:2}:RefDrivePress=${scenario.press===false?0:1}:RefDriveAt=GameTime+${Number(exactDelay)}`;
    if(scenario.plunger)drive='Plunger.PullBack:'+drive;
    if(reference.runtimeInputSequence)drive+=':RefInputStart=GameTime:RefInputIndex=0';
    const closeMarker=`CONTACT_GATE_CLOSE_${scenario.name}`;
    if(scenario.closeDelay){const close=`Debug.Print "${closeMarker}|" & GameTime:${scenario.gate}.Open=False`;drive+=`:vpmtimer.addtimer ${scenario.closeDelay},"${close.replaceAll('"','""')} '"`;}
    const trace=recordTimers?`RefTrace="":Set RefTraceBall=RefBall:${traceFrom?`RefTraceFrom=GameTime+${traceFrom}:`:''}RefTraceUntil=GameTime+${traceMilliseconds}:RefTraceOn=True:`:'';
    // Capture every body in the same synchronous call as the measured reset.
    // Explicit Double formatting preserves the original Single's low bits.
    const allBalls=recordAllBalls?'RefInitBalls=GetBalls:RefInitTrace="":For RefInitIdx=0 To UBound(RefInitBalls):Set RefInitBall=RefInitBalls(RefInitIdx):'+ballStateRow()+':RefInitTrace=RefInitTrace & ";":Next:Debug.Print "BALL_INIT|" & GameTime & "|" & RefInitTrace:':'';
    const plungerInit=scenario.plunger?'Debug.Print "PLUNGER_INIT|" & CStr(CDbl(Plunger.Position)):':'';
    const coilInit=scenario.autofire?'RefCoilBalls=PlungerIM.Balls:RefCoilTrace="":For Each RefCoilBall In RefCoilBalls:RefCoilTrace=RefCoilTrace & RefCoilBall.ID & ",":Next:Debug.Print "COIL_INIT|" & swPlunger.BallCntOver & ":" & swPlungerRest.BallCntOver & ":" & CLng(bBallInPlungerLane) & ":" & RefCoilTrace:':'';
    const scriptRngInit=recordScriptRng?'Debug.Print "SCRIPT_RANDOM_INIT|" & CLng(Rnd(0)*16777216):':'';
    const finishTrail=recordTrails?'RefTrailOn=False:RefTrailBalls=GetBalls:RefTrailRow=CStr(GameTime) & "|":For RefTrailIndex=0 To UBound(RefTrailBalls):Set RefTrailBall=RefTrailBalls(RefTrailIndex):RefTrailRow=RefTrailRow & RefTrailBall.ID & ":" & CStr(CDbl(RefTrailBall.X)) & ":" & CStr(CDbl(RefTrailBall.Y)) & ":" & CStr(CDbl(RefTrailBall.Z)) & ";":Next:RefTrailSlots((GameTime\\10) Mod 10)=RefTrailRow:':'';
    const other=scenario.otherBall,otherReset=other?(other.spawn?`Set RefOtherBall=${other.spawn}.CreateBall:`:'')+reset(other.x,other.y,other.vx,other.vy,other.z,other.vz).replaceAll('RefBall.','RefOtherBall.')+':':'';
    await script(`${finishTrail}${trace}RollingTimer.Enabled=False:RollingTimer.Enabled=True:${reset(scenario.x,scenario.y,scenario.vx,scenario.vy,scenario.z,scenario.vz)}:${otherReset}${allBalls}${plungerInit}${coilInit}${drive?drive+':':''}${scriptRngInit}Debug.Print "CONTACT_INIT|" & GameTime & ":" & RefBall.AngMomX & ":" & RefBall.AngMomY & ":" & RefBall.AngMomZ & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z`);
    const initial=(await marker('CONTACT_INIT')).split(':').map(parseFloat);assert.equal(initial.length,7);assert.deepEqual(initial.slice(1,4),[0,0,0],'native spin reset');
    const initialScriptRandom=recordScriptRng?Number((await marker('SCRIPT_RANDOM_INIT')).replace(/'$/,'')):undefined;
    if(recordScriptRng)assert.ok(Number.isInteger(initialScriptRandom)&&initialScriptRandom>=0&&initialScriptRandom<16777216,'observed initial native script RNG state');
    for(const [actual,expected]of [[initial[4],scenario.x],[initial[5],scenario.y],[initial[6],scenario.z??25]])assert.ok(Math.abs(actual-expected)<.001,`native initial position ${actual} vs ${expected}`);
    const origin=initial[0],samples=[],rawSamples=[];
    const initialPlungerPosition=scenario.plunger?parseFloat(await marker('PLUNGER_INIT')):undefined;
    if(scenario.plunger)assert.ok(Number.isFinite(initialPlungerPosition));
    let initialCoilState;
    if(scenario.autofire){const [coil,rest,inLane,ids]=(await marker('COIL_INIT')).replace(/'$/,'').split(':');initialCoilState={coilCount:Number(coil),restCount:Number(rest),inLane:Number(inLane)!==0,ballIDs:ids.split(',').filter(Boolean).map(Number)};}
    const initialNativeInternals=recordInternals?await evaluate(`window.nativeInternalSnapshots.find(row=>row.ms===${origin})`):undefined;
    if(recordInternals)assert.ok(initialNativeInternals,'native internal state at the initial clock');
    let initialBallStates,rawInitialBallStates,initialMeasuredBallID;
    const initialBallTrails=[],rawInitialBallTrails=[];
    if(recordAllBalls){
      rawInitialBallStates=(await marker('BALL_INIT')).replace(/'$/,'');const [clock,rows]=rawInitialBallStates.split('|');assert.equal(Number(clock),origin,'all bodies share the initial clock');
      initialBallStates=rows.split(';').filter(Boolean).map(row=>row.split(':').map(referenceNumber));
      assert.ok(initialBallStates.length>=state[0]);assert.ok(initialBallStates.every(row=>row.length===ballStateFields.length&&row.every(Number.isFinite)));
      await script('Debug.Print "MEASURED_BALL_ID|" & RefBall.ID');initialMeasuredBallID=parseFloat(await marker('MEASURED_BALL_ID'));assert.ok(initialBallStates.some(row=>row.at(-1)===initialMeasuredBallID));
    }
    // The native UI retains only 120 log lines. Cache delayed input clocks as
    // soon as they appear, before a long observation run rolls them out.
    let inputAt,closeAt;
    const captureInput=async()=>{
      if(command&&inputAt===undefined&&await evaluate(`document.getElementById('log').textContent.includes(${JSON.stringify(inputMarker+'|')})`))inputAt=parseFloat(await marker(inputMarker));
      if(scenario.closeDelay&&closeAt===undefined&&await evaluate(`document.getElementById('log').textContent.includes(${JSON.stringify(closeMarker+'|')})`))closeAt=parseFloat(await marker(closeMarker));
    };
    await captureInput();
    for(let i=0;i<(scenario.sampleCount??12)||captureThrough!==undefined&&(samples.at(-1)?.[0]??-1)<captureThrough||recordThrough!==undefined&&(samples.at(-1)?.[0]??-1)<recordThrough;i++){
      const park=scenario.parkFromSample!==undefined&&i>=scenario.parkFromSample?reset(430,1500,0,0)+':':'';
      const mechanism=scenario.spinner??scenario.gate;
      const targetFields=scenario.target?['Target009','Target010','Target011'].map(n=>`CLng(${n}.IsDropped)`).concat(['Target009','Target010','Target011'].map(n=>`CLng(${n}.CurrentAnimOffset*1000000)`),'Score(CurrentPlayer)'):null;
      const pairFields=scenario.otherBall?['X','Y','Z',...['VelX','VelY','VelZ','AngVelX','AngVelY','AngVelZ']].map((p,i)=>i<3?`RefOtherBall.${p}`:`CLng(RefOtherBall.${p}*1000000)`):null;
      const extra=pairFields?' & ":" & '+pairFields.join(' & ":" & '):['material-events','target-events'].includes(probeKind)?" & \":\" & Score(CurrentPlayer)":scenario.slingshot?" & \":\" & Score(CurrentPlayer)":scenario.bumper?' & ":" & Score(CurrentPlayer) & ":" & BumperHits(CurrentPlayer)':scenario.autofire?' & ":" & Plunger.Position & ":" & (UBound(PlungerIM.Balls)+1)':scenario.kicker?' & ":" & (UBound(GetBalls)+1) & ":" & Score(CurrentPlayer) & ":" & BallsInHole':scenario.trigger?` & ":" & ${scenario.trigger}.BallCntOver`:mechanism?` & ":" & CLng(${mechanism}.CurrentAngle*1000000) & ":" & Score(CurrentPlayer) & ":" & LeftSpinnerCount(CurrentPlayer)`:targetFields?' & ":" & '+targetFields.join(' & ":" & '):scenario.plunger?' & ":" & Plunger.Position':'';
      await script(park+'Debug.Print "CONTACT_SAMPLE|" & GameTime & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z & ":" & CLng(RefBall.VelX*1000000) & ":" & CLng(RefBall.VelY*1000000) & ":" & CLng(RefBall.VelZ*1000000) & ":" & CLng(RefBall.AngVelX*1000000) & ":" & CLng(RefBall.AngVelY*1000000) & ":" & CLng(RefBall.AngVelZ*1000000) & ":" & CStr(CDbl(LeftFlipper.CurrentAngle)) & ":" & CStr(CDbl(RightFlipper.CurrentAngle))'+extra);
      const raw=await marker('CONTACT_SAMPLE');rawSamples.push(raw);
      const values=raw.split(':').map(parseFloat);assert.equal(values.length,columns.length);assert.ok(values.every(Number.isFinite));for(let k=4;k<10;k++)values[k]/=1000000;values[0]-=origin;samples.push(values);
      if(pairFields)for(let k=15;k<21;k++)values[k]/=1000000;
      if(mechanism)values[12]/=1000000;
      if(scenario.target)for(let k=15;k<=17;k++)values[k]/=1000000;
      await captureInput();
      if(scenario.maximumMilliseconds!==undefined&&values[0]>=scenario.maximumMilliseconds)break;
      await new Promise(r=>setTimeout(r,5));
    }
    if(captureThrough!==undefined)assert.ok(samples.at(-1)[0]>=captureThrough,'Native observations cover the requested physical clock window');
    const actualDelay=command?inputAt-origin:0;assert.ok(Number.isFinite(actualDelay),'observed native input clock');
    if(scenario.gate)assert.equal(actualDelay,0,'gate command shares the initial-state clock');
    let timerTrace;
    if(recordTimers){
      await script('RefTraceOn=False:Debug.Print "TIMER_TRACE_LENGTH|" & Len(RefTrace)');
      const length=parseFloat(await marker('TIMER_TRACE_LENGTH'));assert.ok(Number.isFinite(length)&&length>0);
      let raw='';
      for(let offset=1;offset<=length;offset+=200){await script(`Debug.Print "TIMER_TRACE_CHUNK|" & Mid(RefTrace,${offset},200)`);raw+=(await marker('TIMER_TRACE_CHUNK')).replace(/'$/,'');}
      timerTrace=raw.trim().split(';').filter(Boolean).map(line=>{const [handler,ms,...fields]=line.split('|');return [handler,Number(ms)-origin,...fields.map((value,index)=>['MATERIAL','TARGET'].includes(handler)&&index===0?value:Number(value))];});
      assert.ok(timerTrace.every(([name,ms,...fields])=>['ROLL','FLIP','STATE','SPIN','BUMPER','SLING','FLIP_COLLIDE','FLIP_HIT','MATERIAL','TARGET','SCRIPT_RND'].includes(name)&&[ms,...(['MATERIAL','TARGET'].includes(name)?fields.slice(1):fields)].every(Number.isFinite)));
      assert.ok(timerTrace[0][1]<=10,'full trace must include the first timer callbacks');
    }
    const closing=scenario.closeDelay?{actualCloseDelay:closeAt-origin}:{};if(scenario.closeDelay)assert.ok(Number.isFinite(closing.actualCloseDelay)&&closing.actualCloseDelay>0,'observed native gate-close clock');
    let nativeRandomFrames,initialNativeRandom;
    if(recordRng){
      const rows=await evaluate('window.nativeRandomRecords');initialNativeRandom=rows.find(r=>r.kind==='CONTACT_INIT'&&r.ms===origin);assert.ok(initialNativeRandom,'observed initial native random state');
      nativeRandomFrames=rows.filter(r=>r.kind==='RNG_FRAME').map(({ms,low,high,internals})=>[ms-origin,low,high,...(internals?[internals]:[])]);
      assert.ok(nativeRandomFrames.length&&nativeRandomFrames[0][0]===1,'native random state for the first physics frame');
      if(captureThrough!==undefined)for(let frame=1;frame<=captureThrough;frame++)assert.equal(nativeRandomFrames[frame-1]?.[0],frame,'Requested native RNG/body capture has no missing physics boundaries');
    }
    if(recordTrails)for(let slot=0;slot<10;slot++){
      await script(`Debug.Print "TRAIL_LENGTH|" & Len(RefTrailSlots(${slot}))`);const size=parseFloat(await marker('TRAIL_LENGTH'));assert.ok(Number.isInteger(size)&&size>0,'filled native trail slot');
      let raw='';for(let offset=1;offset<=size;offset+=180){await script(`Debug.Print "TRAIL_CHUNK|" & Mid(RefTrailSlots(${slot}),${offset},180)`);raw+=(await marker('TRAIL_CHUNK')).replace(/'$/,'');}
      rawInitialBallTrails.push(raw);const [clock,positions]=raw.split('|'),ms=Number(clock);assert.ok(ms<=origin&&ms>=origin-100);assert.equal(Math.floor(ms/10)%10,slot);
      const balls=positions.split(';').filter(Boolean).map(row=>row.split(':').map(Number));assert.ok(balls.every(row=>row.length===4&&row.every(Number.isFinite)));
      initialBallTrails.push({slot,ms:ms-origin,balls});
    }
    const animationFrames=recordAnimationFrames?await evaluate(`window.nativeAnimationRecords.filter(row=>row[0]>=${origin}).map(([ms,...rest])=>[ms-${origin},...rest])`):undefined;
    if(recordAnimationFrames)assert.ok(animationFrames.length&&animationFrames.every(row=>Number.isInteger(row[0])&&Number.isInteger(row[1])&&row[1]>=0),'observed native animation frame clocks');
    results.push({...scenario,initial,actualDelay,...closing,samples,rawSamples,...(initialNativeInternals?{initialNativeInternals}:{}),...(scenario.plunger?{initialPlungerPosition}:{}),...(initialCoilState?{initialCoilState}:{}),...(timerTrace?{timerTrace}:{}),...(recordAllBalls?{initialBallStates,rawInitialBallStates,initialMeasuredBallID}:{}),...(recordTrails?{initialBallTrails,rawInitialBallTrails}:{}),...(recordRng?{initialNativeRandom,nativeRandomFrames}:{}),...(animationFrames?{animationFrames}:{}),...(recordScriptRng?{initialScriptRandom}:{})});console.log(scenario.name,'input at',actualDelay,JSON.stringify(samples.at(-1)));
    if(reference.instrumentation?.scriptClockInputs)results.at(-1).scriptClocks=await evaluate(`window.nativeScriptClocks.filter(row=>row.ms>=${origin}).map(row=>({...row,ms:row.ms-${origin}}))`);
    if(recordRngSites){await evaluate('nativeRngSiteObservation.armed=false');assert.equal(await evaluate('nativeRngSiteObservation.installed'),true);results.at(-1).rngSites=await evaluate('nativeRngSiteObservation.records');results.at(-1).rngSites=results.at(-1).rngSites.filter(row=>row.ms>=0&&row.ms<=(recordThrough??samples.at(-1)[0]));}
    if(reference.runtimeInputSequence){
      const observed=await evaluate(`window.nativeInputRecords.filter(row=>row.ms>=${origin}).map(row=>({...row,ms:row.ms-${origin}}))`);
      results.at(-1).inputSequence=observed.map((row,i)=>{assert.equal(row.index,i);const requested=reference.runtimeInputSequence.inputs[i];assert.ok(requested);assert.ok(row.ms>=requested.ms);return {...requested,requestedMilliseconds:requested.ms,ms:row.ms,key:row.key};});
      assert.equal(observed.length,reference.runtimeInputSequence.inputs.length,'every requested native input actually executed');
      results.at(-1).flipperContacts=await evaluate(`window.nativeFlipperContacts.filter(row=>row.ms>=${origin}).map(row=>({...row,ms:row.ms-${origin}}))`);
      results.at(-1).pulseTimerClocks=await evaluate(`window.nativePulseRecords.filter(row=>row.ms>=${origin}&&row.phase==='after').map(row=>row.ms-${origin})`);
      assert.ok(results.at(-1).pulseTimerClocks.length>0);for(let i=1;i<results.at(-1).pulseTimerClocks.length;i++)assert.equal(results.at(-1).pulseTimerClocks[i]-results.at(-1).pulseTimerClocks[i-1],40,'every original core timer pulse retained');
    }
    const suffix=probeKind==='ball-pairs'?`ball-pairs-${selected??'reference'}`:recordKickers?'kickers-reference':rawAnimation&&selected?`raw-${recordTimers?'timing-':''}${selected}`:reference.geometryProbe&&selected?`geometry-${recordTimers?'timing-':''}${selected}`:reference.shooterProbe&&selected?`${recordTimers?'timing-':''}${selected}`:['spinners','gates','targets','triggers','flipper-events','material-events','target-events'].includes(probeKind)&&selected?`${probeKind}-${reference.instrumentation?.spinnerTraceColumns?'timing-':''}${reference.animationBallIsolation?'isolated-animation-':''}${selected}`:`${reference.geometryProbe?'geometry':probeKind==='contacts'?'contact':probeKind}-reference`;
    const captureName=outputName??`vpx-${suffix}${recordAllBalls?'-all-balls':''}${recordTrails?'-trails':''}${recordRng?'-rng':''}${recordInternals?'-internals':''}${recordPlunger?'-plunger-state':''}${recordAnimationFrames?'-animation-frames':''}${recordScriptRng?'-script-rng':''}${recordContactSlots?'-contact-slots':''}${recordTimers&&traceMilliseconds!==70?`-${traceMilliseconds}ms`:''}${traceFrom?`-from${traceFrom}ms`:''}.json`;
    await writeFile(`${output}/${captureName}`,JSON.stringify({...reference,probeKind,runtimeOverrides,columns,cases:results},null,2));
    if(recordThrough!==undefined){assert.ok(samples.at(-1)[0]>=recordThrough);for(let frame=1;frame<=recordThrough;frame++)assert.equal(nativeRandomFrames[frame-1]?.[0],frame,'Long native recording retains every physical boundary');}
  }
}finally{socket.close();}
