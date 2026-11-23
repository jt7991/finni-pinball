// Independent unmodified-engine object timer observations. Diagnostic handlers
// count callbacks and issue specified property writes; no native clock is set.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),filename=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-timer-interval.json';assert.match(filename,/^[a-z0-9.-]+\.json$/i);
const cases=[];for(const kind of ['Timer','Flasher']){
 const property=kind==='Timer'?'Enabled':'TimerEnabled',interval=kind==='Timer'?'Interval':'TimerInterval',end={ms:300,code:`RefIntervalObject.${property}=False`};
 cases.push({name:kind+' repeated interval',kind,initial:true,actions:[{ms:30,code:`RefIntervalObject.${interval}=100`},{ms:70,code:`RefIntervalObject.${property}=True`},end]});
 cases.push({name:kind+' changed interval',kind,initial:true,actions:[{ms:30,code:`RefIntervalObject.${interval}=40`},end]});
 cases.push({name:kind+' callback interval',kind,initial:true,onFirst:`RefIntervalObject.${interval}=40`,actions:[end]});
 cases.push({name:kind+' callback restart',kind,initial:true,onFirst:`RefIntervalObject.${property}=False:RefIntervalObject.${interval}=40:RefIntervalObject.${property}=True`,actions:[end]});
 cases.push({name:kind+' disabled interval',kind,initial:false,actions:[{ms:30,code:`RefIntervalObject.${interval}=40`},{ms:60,code:`RefIntervalObject.${property}=True`},{ms:250,code:`RefIntervalObject.${property}=False`}]});
}
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;},script=code=>evaluate('finni.evaluate('+JSON.stringify(code)+')'),wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate(`(()=>{window.nativeTimerIntervalCapture={events:[]};const element=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(element,'textContent',{get(){return descriptor.get.call(this);},set(value){const line=String(value).split('\\n').at(-1),index=line.indexOf('TIMER_INTERVAL|');if(index<0)return descriptor.set.call(this,value);const [phase,...fields]=line.slice(index+15).replace(/'$/,'').split('|');nativeTimerIntervalCapture.events.push({phase,values:fields.map(Number)});}});})()`);
 const objects=JSON.parse(fs.readFileSync('three/public/objects.json','utf8')).objects;await script('Dim RefIntervalElement');const isolation=objects.filter(o=>o.kind==='Timer'||o.kind==='LightSequencer').map(o=>`Set RefIntervalElement=GetElementByName("${o.name}"):RefIntervalElement.${o.kind==='Timer'?'Enabled=False':'StopPlay'}`);for(let i=0;i<isolation.length;i+=16)await script(isolation.slice(i,i+16).join(':'));
 const declarations=`Dim RefIntervalActive,RefIntervalObject,RefIntervalKind,RefIntervalCount,RefIntervalOrigin,RefIntervalTimes,RefIntervalActions,RefIntervalIndex,RefIntervalFirst
RefIntervalActive=False
Sub RefIntervalObserve(phase)
 Dim flag,period
 If RefIntervalKind="Timer" Then
  flag=RefIntervalObject.Enabled:period=RefIntervalObject.Interval
 Else
  flag=RefIntervalObject.TimerEnabled:period=RefIntervalObject.TimerInterval
 End If
 Debug.Print "TIMER_INTERVAL|" & phase & "|" & GameTime & "|" & RefIntervalCount & "|" & Abs(CLng(flag)) & "|" & period & "|" & VarType(period)
End Sub
Sub RefIntervalFire
 RefIntervalCount=RefIntervalCount+1
 If RefIntervalCount=1 And RefIntervalFirst<>"" Then Execute RefIntervalFirst
 RefIntervalObserve "fire"
End Sub
Sub Spots_Timer
 RefIntervalFire
End Sub
Sub Flasher007_Timer
 RefIntervalFire
End Sub
Sub LeftFlipper_Timer
 If RefIntervalActive Then
  Do While RefIntervalIndex<=UBound(RefIntervalTimes)
   If GameTime-RefIntervalOrigin<RefIntervalTimes(RefIntervalIndex) Then Exit Do
   Execute RefIntervalActions(RefIntervalIndex)
   RefIntervalObserve "action"
   RefIntervalIndex=RefIntervalIndex+1
  Loop
 End If
End Sub`;
 await script(declarations);
 for(const c of cases){
  const object=c.kind==='Timer'?'Spots':'Flasher007',property=c.kind==='Timer'?'Enabled':'TimerEnabled',interval=c.kind==='Timer'?'Interval':'TimerInterval';
  await script(`RefIntervalActive=False:Spots.Enabled=False:Flasher007.TimerEnabled=False:Set RefIntervalObject=${object}:RefIntervalKind="${c.kind}":RefIntervalCount=0:RefIntervalIndex=0:RefIntervalTimes=Array(${c.actions.map(a=>a.ms)}):RefIntervalActions=Array(${c.actions.map(a=>'"'+a.code+'"').join(',')}):RefIntervalFirst="${c.onFirst??''}":RefIntervalObject.${interval}=100`);await evaluate('nativeTimerIntervalCapture.events.length=0');
  await script(`RefIntervalOrigin=GameTime:RefIntervalActive=True:RefIntervalObject.${property}=${c.initial?'True':'False'}:RefIntervalObserve "initial"`);await wait(`nativeTimerIntervalCapture.events.filter(r=>r.phase==="action").length===${c.actions.length}`);await script('RefIntervalActive=False');c.events=await evaluate('nativeTimerIntervalCapture.events');assert.equal(c.events[0].phase,'initial');assert.ok(c.events.filter(r=>r.phase==='fire').length>=2);const origin=c.events[0].values[0];for(const row of c.events)row.ms=row.values[0]-origin;
 }
 const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(errors,[]);const capture={engineSHA256,declarations,cases,errors,columns:['absolute_ms','fire_count','enabled','interval','interval_variant_type'],scope:'Original unmodified native timer implementation with diagnostic handlers on Spots, Flasher007 and LeftFlipper. Other Timer objects and light sequencers isolated. Actual input and callback clocks and getter types retained. No deadlines, clocks, RNG or outputs replaced. Positive physical-step timers only; frame/sync timers are outside this fixture.'};fs.writeFileSync(output+'/'+filename,JSON.stringify(capture,null,2));console.log(JSON.stringify({cases:cases.map(c=>({name:c.name,events:c.events.map(r=>[r.phase,r.ms,...r.values.slice(1)])})),errors}));
}catch(error){try{fs.writeFileSync(output+'/'+filename+'.partial',JSON.stringify({capture:await evaluate('window.nativeTimerIntervalCapture'),errors,error:String(error)},null,2));}catch{}throw error;}finally{socket.close();}
