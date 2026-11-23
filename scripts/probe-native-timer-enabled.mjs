import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),filename=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-timer-enabled.json';assert.match(filename,/^[a-z0-9.-]+\.json$/i);
const cases=[];for(const kind of ['Timer','Flasher'])for(const restart of [false,true])cases.push({name:kind+(restart?' explicit restart':' repeated enable'),kind,initial:true,actions:[{ms:30,code:restart?'False:ON':'True'},{ms:60,code:restart?'1':'-1'},{ms:260,code:'False'}]});for(const kind of ['Timer','Flasher'])cases.push({name:kind+' repeated disable',kind,initial:false,actions:[{ms:30,code:'False'},{ms:60,code:'True'},{ms:300,code:'False'}]});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;},script=code=>evaluate('finni.evaluate('+JSON.stringify(code)+')'),wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate(`(()=>{window.nativeTimerEnabledCapture={events:[]};const element=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(element,'textContent',{get(){return descriptor.get.call(this);},set(value){const line=String(value).split('\\n').at(-1),index=line.indexOf('TIMER_PROPERTY|');if(index<0)return descriptor.set.call(this,value);const [phase,...fields]=line.slice(index+15).replace(/'$/,'').split('|');nativeTimerEnabledCapture.events.push({phase,values:fields.map(Number)});}});})()`);
 const objects=JSON.parse(fs.readFileSync('three/public/objects.json','utf8')).objects;await script('Dim RefPropElement');const isolation=objects.filter(o=>o.kind==='Timer'||o.kind==='LightSequencer').map(o=>`Set RefPropElement=GetElementByName("${o.name}"):RefPropElement.${o.kind==='Timer'?'Enabled=False':'StopPlay'}`);for(let i=0;i<isolation.length;i+=16)await script(isolation.slice(i,i+16).join(':'));
 const declarations=`Dim RefPropActive,RefPropObject,RefPropKind,RefPropCount,RefPropOrigin,RefPropTimes,RefPropActions,RefPropIndex
RefPropActive=False
Sub RefPropObserve(phase)
 Dim flag
 If RefPropKind="Timer" Then flag=RefPropObject.Enabled Else flag=RefPropObject.TimerEnabled
 Debug.Print "TIMER_PROPERTY|" & phase & "|" & GameTime & "|" & RefPropCount & "|" & Abs(CLng(flag)) & "|" & VarType(flag)
End Sub
Sub Spots_Timer
 RefPropCount=RefPropCount+1
 RefPropObserve "fire"
End Sub
Sub Flasher007_Timer
 RefPropCount=RefPropCount+1
 RefPropObserve "fire"
End Sub
Sub LeftFlipper_Timer
 If RefPropActive Then
  Do While RefPropIndex<=UBound(RefPropTimes)
   If GameTime-RefPropOrigin<RefPropTimes(RefPropIndex) Then Exit Do
   Execute RefPropActions(RefPropIndex)
   RefPropObserve "action"
   RefPropIndex=RefPropIndex+1
  Loop
 End If
End Sub`;
 await script(declarations);
 for(const c of cases){
  const object=c.kind==='Timer'?'Spots':'Flasher007',property=c.kind==='Timer'?'Enabled':'TimerEnabled',interval=c.kind==='Timer'?'Interval':'TimerInterval',actions=c.actions.map(a=>`RefPropObject.${property}=${a.code.replace(':ON',`:RefPropObject.${property}=True`)}`);
  await script(`RefPropActive=False:Spots.Enabled=False:Flasher007.TimerEnabled=False:Set RefPropObject=${object}:RefPropKind="${c.kind}":RefPropCount=0:RefPropIndex=0:RefPropTimes=Array(${c.actions.map(a=>a.ms)}):RefPropActions=Array(${actions.map(a=>'"'+a+'"').join(',')}):RefPropObject.${interval}=100`);await evaluate('nativeTimerEnabledCapture.events.length=0');
  await script(`RefPropOrigin=GameTime:RefPropActive=True:RefPropObject.${property}=${c.initial?'True':'False'}:RefPropObserve "initial"`);await wait('nativeTimerEnabledCapture.events.filter(r=>r.phase==="action").length===3');await script('RefPropActive=False');c.events=await evaluate('nativeTimerEnabledCapture.events');assert.equal(c.events[0].phase,'initial');assert.ok(c.events.filter(r=>r.phase==='fire').length>=2);const origin=c.events[0].values[0];for(const row of c.events)row.ms=row.values[0]-origin;
 }
 const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(errors,[]);const capture={engineSHA256,declarations,cases,errors,columns:['absolute_ms','fire_count','enabled','variant_type'],scope:'Original unmodified native object timer implementation. Component handlers on Spots, Flasher007 and LeftFlipper are replaced with diagnostic counters/input dispatch only; all other Timer objects and light sequencers isolated. Actual 1ms input and callback clocks observed, including Boolean getter Variant type. No source deadlines, clocks or outputs replaced.'};fs.writeFileSync(output+'/'+filename,JSON.stringify(capture,null,2));console.log(JSON.stringify({cases:cases.map(c=>({name:c.name,events:c.events.map(r=>[r.phase,r.ms,...r.values.slice(1)])})),errors}));
}catch(error){try{fs.writeFileSync(output+'/'+filename+'.partial',JSON.stringify({capture:await evaluate('window.nativeTimerEnabledCapture'),errors,error:String(error)},null,2));}catch{}throw error;}finally{socket.close();}
