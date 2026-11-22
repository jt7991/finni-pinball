// Execute the authored FlashForMs on the pinned native engine. The sole
// generated-handler change appends a read-only state logger after its body.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),filename=process.argv.find(x=>x.startsWith('--output-name='))?.slice(14)??'native-flash-timers.json',original=fs.readFileSync('.work/vpx-animation-frame-rng-reference/extracted/script.vbs','utf8').match(/^Sub FlashForMs\([\s\S]*?^End Sub/gmi)?.[0];assert.ok(original);
const tail=':End if:End Sub"',logged=':End if:RefFlashObserve ""timer"":End Sub"';assert.equal(original.split(tail).length,2);const helper=original.replace(tail,logged);assert.equal(helper.replace(logged,tail),original);
const cases=[
 {name:'even steps final off',kind:'flasher',initial:0,total:300,period:50,final:0},
 {name:'odd steps final on',kind:'flasher',initial:1,total:250,period:50,final:1},
 {name:'preserve off',kind:'flasher',initial:0,total:250,period:50,final:2},
 {name:'preserve on',kind:'flasher',initial:1,total:200,period:50,final:2},
 {name:'round up',kind:'flasher',initial:0,total:225,period:50,final:0},
 {name:'round down',kind:'flasher',initial:1,total:174,period:50,final:1},
 {name:'zero-step source edge',kind:'flasher',initial:0,total:20,period:50,final:0,stopAfterTicks:4},
 {name:'restart active',kind:'flasher',initial:0,total:300,period:50,final:0,restart:{delay:73,total:200,period:40,final:2}},
 {name:'lamp duration off',kind:'light',initial:0,total:225,period:50,final:0},
 {name:'lamp preserve on',kind:'light',initial:1,total:150,period:40,final:2},
 {name:'lamp final on',kind:'light',initial:0,total:200,period:60,final:1},
];
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;},script=code=>evaluate('finni.evaluate('+JSON.stringify(code)+')'),wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate(`(()=>{window.nativeFlashCapture={cases:${JSON.stringify(cases.map(c=>({...c,events:[]})))},failures:[]};const element=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(element,'textContent',{get(){return descriptor.get.call(this);},set(value){const line=String(value).split('\\n').at(-1),index=line.indexOf('FLASH_EVENT|');if(index<0)return descriptor.set.call(this,value);const [caseIndex,phase,...fields]=line.slice(index+12).replace(/'$/,'').split('|'),row=fields.map(Number);if(!row.every(Number.isFinite))throw Error('Invalid native flash state');window.nativeFlashCapture.cases[Number(caseIndex)].events.push({phase,values:row});}});})()`);
 // Isolate the component from authored periodic lamp/sequence updates.
 const objects=JSON.parse(fs.readFileSync('three/public/objects.json','utf8')).objects;
 await script('Dim RefFlashElement');
 const isolation=objects.filter(o=>o.kind==='Timer'||o.kind==='LightSequencer').map(o=>`Set RefFlashElement=GetElementByName("${o.name}"):RefFlashElement.${o.kind==='Timer'?'Enabled=False':'StopPlay'}`);
 for(let i=0;i<isolation.length;i+=16)await script(isolation.slice(i,i+16).join(':'));
 await script(`Dim RefFlashCase,RefFlashOn,RefFlashKind,RefFlashObject,RefFlashPrevious,RefFlashStart,RefFlashRestartAt
RefFlashOn=False:RefFlashPrevious=GameTime
RefFlashRestartAt=-1
Sub RefFlashObserve(phase)
 If RefFlashOn Then
  If RefFlashKind="flasher" Then
   Debug.Print "FLASH_EVENT|" & RefFlashCase & "|" & phase & "|" & GameTime & "|" & Abs(CLng(RefFlashObject.Visible)) & "|" & RefFlashObject.UserValue & "|" & RefFlashObject.TimerInterval & "|" & Abs(CLng(RefFlashObject.TimerEnabled))
  Else
   Debug.Print "FLASH_EVENT|" & RefFlashCase & "|" & phase & "|" & GameTime & "|" & CStr(CDbl(RefFlashObject.State)) & "|" & RefFlashObject.BlinkInterval & "|" & CStr(CDbl(RefFlashObject.GetInPlayIntensity)) & "|" & Abs(CLng(RefFlashObject.GetInPlayStateBool)) & "|" & (GameTime-RefFlashPrevious)
  End If
 End If
End Sub
Sub Target010_Timer
 If RefFlashRestartAt>=0 Then
  If GameTime>=RefFlashRestartAt Then
   RefFlashRestartAt=-1
   RefFlashRestart
  End If
 End If
 If RefFlashOn And RefFlashKind="light" Then RefFlashObserve "frame"
 RefFlashPrevious=GameTime
End Sub
${helper}`);
 for(const [index,c]of cases.entries()){
  const object=c.kind==='flasher'?'Flasher007':'li044';
  await script(`RefFlashOn=False:Flasher007.TimerEnabled=False:Set RefFlashObject=${object}:RefFlashCase=${index}:RefFlashKind="${c.kind}":`+(c.kind==='flasher'?`RefFlashObject.Visible=${c.initial?'True':'False'}`:`RefFlashObject.State=${c.initial}:RefFlashObject.Intensity=3.5:RefFlashObject.IntensityScale=1:RefFlashObject.FadeSpeedUp=0.1:RefFlashObject.FadeSpeedDown=0.1:RefFlashObject.BlinkPattern="10"`));
  await script(`RefFlashOn=True:RefFlashStart=GameTime:FlashForMs RefFlashObject,${c.total},${c.period},${c.final}:RefFlashObserve "input"`);
  if(c.restart){await script(`Sub RefFlashRestart\nFlashForMs RefFlashObject,${c.restart.total},${c.restart.period},${c.restart.final}:RefFlashObserve "restart"\nEnd Sub`);await script(`RefFlashRestartAt=RefFlashStart+${c.restart.delay}`);}
  const path=`nativeFlashCapture.cases[${index}].events`;
  if(c.kind==='light')await wait(`${path}.length>2&&${path}.at(-1).values[0]-${path}[0].values[0]>${c.total+100}`);
  else if(c.stopAfterTicks)await wait(`${path}.filter(row=>row.phase==='timer').length>=${c.stopAfterTicks}`);
  else await wait(`${path}.some(row=>row.phase==='timer'&&row.values[4]===0)`);
  await script('RefFlashOn=False:Flasher007.TimerEnabled=False');
  const rows=await evaluate(path);assert.equal(rows[0].phase,'input');assert.ok(rows.length>2,c.name);if(c.restart)assert.equal(rows.filter(r=>r.phase==='restart').length,1,'restart input must actually execute');for(const row of rows){const start=rows[0].values[0];row.ms=row.values[0]-start;}c.events=rows;
 }
 assert.deepEqual(errors,[]);const bytes=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(bytes).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const capture={engineSHA256,helperSHA256:createHash('sha256').update(original).digest('hex'),originalHelper:original,diagnosticHelper:helper,scope:'Original authored arithmetic and native TimerEnabled/TimerInterval/Duration implementation. Diagnostic helper appends only a read-only logger to its generated callback; the otherwise unused diagnostic frame timer observes lamp states after native animation and issues the restart input at its first callback after the requested delay. Timer objects and light sequences explicitly isolated. No source clocks, seeds or output states fitted/replaced.',columns:{flasher:['absolute_ms','visible','uservalue','timerinterval','timerenabled'],light:['absolute_ms','state','blinkinterval','intensity','inplayon','frame_delta_ms']},cases,errors};fs.writeFileSync(output+'/'+filename,JSON.stringify(capture,null,2));console.log(JSON.stringify({engineSHA256,cases:cases.map(c=>({name:c.name,events:c.events.length,first:c.events[0],last:c.events.at(-1)})),errors}));
}catch(error){try{fs.writeFileSync(output+'/'+filename+'.partial',JSON.stringify({capture:await evaluate('window.nativeFlashCapture'),errors,error:String(error)},null,2));}catch{}throw error;}finally{socket.close();}
