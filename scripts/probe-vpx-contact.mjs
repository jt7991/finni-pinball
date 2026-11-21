// Controlled native VPX contact measurements. All state comes from the live
// engine; every case resets both linear velocity and angular momentum.
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const probeKind=process.argv.includes('--triggers')?'triggers':process.argv.includes('--targets')?'targets':process.argv.includes('--gates')?'gates':process.argv.includes('--spinners')?'spinners':process.argv.includes('--plunger')?'plunger':process.argv.includes('--nudge')?'nudge':'contacts';
const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();
const recordTimers=!!reference.instrumentation&&!process.argv.includes('--no-timer-trace');
reference.timerTraceCaptured=recordTimers;
assert.deepEqual(reference.controlledOverrides,{scatter:0,default_scatter:0},'controlled native table metadata');
const runtimeOverrides={'LeftFlipper.Scatter':0,'RightFlipper.Scatter':0};
const columns=['ms','x','y','z','vx','vy','vz','wx','wy','wz','left','right',...(probeKind==='triggers'?['balls_over']:probeKind==='plunger'?['plunger_position']:probeKind==='targets'?['target009_dropped','target010_dropped','target011_dropped','target009_offset','target010_offset','target011_offset','score']:['spinners','gates'].includes(probeKind)?[probeKind==='gates'?'gate_angle':'spinner_angle','score','left_spinner_count']:[])];
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
if(probeKind==='triggers'){
  cases.length=0;
  cases.push(
    {name:'shooter-circle',trigger:'swPlunger',x:906.8096,y:1820,z:25,vx:0,vy:12},
    {name:'wire-crossing',trigger:'Trigger005',x:840,y:317,z:25,vx:12,vy:0},
    {name:'wire-overhead',trigger:'Trigger005',x:840,y:317,z:130,vx:12,vy:0},
    {name:'circle-overhead',trigger:'Trigger014',x:309.22223,y:128.25934,z:100,vx:0,vy:0,vz:-6});
  for(const c of cases)c.sampleCount=40;
}
const selected=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
const exactDelay=process.argv.find(a=>a.startsWith('--exact-input-delay='))?.split('=')[1];
if(exactDelay!==undefined)assert.ok(reference.instrumentation&&Number.isFinite(Number(exactDelay))&&Number(exactDelay)>0,'exact clock input requires the separate instrumented table');
reference.inputScheduling=exactDelay!==undefined?{kind:'native-flipper-timer',requestedDelay:Number(exactDelay)}:{kind:'vpmtimer'};
if(probeKind==='plunger'){
  cases.length=0;
  for(const delay of [50,100,200,400,600,1000])cases.push({name:`plunger-${delay}`,plunger:true,delay,x:906.5192,y:1900.1128,z:25,vx:0,vy:0,sampleCount:100});
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
  cases.push({name:'Target010-front-corner',target:'Target010',x:590.6739702224731,y:837.7343965530396,z:25.33487311553955,vx:-8.314886093139648,vy:-4.348639488220215,vz:-.29163968563079834,sampleCount:60});
  cases.push({name:'Target010-front-face',target:'Target010',x:spec.position.x+n.x*(offset+40),y:spec.position.y+n.y*(offset+40),z:25,vx:-n.x*8,vy:-n.y*8,sampleCount:60});
  cases.push({name:'Target011-timed-hold',target:'Target011',x:612.3,y:803.1,z:25,vx:0,vy:0,sampleCount:540,setupCode:'bLilDPMB=True:bMultiBallMode=True:LilDPHits=4:LilDPHitsNeeded(CurrentPlayer)=1:LilDPJackpot(CurrentPlayer)=500000:LilDPTimer.Enabled=False:LilDPTimer.Interval=100:LilDPTimer.Enabled=True'});
}
if(exactDelay!==undefined){
  const driven=cases.filter(s=>!selected||s.name===selected);
  assert.ok(driven.length&&driven.every(s=>s.side),'exact clock scheduling requires selected flipper scenarios');
}
try{
  await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Page.navigate',{url:base});console.log('Loading native contact reference');
  await wait('!!window.finni && !document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("playing")');
  // Table startup creates three bobble-animation balls before its delayed
  // playable ball. Waiting for the real plunger switch avoids measuring a toy
  // that the authored rolling/spin controller deliberately skips.
  await wait('document.body.classList.contains("ball-in-plunger")');
  const rawAnimation=process.argv.includes('--raw-animation');
  await script(`Dim RefBalls,RefBall:RefBalls=GetBalls:Set RefBall=RefBalls(${rawAnimation?'0':'UBound(RefBalls)'})`);
  await script('Debug.Print "REFERENCE_RULE_STATE|" & (UBound(RefBalls)+1) & ":" & CLng(RollingTimer.Enabled) & ":" & maxvel & ":" & lob');
  const state=(await marker('REFERENCE_RULE_STATE')).split(':').map(parseFloat);assert.equal(state.length,4);assert.ok(state.every(Number.isFinite));
  reference.nativeRuleState={ballCount:state[0],measuredBallIndex:rawAnimation?0:state[0]-1,measuredBallRole:rawAnimation?'animation':'playable',rollingTimerEnabled:!!state[1],maxvel:state[2],lockedBallOffset:state[3]};console.log('Native rule state',JSON.stringify(reference.nativeRuleState));
  reference.comparisonScope=rawAnimation?'raw physical ball excluded by the authored playable-ball spin/speed controller':'playable ball including authored spin and speed controls';
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
  if(['spinners','gates','triggers'].includes(probeKind)){
    const specs=JSON.parse(await readFile(new URL('../three/public/objects.json',import.meta.url),'utf8')).objects;
    const overrides=[];
    for(const s of specs){
      if(s.name==='playfield_mesh'||!Number.isInteger(s.native_source_order))continue;
      const property=['Wall','Ramp','Primitive','HitTarget','Bumper','Gate'].includes(s.kind)?'Collidable':s.kind==='Trigger'?'Enabled':null;
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
    const settingsKey=probeKind==='gates'?'nativeGateProperties':'nativeSpinnerProperties';if(probeKind!=='triggers')reference[settingsKey]={};
    for(const name of probeKind==='triggers'?[]:probeKind==='gates'?['Gate001','Gate002','Gate3','Gate4']:['Spinner001','Spinner002']){
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
  if(process.argv.includes('--isolate-floor')){
    await script('Ramp020.Collidable=False:Target011.Collidable=False:rpeg001.Collidable=False');
    Object.assign(runtimeOverrides,{'Ramp020.Collidable':false,'Target011.Collidable':false,'rpeg001.Collidable':false});
    await script('Debug.Print "ISOLATE|" & Ramp020.Collidable & ":" & Target011.Collidable & ":" & playfield_mesh.Collidable');
    const flags=await marker('ISOLATE');assert.ok(flags.startsWith('False:False:True'),'slot neighbors disabled');console.log('Slot neighbor isolation flags',flags);
  }
  const results=[];
  for(const scenario of cases.filter(s=>!selected||s.name===selected)){
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
    const command=scenario.setupCode??(scenario.gate?`${scenario.gate}.Open=${scenario.open?'True':'False'}`:scenario.plunger?'Plunger.Fire':scenario.nudgeAngle!==undefined?`Nudge ${scenario.nudgeAngle},${scenario.force}`:scenario.side?`Sol${scenario.side==='left'?'L':'R'}Flipper ${scenario.press===false?0:1}`:'');
    const inputMarker=`CONTACT_INPUT_${scenario.name}`;
    const input=`Debug.Print "${inputMarker}|" & GameTime:${command}`;
    let drive=command?(scenario.delay?`vpmtimer.addtimer ${scenario.delay},"${input.replaceAll('"','""')} '"`:input):'';
    if(exactDelay!==undefined&&scenario.side)drive=`RefDriveMarker="${inputMarker}":RefDriveSide=${scenario.side==='left'?1:2}:RefDrivePress=${scenario.press===false?0:1}:RefDriveAt=GameTime+${Number(exactDelay)}`;
    if(scenario.plunger)drive='Plunger.PullBack:'+drive;
    const closeMarker=`CONTACT_GATE_CLOSE_${scenario.name}`;
    if(scenario.closeDelay){const close=`Debug.Print "${closeMarker}|" & GameTime:${scenario.gate}.Open=False`;drive+=`:vpmtimer.addtimer ${scenario.closeDelay},"${close.replaceAll('"','""')} '"`;}
    const trace=recordTimers?'RefTrace="":Set RefTraceBall=RefBall:RefTraceUntil=GameTime+70:RefTraceOn=True:':'';
    await script(`${trace}RollingTimer.Enabled=False:RollingTimer.Enabled=True:${reset(scenario.x,scenario.y,scenario.vx,scenario.vy,scenario.z,scenario.vz)}:${drive?drive+':':''}Debug.Print "CONTACT_INIT|" & GameTime & ":" & RefBall.AngMomX & ":" & RefBall.AngMomY & ":" & RefBall.AngMomZ & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z`);
    const initial=(await marker('CONTACT_INIT')).split(':').map(parseFloat);assert.equal(initial.length,7);assert.deepEqual(initial.slice(1,4),[0,0,0],'native spin reset');
    for(const [actual,expected]of [[initial[4],scenario.x],[initial[5],scenario.y],[initial[6],scenario.z??25]])assert.ok(Math.abs(actual-expected)<.001,`native initial position ${actual} vs ${expected}`);
    const origin=initial[0],samples=[],rawSamples=[];
    // The native UI retains only 120 log lines. Cache delayed input clocks as
    // soon as they appear, before a long observation run rolls them out.
    let inputAt,closeAt;
    const captureInput=async()=>{
      if(command&&inputAt===undefined&&await evaluate(`document.getElementById('log').textContent.includes(${JSON.stringify(inputMarker+'|')})`))inputAt=parseFloat(await marker(inputMarker));
      if(scenario.closeDelay&&closeAt===undefined&&await evaluate(`document.getElementById('log').textContent.includes(${JSON.stringify(closeMarker+'|')})`))closeAt=parseFloat(await marker(closeMarker));
    };
    await captureInput();
    for(let i=0;i<(scenario.sampleCount??12);i++){
      const park=scenario.parkFromSample!==undefined&&i>=scenario.parkFromSample?reset(430,1500,0,0)+':':'';
      const mechanism=scenario.spinner??scenario.gate;
      const targetFields=scenario.target?['Target009','Target010','Target011'].map(n=>`CLng(${n}.IsDropped)`).concat(['Target009','Target010','Target011'].map(n=>`CLng(${n}.CurrentAnimOffset*1000000)`),'Score(CurrentPlayer)'):null;
      const extra=scenario.trigger?` & ":" & ${scenario.trigger}.BallCntOver`:mechanism?` & ":" & CLng(${mechanism}.CurrentAngle*1000000) & ":" & Score(CurrentPlayer) & ":" & LeftSpinnerCount(CurrentPlayer)`:targetFields?' & ":" & '+targetFields.join(' & ":" & '):scenario.plunger?' & ":" & Plunger.Position':'';
      await script(park+'Debug.Print "CONTACT_SAMPLE|" & GameTime & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z & ":" & CLng(RefBall.VelX*1000000) & ":" & CLng(RefBall.VelY*1000000) & ":" & CLng(RefBall.VelZ*1000000) & ":" & CLng(RefBall.AngVelX*1000000) & ":" & CLng(RefBall.AngVelY*1000000) & ":" & CLng(RefBall.AngVelZ*1000000) & ":" & LeftFlipper.CurrentAngle & ":" & RightFlipper.CurrentAngle'+extra);
      const raw=await marker('CONTACT_SAMPLE');rawSamples.push(raw);
      const values=raw.split(':').map(parseFloat);assert.equal(values.length,columns.length);assert.ok(values.every(Number.isFinite));for(let k=4;k<10;k++)values[k]/=1000000;values[0]-=origin;samples.push(values);
      if(mechanism)values[12]/=1000000;
      if(scenario.target)for(let k=15;k<=17;k++)values[k]/=1000000;
      await captureInput();
      await new Promise(r=>setTimeout(r,5));
    }
    const actualDelay=command?inputAt-origin:0;assert.ok(Number.isFinite(actualDelay),'observed native input clock');
    if(scenario.gate)assert.equal(actualDelay,0,'gate command shares the initial-state clock');
    let timerTrace;
    if(recordTimers){
      await script('RefTraceOn=False:Debug.Print "TIMER_TRACE_LENGTH|" & Len(RefTrace)');
      const length=parseFloat(await marker('TIMER_TRACE_LENGTH'));assert.ok(Number.isFinite(length)&&length>0);
      let raw='';
      for(let offset=1;offset<=length;offset+=200){await script(`Debug.Print "TIMER_TRACE_CHUNK|" & Mid(RefTrace,${offset},200)`);raw+=(await marker('TIMER_TRACE_CHUNK')).replace(/'$/,'');}
      timerTrace=raw.trim().split(';').filter(Boolean).map(line=>{const [handler,ms,...fields]=line.split('|');return [handler,Number(ms)-origin,...fields.map(Number)];});
      assert.ok(timerTrace.every(([name,ms,...fields])=>['ROLL','FLIP','STATE','SPIN'].includes(name)&&[ms,...fields].every(Number.isFinite)));
      assert.ok(timerTrace[0][1]<=10,'full trace must include the first timer callbacks');
    }
    const closing=scenario.closeDelay?{actualCloseDelay:closeAt-origin}:{};if(scenario.closeDelay)assert.ok(Number.isFinite(closing.actualCloseDelay)&&closing.actualCloseDelay>0,'observed native gate-close clock');
    results.push({...scenario,initial,actualDelay,...closing,samples,rawSamples,...(timerTrace?{timerTrace}:{})});console.log(scenario.name,'input at',actualDelay,JSON.stringify(samples.at(-1)));
    const suffix=rawAnimation&&selected?`raw-${recordTimers?'timing-':''}${selected}`:reference.shooterProbe&&selected?`${recordTimers?'timing-':''}${selected}`:['spinners','gates','targets','triggers'].includes(probeKind)&&selected?`${probeKind}-${reference.instrumentation?.spinnerTraceColumns?'timing-':''}${reference.animationBallIsolation?'isolated-animation-':''}${selected}`:`${reference.geometryProbe?'geometry':probeKind==='contacts'?'contact':probeKind}-reference`;
    await writeFile(`${output}/vpx-${suffix}.json`,JSON.stringify({...reference,probeKind,runtimeOverrides,columns,cases:results},null,2));
  }
}finally{socket.close();}
