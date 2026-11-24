// Observe native property Variant types and arithmetic, with explicit inputs.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const[debug,base,output]=process.argv.slice(2),name=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-object-dispatch.json';assert.match(name,/^[a-z0-9.-]+\.json$/i);
const cases=[...['CurrentAngle','StartAngle','EndAngle','Strength','Elasticity','EOSTorque','EOSTorqueAngle'].map(p=>({expression:'LeftFlipper.'+p})),...['Bumper1.Threshold','he.X','he.Y','LilHead.RotX','LilHead.RotY','LeftFlipperTop.RotZ','discolight.RotZ','li001.State','li001.BlinkInterval','LightSeqGi.UpdateInterval','DMDTimer.Enabled','DMDTimer.Interval'].map(expression=>({expression})),...['0','1'].flatMap(input=>['Target011.IsDropped','Fi001.Visible','Gate3.Open'].map(expression=>({expression,input})))];
for(const expression of cases.slice(1,15).map(c=>c.expression))for(const input of ['0.1','1/3','True','Empty'])cases.push({expression,input});
for(const input of ['0','1'])for(const expression of ['CBool(Target011.IsDropped)','(Target011.IsDropped=True)','(Not Target011.IsDropped)','(Not Not Target011.IsDropped)','(Target011.IsDropped And True)','(Target011.IsDropped Or False)','(Target011.IsDropped Xor True)','(Target011.IsDropped Eqv True)','(Target011.IsDropped Imp False)','CLng(Target011.IsDropped)'])cases.push({expression,input,assign:'Target011.IsDropped'});
const declarations=`Function RefDispatchExact(value)
 Dim scaled,shift,hi,lo
 scaled=CDbl(value):shift=0
 Do While scaled<>Fix(scaled)
  scaled=scaled*2:shift=shift+1
 Loop
 hi=Fix(scaled/16777216):lo=scaled-hi*16777216
 RefDispatchExact=CStr(CLng(hi)) & "," & CStr(CLng(lo)) & "," & CStr(shift)
End Function
Sub RefDispatchProbe(label,expression,assignment)
 On Error Resume Next
 Dim result,code,kind,aliasValue,plusValue,notValue
 Err.Clear
 If assignment<>"" Then Execute assignment
 code=Err.Number:Err.Clear
 result=Eval(expression)
 If code=0 Then code=Err.Number
 Err.Clear
 kind=VarType(result):aliasValue=result:plusValue=result+0:notValue=Not result
 Debug.Print "OBJECT_DISPATCH_NATIVE|" & label & "|" & code & "|" & kind & "|" & RefDispatchExact(result) & "|" & VarType(aliasValue) & "|" & RefDispatchExact(aliasValue) & "|" & VarType(plusValue) & "|" & RefDispatchExact(plusValue) & "|" & VarType(notValue) & "|" & RefDispatchExact(notValue)
 On Error GoTo 0
End Sub`;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0,saved=false;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1000;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Object dispatch probe timed out: '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 const props=[...new Set(cases.filter(c=>c.input!==undefined).map(c=>c.assign??c.expression))],save='Dim '+props.map((_,i)=>'RefDispatchSaved'+i).join(',')+'\n'+props.map((p,i)=>'RefDispatchSaved'+i+'='+p).join('\n'),restore=props.map((p,i)=>p+'=RefDispatchSaved'+i).join(':');
 await evaluate('finni.evaluate('+JSON.stringify(save+'\n'+declarations)+')');saved=restore;const observed=[];
 for(const[index,c]of cases.entries()){
  const property=c.assign??c.expression,assignment=c.input===undefined?'':property+'='+c.input,statement=`RefDispatchProbe "case${index}", "${c.expression}", "${assignment.replaceAll('"','""')}"`+(c.input===undefined?'':':'+property+'=RefDispatchSaved'+props.indexOf(property));await evaluate('finni.evaluate('+JSON.stringify(statement)+')');
  const log=await evaluate('document.getElementById("log").textContent'),match=log.match(new RegExp('OBJECT_DISPATCH_NATIVE\\|case'+index+'\\|([\\d,|+\\-]+)'));assert.ok(match,c.expression);const p=match[1].split('|');assert.equal(p.length,9);const decode=text=>{const w=text.split(',').map(Number);assert.equal(w.length,3);assert.ok(w.every(Number.isSafeInteger));return(w[0]*16777216+w[1])/2**w[2];};observed.push({...c,error:Number(p[0]),type:Number(p[1]),value:decode(p[2]),aliasType:Number(p[3]),aliasValue:decode(p[4]),plusType:Number(p[5]),plusValue:decode(p[6]),notType:Number(p[7]),notValue:decode(p[8])});
 }
 await evaluate('finni.evaluate('+JSON.stringify(restore+':Debug.Print "OBJECT_DISPATCH_RESTORED|" & CStr('+props.map((p,i)=>'('+p+'=RefDispatchSaved'+i+')').join(' And ')+')')+')');assert.ok((await evaluate('document.getElementById("log").textContent')).includes('OBJECT_DISPATCH_RESTORED|True'));saved=false;
 const engineSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.deepEqual(errors,[]);fs.writeFileSync(output+'/'+name,JSON.stringify({scope:'Native getters used by authored rules: direct, alias, arithmetic and Not Variant observations. Declared numeric/Boolean inputs are assigned and original property values restored. Physical values are observations, never simulation inputs. Invalid float conversions are excluded: the earlier diagnostic returned unexpected values and their semantics remain unresolved.',engineSHA256,reference,declarations,cases:observed,restored:true,errors},null,2),{flag:'wx'});console.log(JSON.stringify({cases:observed.length,restored:true,errors}));
}catch(error){fs.writeFileSync(output+'/'+name.replace(/\.json$/,'-failure.json'),JSON.stringify({error:String(error),errors,log:await evaluate('document.getElementById("log").textContent')},null,2),{flag:'wx'});throw error;}finally{if(saved)await evaluate('finni.evaluate('+JSON.stringify(saved)+')');socket.close();}
