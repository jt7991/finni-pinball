// Controlled native VPX contact measurements. All state comes from the live
// engine; every case resets both linear velocity and angular momentum.
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const probeKind=process.argv.includes('--spinners')?'spinners':process.argv.includes('--plunger')?'plunger':process.argv.includes('--nudge')?'nudge':'contacts';
const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();
const recordTimers=!!reference.instrumentation&&!process.argv.includes('--no-timer-trace');
reference.timerTraceCaptured=recordTimers;
assert.deepEqual(reference.controlledOverrides,{scatter:0,default_scatter:0},'controlled native table metadata');
const runtimeOverrides={'LeftFlipper.Scatter':0,'RightFlipper.Scatter':0};
const columns=['ms','x','y','z','vx','vy','vz','wx','wy','wz','left','right',...(probeKind==='plunger'?['plunger_position']:probeKind==='spinners'?['spinner_angle','score','left_spinner_count']:[])];
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
  await script('Dim RefBalls,RefBall:RefBalls=GetBalls:Set RefBall=RefBalls(UBound(RefBalls))');
  await script('Debug.Print "REFERENCE_RULE_STATE|" & (UBound(RefBalls)+1) & ":" & CLng(RollingTimer.Enabled) & ":" & maxvel & ":" & lob');
  const state=(await marker('REFERENCE_RULE_STATE')).split(':').map(parseFloat);assert.equal(state.length,4);assert.ok(state.every(Number.isFinite));
  reference.nativeRuleState={ballCount:state[0],measuredBallIndex:state[0]-1,measuredBallRole:'playable',rollingTimerEnabled:!!state[1],maxvel:state[2],lockedBallOffset:state[3]};console.log('Native rule state',JSON.stringify(reference.nativeRuleState));
  reference.comparisonScope='playable ball including authored spin and speed controls';
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
  if(probeKind==='spinners'){
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
    reference.nativeSpinnerProperties={};
    for(const name of ['Spinner001','Spinner002']){
      const properties=['Height','Length','Rotation','Damping','AngleMin','AngleMax','Elasticity'];
      await script('Debug.Print "SPINNER_SETTINGS|" & '+properties.map(p=>`${name}.${p}`).join(' & ":" & '));
      const values=(await marker('SPINNER_SETTINGS')).split(':').map(parseFloat);assert.ok(values.every(Number.isFinite));
      reference.nativeSpinnerProperties[name]=Object.fromEntries(properties.map((p,i)=>[p,values[i]]));
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
    const command=scenario.plunger?'Plunger.Fire':scenario.nudgeAngle!==undefined?`Nudge ${scenario.nudgeAngle},${scenario.force}`:scenario.side?`Sol${scenario.side==='left'?'L':'R'}Flipper ${scenario.press===false?0:1}`:'';
    const inputMarker=`CONTACT_INPUT_${scenario.name}`;
    const input=`Debug.Print "${inputMarker}|" & GameTime:${command}`;
    let drive=command?(scenario.delay?`vpmtimer.addtimer ${scenario.delay},"${input.replaceAll('"','""')} '"`:input):'';
    if(exactDelay!==undefined&&scenario.side)drive=`RefDriveMarker="${inputMarker}":RefDriveSide=${scenario.side==='left'?1:2}:RefDrivePress=${scenario.press===false?0:1}:RefDriveAt=GameTime+${Number(exactDelay)}`;
    if(scenario.plunger)drive='Plunger.PullBack:'+drive;
    const trace=recordTimers?'RefTrace="":Set RefTraceBall=RefBall:RefTraceUntil=GameTime+70:RefTraceOn=True:':'';
    await script(`${trace}RollingTimer.Enabled=False:RollingTimer.Enabled=True:${reset(scenario.x,scenario.y,scenario.vx,scenario.vy,scenario.z,scenario.vz)}:${drive?drive+':':''}Debug.Print "CONTACT_INIT|" & GameTime & ":" & RefBall.AngMomX & ":" & RefBall.AngMomY & ":" & RefBall.AngMomZ & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z`);
    const initial=(await marker('CONTACT_INIT')).split(':').map(parseFloat);assert.equal(initial.length,7);assert.deepEqual(initial.slice(1,4),[0,0,0],'native spin reset');
    for(const [actual,expected]of [[initial[4],scenario.x],[initial[5],scenario.y],[initial[6],scenario.z??25]])assert.ok(Math.abs(actual-expected)<.001,`native initial position ${actual} vs ${expected}`);
    const origin=initial[0],samples=[],rawSamples=[];
    for(let i=0;i<(scenario.sampleCount??12);i++){
      const park=scenario.parkFromSample!==undefined&&i>=scenario.parkFromSample?reset(430,1500,0,0)+':':'';
      const extra=scenario.spinner?` & ":" & CLng(${scenario.spinner}.CurrentAngle*1000000) & ":" & Score(CurrentPlayer) & ":" & LeftSpinnerCount(CurrentPlayer)`:scenario.plunger?' & ":" & Plunger.Position':'';
      await script(park+'Debug.Print "CONTACT_SAMPLE|" & GameTime & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z & ":" & CLng(RefBall.VelX*1000000) & ":" & CLng(RefBall.VelY*1000000) & ":" & CLng(RefBall.VelZ*1000000) & ":" & CLng(RefBall.AngVelX*1000000) & ":" & CLng(RefBall.AngVelY*1000000) & ":" & CLng(RefBall.AngVelZ*1000000) & ":" & LeftFlipper.CurrentAngle & ":" & RightFlipper.CurrentAngle'+extra);
      const raw=await marker('CONTACT_SAMPLE');rawSamples.push(raw);
      const values=raw.split(':').map(parseFloat);assert.equal(values.length,columns.length);assert.ok(values.every(Number.isFinite));for(let k=4;k<10;k++)values[k]/=1000000;values[0]-=origin;samples.push(values);
      if(scenario.spinner)values[12]/=1000000;
      await new Promise(r=>setTimeout(r,5));
    }
    const actualDelay=command?parseFloat(await marker(inputMarker))-origin:0;
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
    results.push({...scenario,initial,actualDelay,samples,rawSamples,...(timerTrace?{timerTrace}:{})});console.log(scenario.name,'input at',actualDelay,JSON.stringify(samples.at(-1)));
    const suffix=probeKind==='spinners'&&selected?`spinners-${reference.instrumentation?.spinnerTraceColumns?'timing-':''}${reference.animationBallIsolation?'isolated-animation-':''}${selected}`:`${reference.geometryProbe?'geometry':probeKind==='contacts'?'contact':probeKind}-reference`;
    await writeFile(`${output}/vpx-${suffix}.json`,JSON.stringify({...reference,probeKind,runtimeOverrides,columns,cases:results},null,2));
  }
}finally{socket.close();}
