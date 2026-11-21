// Measure the actual pinned native scripting engine in one synchronous call;
// explicit Rnd/Randomize arguments are conformance inputs, not trajectory fits.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const cases=[];
for(const seed of [-1,-2,-.5,-123.456,-16777217])cases.push({name:`negative-${seed}`,statements:[`Rnd(${seed})`,'Rnd(0)','Rnd','Rnd()','Rnd(1)','Rnd(0)',`Rnd(${seed})`,'Rnd(1)']});
for(const seed of [0,1,2,-1,.5,123.456,2147483647])cases.push({name:`randomize-${seed}`,statements:['Rnd(-1)',`Randomize ${seed}`,'Rnd(0)','Rnd(1)','Rnd','Rnd(0)',`Randomize ${seed}`,'Rnd(0)','Rnd(1)']});
cases.push({name:'coercions',statements:['Rnd(-1)','Rnd(True)','Rnd(False)','Rnd(Empty)','Rnd("2")','Rnd("-0.5")','Rnd(0)','Randomize "123.456"','Rnd(1)']});
const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSha256=createHash('sha256').update(wasm).digest('hex');
assert.equal(engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
try{
  await call('Page.enable');await call('Page.navigate',{url:base});
  await wait('!!window.finni && !document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  const commands=['Dim RefRndValue'];
  for(const [i,c]of cases.entries())for(const [j,statement]of c.statements.entries()){
    commands.push(statement.startsWith('Randomize')?statement:`RefRndValue=${statement}`);
    // Multiplication by 2^24 gives the exact integer behind every Single
    // output, avoiding native CStr formatting of very small floating values.
    commands.push(`Debug.Print "SCRIPT_RANDOM|${i}|${j}|" & CLng(Rnd(0)*16777216) & "|" & VarType(Rnd(0))`);
  }
  await evaluate(`finni.evaluate(${JSON.stringify(commands.join(':'))})`);
  const log=await evaluate('document.getElementById("log").textContent');
  const rows=[...log.matchAll(/SCRIPT_RANDOM\|(\d+)\|(\d+)\|(\d+)\|(\d+)/g)].map(m=>m.slice(1).map(Number));
  assert.equal(rows.length,cases.reduce((n,c)=>n+c.statements.length,0),log.slice(-1500));
  for(const [i,c]of cases.entries())c.samples=rows.filter(row=>row[0]===i).map(([,step,units,type])=>({step,units,type}));
  const fixture={probeKind:'script-random',engineSha256,source:'https://github.com/vpinball/libwinevbs/blob/b5503c581b7d0e6f4f1d84d604cf5e9372c940d7/wine/dlls/vbscript/global.c',capture:'Synchronous native evaluate; integer Single outputs in 2^-24 units; no intervening table timers.',cases};
  await writeFile(`${output}/vpx-script-random.json`,JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,outputs:rows.length,engineSha256}));
}finally{socket.close();}
