// Measure the original Light.State dispatch coercion, return type and arithmetic.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-light-state.json';assert.match(name,/^[a-z0-9.-]+\.json$/i);
const expressions=['0','1','2','0.1','1/3','-1','2.5','32768','True','False','Empty','Null','"0.5"','"bad"','1e30','1e40','CSng(0.123456789)'];
const declarations=`Dim RefLightSaved
RefLightSaved=li001.State
Function RefLightExact(value)
 Dim scaled,shift,hi,lo
 scaled=CDbl(value):shift=0
 Do While scaled<>Fix(scaled)
  scaled=scaled*2:shift=shift+1
 Loop
 hi=Fix(scaled/16777216):lo=scaled-hi*16777216
 RefLightExact=CStr(CLng(hi)) & "," & CStr(CLng(lo)) & "," & CStr(shift)
End Function
Sub RefLightStateProbe(label,expression)
 On Error Resume Next
 Dim result,code,kind,aliasValue,aliasKind,arithmeticValue,arithmeticKind
 Err.Clear
 li001.State=Eval(expression)
 code=Err.Number
 Err.Clear
 result=li001.State
 kind=VarType(result)
 aliasValue=result
 aliasKind=VarType(aliasValue)
 arithmeticValue=li001.State+1
 arithmeticKind=VarType(arithmeticValue)
 Debug.Print "LIGHT_STATE_NATIVE|" & label & "|" & code & "|" & kind & "|" & RefLightExact(result) & "|" & aliasKind & "|" & arithmeticKind & "|" & RefLightExact(arithmeticValue)
 On Error GoTo 0
End Sub`;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0,saved=false;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1000;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Native light-state probe timed out: '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate('finni.evaluate('+JSON.stringify(declarations)+')');saved=true;const cases=[];
 for(const [index,expression]of expressions.entries()){
  await evaluate('finni.evaluate('+JSON.stringify(`RefLightStateProbe "case${index}", "${expression.replaceAll('"','""')}"`)+')');
  const log=await evaluate('document.getElementById("log").textContent'),match=log.match(new RegExp('LIGHT_STATE_NATIVE\\|case'+index+'\\|([\\d,|+\\-]+)'));assert.ok(match,'Original light dispatch readback exists: '+expression);const parts=match[1].split('|');assert.equal(parts.length,6);const decode=text=>{const words=text.split(',').map(Number);assert.equal(words.length,3);assert.ok(words.every(Number.isSafeInteger));return{words,value:(words[0]*16777216+words[1])/2**words[2]};},[error,type,aliasType,arithmeticType]=[parts[0],parts[1],parts[3],parts[4]].map(Number),state=decode(parts[2]),arithmetic=decode(parts[5]);assert.ok([error,type,state.value,aliasType,arithmeticType,arithmetic.value].every(Number.isFinite));assert.equal(Math.fround(state.value),state.value);cases.push({expression,error,type,value:state.value,valueWords:state.words,aliasType,arithmeticType,arithmeticValue:arithmetic.value,arithmeticWords:arithmetic.words});
 }
 await evaluate('finni.evaluate(\'li001.State=RefLightSaved:Debug.Print "LIGHT_STATE_RESTORED|" & CStr(li001.State=RefLightSaved)\')');assert.ok((await evaluate('document.getElementById("log").textContent')).includes('LIGHT_STATE_RESTORED|True'));saved=false;
 const engineSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(errors,[]);
 fs.writeFileSync(output+'/'+name,JSON.stringify({scope:'Original native Light.State setter/getter, alias and arithmetic results. Only the declared input expressions are assigned, and the original property is restored.',engineSHA256,declarations,cases,restored:true,errors},null,2),{flag:'wx'});console.log(JSON.stringify({cases,restored:true}));
}finally{if(saved)await evaluate('finni.evaluate("li001.State=RefLightSaved")');socket.close();}
