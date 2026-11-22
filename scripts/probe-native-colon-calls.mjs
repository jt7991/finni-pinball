// Original native VBScript parser; explicit counters, no game-state overrides.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+expression);};
const cases=[
 {name:'inline collection handler',body:'Sub Handler(idx):Mark:End Sub\nHandler 4'},
 {name:'call followed by assignment',body:'Mark:Count=Count+10'},
 {name:'single-line conditional',body:'If True Then Mark:Count=Count+10 Else Count=100'},
 {name:'colon-separated loop',body:'Dim idx\nFor idx=1 To 3:Mark:Next'},
 {name:'literal and comment colons',body:'Dim text\ntext="Mark:":\' Mark:\nMark:Count=Count+10'},
 {name:'discarded function result',body:'Function Value()\nCount=Count+1:Value=42\nEnd Function\nValue:Count=Count+10'},
].map(c=>({...c,source:'Dim Count:Count=0\nSub Mark()\nCount=Count+1\nEnd Sub\n'+c.body,expression:'Count'}));
try{
 await call('Page.enable');await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 for(const [index,c]of cases.entries()){
  // Unique names keep the cases independent inside the native script context.
  const suffix='RefColon'+index,source=c.source.replace(/\b(Count|Mark|Handler|idx|text|Value)\b/g,name=>suffix+name),expression=suffix+c.expression,marker='NATIVE_COLON_'+index;
  await evaluate('finni.evaluate('+JSON.stringify(source+'\nDebug.Print "'+marker+'|" & '+expression)+')');
  const log=await evaluate('document.getElementById("log").textContent'),match=log.match(new RegExp(marker+'\\|(-?\\d+)'));assert.ok(match,c.name+': '+log.slice(-1200));c.expected=Number(match[1]);
 }
 const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const fixture={engineSHA256,reference:await(await fetch(new URL('/reference-metadata.json',base))).json(),scope:'Original native VBScript evaluates each program and emits its counter. Names are prefixed only to isolate cases. No clock, RNG, body or render-state overrides.',cases};fs.writeFileSync(output+'/native-colon-calls.json',JSON.stringify(fixture,null,2));console.log(JSON.stringify({engineSHA256,cases:cases.map(c=>({name:c.name,expected:c.expected}))}));
}finally{socket.close();}
