import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),filename=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-vpm-timers.json';assert.match(filename,/^[a-z0-9.-]+\.json$/i);
const core=fs.readFileSync('.work/vpx-native-source/scripts-core.vbs','utf8'),original=core.match(/^Class cvpmTimer\b[\s\S]*?^End Class/gmi)[0],delays=[0,1,39,40,41,79,80,81,1500,174.5,175.5];
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;},script=code=>evaluate('finni.evaluate('+JSON.stringify(code)+')'),wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate(`(()=>{window.nativeVpmCapture={events:[]};const element=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(element,'textContent',{get(){return descriptor.get.call(this);},set(value){const line=String(value).split('\\n').at(-1),index=line.indexOf('VPM_EVENT|');if(index<0)return descriptor.set.call(this,value);const [phase,clock,label]=line.slice(index+10).replace(/'$/,'').split('|');nativeVpmCapture.events.push({phase,ms:Number(clock),label});}});})()`);
 const objects=JSON.parse(fs.readFileSync('three/public/objects.json','utf8')).objects;await script('Dim RefVpmElement');
 const isolation=objects.filter(o=>o.kind==='Timer'&&o.name!=='PulseTimer'||o.kind==='LightSequencer').map(o=>`Set RefVpmElement=GetElementByName("${o.name}"):RefVpmElement.${o.kind==='Timer'?'Enabled=False':'StopPlay'}`);for(let i=0;i<isolation.length;i+=16)await script(isolation.slice(i,i+16).join(':'));
 const declarations=`Dim RefVpmOn,RefVpmIndex
RefVpmOn=True
Sub RefVpmObserve(label)
 Debug.Print "VPM_EVENT|callback|" & GameTime & "|" & label
End Sub
Sub RefVpmFunction(id)
 RefVpmObserve "function" & id
End Sub
Sub RefVpmParent
 RefVpmObserve "parent"
 vpmtimer.addtimer 0,"RefVpmObserve ""child0"" '"
 vpmtimer.addtimer 40,"RefVpmObserve ""child40"" '"
End Sub
Sub PulseTimer_Timer
 If RefVpmOn Then Debug.Print "VPM_EVENT|pulse-before|" & GameTime & "|"
 vpmTimer.Update
 If RefVpmOn Then Debug.Print "VPM_EVENT|pulse-after|" & GameTime & "|"
End Sub`;
 await script(declarations);await script('Debug.Print "VPM_EVENT|interval|" & GameTime & "|" & PulseTimer.Interval');
 const commands=[...delays.map(delay=>`vpmtimer.addtimer ${delay},"RefVpmObserve ""d${delay}"" '"`),'vpmtimer.addtimer 40,"RefVpmParent \'"'];
 await script('Debug.Print "VPM_EVENT|input|" & GameTime & "|batch":'+commands.join(':'));
 await wait('nativeVpmCapture.events.some(row=>row.label==="d1500")');
 await wait('nativeVpmCapture.events.filter(row=>row.phase==="pulse-after").at(-1).ms-nativeVpmCapture.events.find(row=>row.label==="d1500").ms>100');
 await script('Debug.Print "VPM_EVENT|input|" & GameTime & "|after-idle":vpmtimer.addtimer 80,"RefVpmObserve ""after-idle"" \'"');await wait('nativeVpmCapture.events.some(row=>row.phase==="callback"&&row.label==="after-idle")');
 await script('Debug.Print "VPM_EVENT|input|" & GameTime & "|function":vpmtimer.addtimer2 80,GetRef("RefVpmFunction"),37');await wait('nativeVpmCapture.events.some(row=>row.label==="function37")');
 await script('Debug.Print "VPM_EVENT|input|" & GameTime & "|capacity":For RefVpmIndex=1 To 51:vpmtimer.addtimer 40,"RefVpmObserve ""cap" & RefVpmIndex & """ \'":Next');
 await wait('nativeVpmCapture.events.filter(row=>row.phase==="callback"&&row.label.startsWith("cap")).length===50');await script('RefVpmOn=False');
 const capture=await evaluate('nativeVpmCapture'),bytes=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());capture.engineSHA256=createHash('sha256').update(bytes).digest('hex');assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');capture.coreClassSHA256=createHash('sha256').update(original).digest('hex');Object.assign(capture,{declarations,delays,errors,scope:'Actual original core.vbs cvpmTimer, its existing 40ms native PulseTimer and ordinary AddTimer/AddTimer2 calls. The table uses string callbacks; the GetRef control is tested separately after the string queue empties. Generated PulseTimer handler retains its sole vpmTimer.Update call with read-only log markers around it. Other authored Timer objects and light sequences isolated. Actual GameTime clocks retained; no timer phase or outputs replaced.'});assert.deepEqual(errors,[]);assert.equal(capture.events.find(r=>r.phase==='interval').label,'40');assert.equal(capture.events.filter(r=>r.label==='function37').length,1);assert.ok(capture.events.some(r=>r.label==='child0'));assert.ok(capture.events.some(r=>r.label==='child40'));assert.equal(capture.events.filter(r=>r.phase==='callback'&&r.label.startsWith('cap')).length,50);fs.writeFileSync(output+'/'+filename,JSON.stringify(capture,null,2));console.log(JSON.stringify({events:capture.events.length,inputs:capture.events.filter(r=>r.phase==='input'),callbacks:capture.events.filter(r=>r.phase==='callback'),errors}));
}catch(error){try{fs.writeFileSync(output+'/'+filename+'.partial',JSON.stringify({capture:await evaluate('window.nativeVpmCapture'),errors,error:String(error)},null,2));}catch{}throw error;}finally{socket.close();}
