import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partyChooserScript} from '../browser/party-chooser.js';
import {earnedScoopFields,earnedScoopBooleans,observeEarnedScoop,runEarnedScoop} from './earned-multiball-scoop-scenario.mjs';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-player');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=JSON.parse(fs.readFileSync('three/public/source-table.json','utf8'));
const metadata=await(await fetch(new URL(native?'/reference-metadata.json':'source-table.json',base))).json();
assert.equal(native?metadata.sourceSha256:metadata.sourceTableSHA256,source.sourceTableSHA256);assert.equal(metadata.engineSHA256,source.engineSHA256);
if(native)assert.equal(sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())),source.engineSHA256);
const instrumentation=observeEarnedScoop(fs.readFileSync('three/public/rules.vbs','utf8'));
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Earned multiball wait '+expression);};
const execute=statement=>evaluate(native?'finni.evaluate('+JSON.stringify(statement)+')':'earnedQA.command('+JSON.stringify({type:'execute',statement})+')');
const keys=Object.keys(earnedScoopFields);
async function read(){
  let values;
  if(native){
    const marker='EARNED_MULTIBALL_SCOOP|';
    await execute('Debug.Print "'+marker+'" & '+Object.values(earnedScoopFields).map(f=>'CStr('+f+')').join(' & "|" & '));
    values=await evaluate(`(()=>{const text=document.getElementById('log').textContent,marker=${JSON.stringify(marker)},at=text.lastIndexOf(marker);if(at<0)throw Error('Missing earned scoop observation');return text.slice(at+marker.length).split(String.fromCharCode(10))[0].split(String.fromCharCode(13))[0].split("'")[0].trim().split('|');})()`);
    assert.equal(values.length,keys.length);
  }else{
    await evaluate('earnedQA.command({type:"barrier"})');const latest=await evaluate('earnedQA.latest');values=Object.values(earnedScoopFields).map(f=>latest[f]);
  }
  return Object.fromEntries(keys.map((key,i)=>[key,key==='ids'?String(values[i]??'').split(',').filter(Boolean).map(Number):earnedScoopBooleans.has(key)?native?values[i]==='True':!!values[i]:Number(values[i])]));
}
const dispatch=async(action,down)=>{const key=action==='launch'?{code:'Enter',key:'Enter'}:{code:'Space',key:' '};await call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',...key});};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  if(!native)await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.earnedQA={pending:new Map(),id:960000,latest:null,fatal:[]};s.command=message=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({...message,id});});window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='response'&&s.pending.has(data.id)){const p=s.pending.get(data.id);s.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}if(data.type==='snapshot')s.latest=Object.fromEntries(data.snapshot.values);if(data.type==='fatal')s.fatal.push(data.message);});}postMessage(message,...args){if(message.type==='init')s.worker=this;return super.postMessage(message,...args);}};})()`});
  await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
  await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  if(native)await execute(partyChooserScript);
  await execute(instrumentation);
  if(!native)await evaluate('earnedQA.command('+JSON.stringify({type:'subscribe',names:[],queries:Object.values(earnedScoopFields)})+')');
  await dispatch('launch',true);await sleep(650);await dispatch('launch',false);await wait('!document.body.classList.contains("ball-in-plunger")');
  const result=await runEarnedScoop({read,execute,input:dispatch,advance:sleep,assert});
  const report={scope:'Original initialization, launch and declared physical Lock approaches earn Ninja multiball through its three original locks and timed AddMultiball queue. Three declared scoop approaches enter one chooser; original keys select and confirm under a burst. All three use the original 3000ms ejection and 350ms queue; two subsequent approaches during the active mode use ordinary ejection. Instrumentation only increments counters inside original handlers and reads GetBalls IDs. No qualification/counter setters, direct Hit calls, RNG, clock, timer, expected body, allocator or rescue input. The shared player chooser correction is explicitly installed in the native reference. This is controlled physical coverage, not ordinary-input-only play or exact trajectory comparison.',base,native,metadata,engineBytesVerified:native,probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),scenarioSHA256:sha(fs.readFileSync(new URL('./earned-multiball-scoop-scenario.mjs',import.meta.url))),partyChooserSHA256:sha(partyChooserScript),instrumentation,instrumentationSHA256:sha(instrumentation),...result,errors};
  fs.writeFileSync(path.join(output,'earned-multiball-scoop.json'),JSON.stringify(report,null,2),{flag:'wx'});
  assert.deepEqual(errors,[]);if(!native)assert.deepEqual(await evaluate('earnedQA.fatal'),[]);
  console.log(JSON.stringify({native,phases:result.rows.map(r=>({phase:r.phase,ms:r.ms,hole:r.hole,kicks:r.scoopKicks,starts:r.starts})),errors}));
}catch(error){
  fs.writeFileSync(path.join(output,'earned-multiball-scoop-failure.json'),JSON.stringify({base,native,error:String(error),state:await read().catch(e=>String(e)),errors},null,2),{flag:'wx'});throw error;
}finally{socket.close();}
