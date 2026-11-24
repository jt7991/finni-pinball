// Query the original compiled script host, including coercion and overflow.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'native-abs.json';assert.match(name,/^[a-z0-9.-]+\.json$/i);
const expressions=['Abs(CInt(-1))','Abs(CInt(0))','Abs(CInt(-32768))','Abs(CLng(-1))','Abs(CLng(0))','Abs(CLng(32767))','Abs(CLng(-32768))','Abs(CLng(-2147483647))','Abs(CLng(-2147483648))','Abs(CSng(-1.25))','Abs(CDbl(-1.25))','Abs(CCur(-1.25))','Abs("-1.25")','Abs("-1")','Abs(True)','Abs(Empty)','Abs(Null)','Abs("bad")','Abs(CDate("1/1/2000"))'];
const declarations=`Sub RefAbsProbe(label,expression)
 On Error Resume Next
 Dim result,code,kind,text
 Err.Clear
 result=Eval(expression)
 code=Err.Number
 Err.Clear
 kind=VarType(result)
 If IsNull(result) Then
  text="null"
 Else
  text=CStr(CDbl(result))
 End If
 Debug.Print "ABS_NATIVE|" & label & "|" & code & "|" & kind & "|" & text
 On Error GoTo 0
End Sub`;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});await call('Page.navigate',{url:base});let ready=false;
 for(let i=0;i<500;i++){if(await evaluate('!!window.finni&&document.getElementById("play")?.textContent==="Start game"&&!document.getElementById("play").disabled')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,30));}assert.ok(ready);
 await evaluate('document.getElementById("play").click()');ready=false;
 for(let i=0;i<1000;i++){if(await evaluate('document.body.classList.contains("ball-in-plunger")')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,30));}if(!ready)fs.writeFileSync(output+'/'+name+'.startup-failure.json',JSON.stringify(await evaluate('({log:document.getElementById("log").textContent,body:document.body.className,play:document.getElementById("play").textContent})'),null,2),{flag:'wx'});assert.ok(ready,'The native table is actually running before querying its script host');
 await evaluate('finni.evaluate('+JSON.stringify(declarations)+')');
 const cases=[];for(const [index,expression]of expressions.entries()){
  const statement=`RefAbsProbe "case${index}", "${expression.replaceAll('"','""')}"`;await evaluate('finni.evaluate('+JSON.stringify(statement)+')');
  const log=await evaluate('document.getElementById("log").textContent'),match=log.match(new RegExp('ABS_NATIVE\\|case'+index+'\\|(\\d+)\\|(\\d+)\\|(null|[-+0-9.eE]+)'));if(!match)fs.writeFileSync(output+'/'+name+'.failure.json',JSON.stringify({expression,declarations,log},null,2),{flag:'wx'});assert.ok(match,'Native case '+expression+' is observed');cases.push({expression,error:Number(match[1]),type:Number(match[2]),value:match[3]==='null'?null:Number(match[3])});
 }
 const bytes=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(bytes).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(errors,[]);
 const result={scope:'Original compiled Abs queried through Eval with read-only result/error/type logging. No rule implementation, numeric coercion or expected result injected.',engineSHA256,declarations,cases,errors};fs.writeFileSync(output+'/'+name,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{socket.close();}
