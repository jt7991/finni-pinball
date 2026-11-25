import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {creationQueries,kickerCreationStatement,verifyCreationCase} from './kicker-creation-scenario.mjs';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-player');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=JSON.parse(fs.readFileSync('three/public/source-table.json','utf8'));
const metadata=await(await fetch(new URL(native?'/reference-metadata.json':'source-table.json',base))).json();
assert.equal(native?metadata.sourceSha256:metadata.sourceTableSHA256,source.sourceTableSHA256);assert.equal(metadata.engineSHA256,source.engineSHA256);
if(native)assert.equal(sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())),source.engineSHA256);
const provenance={metadata,engineBytesVerified:native,probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),scenarioSHA256:sha(fs.readFileSync(new URL('./kicker-creation-scenario.mjs',import.meta.url)))};
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Kicker creation wait '+expression);};
const execute=statement=>evaluate(native?'finni.evaluate('+JSON.stringify(statement)+')':'creationQA.command('+JSON.stringify({type:'execute',statement})+')');
const cases=[];
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  if(!native)await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.creationQA={pending:new Map(),id:930000,latest:null,fatal:[]};s.command=message=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({...message,id});});window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='response'&&s.pending.has(data.id)){const p=s.pending.get(data.id);s.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}if(data.type==='snapshot')s.latest=Object.fromEntries(data.snapshot.values);if(data.type==='fatal')s.fatal.push(data.message);});}postMessage(message,...args){if(message.type==='init')s.worker=this;return super.postMessage(message,...args);}};})()`});
  for(const order of ['kick-destroy','destroy-kick']){
    await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
    const statement=kickerCreationStatement(order);await execute(statement);let values;
    if(native){
      const marker='KICKER_CREATION_QA|';await execute('Debug.Print "'+marker+'" & '+creationQueries.map(f=>'CStr('+f+')').join(' & "|" & '));
      const fields=await evaluate(`(()=>{const text=document.getElementById('log').textContent,marker=${JSON.stringify(marker)},at=text.lastIndexOf(marker);if(at<0)throw Error('Missing native creation marker');return text.slice(at+marker.length).split(String.fromCharCode(10))[0].split(String.fromCharCode(13))[0].split("'")[0].trim().split('|');})()`);
      assert.equal(fields.length,creationQueries.length);values=Object.fromEntries(creationQueries.map((name,index)=>[name,index===2||index===4?Number(fields[index]):fields[index]]));
    }else{
      await evaluate('creationQA.command('+JSON.stringify({type:'subscribe',names:[],queries:creationQueries})+')');await evaluate('creationQA.command({type:"barrier"})');values=await evaluate('creationQA.latest');values=Object.fromEntries(creationQueries.map(name=>[name,values[name]]));assert.deepEqual(await evaluate('creationQA.fatal'),[]);
    }
    cases.push({order,statement,statementSHA256:sha(statement),values});
  }
  const report={scope:'Two independently started games. Each atomic public API component creates two extra balls at one kicker and then kicks/destroys in opposite orders, retaining immediate script snapshots. No Hit handler, body state, clock, RNG, timer deadline or expected outcome is supplied. CStr observations retain native script precision; these are component inputs, not naturally enrolled multiball or proof of the reported intermittent hold.',base,native,provenance,cases,errors};
  fs.writeFileSync(path.join(output,'kicker-creation.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));assert.deepEqual(errors,[]);for(const row of cases)verifyCreationCase(row,assert);
}finally{socket.close();}
