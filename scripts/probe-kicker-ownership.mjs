// Controlled kicker API component: a held ball and an unrelated ActiveBall.
// Creation uses the public authored API; the free ball receives one normal
// keyboard launch. No body, timer, RNG or expected result is restored.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-player');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=JSON.parse(fs.readFileSync('three/public/source-table.json','utf8'));
const metadata=await(await fetch(new URL(native?'/reference-metadata.json':'source-table.json',base))).json();
assert.equal(native?metadata.sourceSha256:metadata.sourceTableSHA256,source.sourceTableSHA256);
assert.equal(metadata.engineSHA256,source.engineSHA256);
if(native)assert.equal(sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())),source.engineSHA256);
const provenance={metadata,probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),engineBytesVerified:native};
const setup=`Dim OwnerHeld,OwnerHeldID,OwnerResult1,OwnerResult2
OwnerResult1=CLng(-99):OwnerResult2=CLng(-99)
Function OwnerIDs()
 Dim all,ball,result
 result="":all=GetBalls()
 For Each ball In all:result=result&CStr(ball.ID)&",":Next
 OwnerIDs=result
End Function`;
const fields=['OwnerHeldID','ActiveBall.ID','OwnerIDs()','OwnerResult1','OwnerResult2','VarType(OwnerResult1)','VarType(OwnerResult2)'];
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Kicker owner wait '+expression);};
const execute=statement=>evaluate(native?'finni.evaluate('+JSON.stringify(statement)+')':'ownerQA.command('+JSON.stringify({type:'execute',statement})+')');
const ids=value=>String(value).split(',').filter(Boolean).map(Number);
async function read(stage){
 if(native){await execute('Debug.Print "KICKER_OWNER_QA|'+stage+'|" & '+fields.map(f=>'CStr('+f+')').join(' & "|" & '));return evaluate(`(()=>{const text=document.getElementById('log').textContent,marker=${JSON.stringify('KICKER_OWNER_QA|'+stage+'|')},at=text.lastIndexOf(marker);if(at<0)throw Error('Missing native ownership marker');const p=text.slice(at+marker.length).split(String.fromCharCode(10))[0].split(String.fromCharCode(13))[0].split("'")[0].trim().split('|'),number=s=>s===''?null:Number(s);return{held:number(p[0]),active:number(p[1]),ids:p[2].split(',').filter(Boolean).map(Number),first:number(p[3]),second:number(p[4]),firstType:number(p[5]),secondType:number(p[6])};})()`);}
 await evaluate('ownerQA.command({type:"barrier"})');const v=await evaluate('ownerQA.latest.values');return{held:v.OwnerHeldID,active:v['ActiveBall.ID'],ids:ids(v['OwnerIDs()']),first:v.OwnerResult1??null,second:v.OwnerResult2??null,firstType:v['VarType(OwnerResult1)'],secondType:v['VarType(OwnerResult2)']};
}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 if(!native)await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.ownerQA={pending:new Map(),id:920000,latest:null,fatal:[]};s.command=message=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({...message,id});});window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='response'&&s.pending.has(data.id)){const p=s.pending.get(data.id);s.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}if(data.type==='snapshot')s.latest={time:data.snapshot.time,values:Object.fromEntries(data.snapshot.values)};if(data.type==='fatal')s.fatal.push(data.message);});}postMessage(message,...args){if(message.type==='init')s.worker=this;return super.postMessage(message,...args);}};})()`});
 await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await execute(setup);await execute('Set OwnerHeld=HellHouse.CreateBall:OwnerHeldID=OwnerHeld.ID');if(!native)await evaluate('ownerQA.command('+JSON.stringify({type:'subscribe',names:[],queries:fields})+')');
 await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(r=>setTimeout(r,650));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});await wait('!document.body.classList.contains("ball-in-plunger")');
 if(!native)await wait('ownerQA.latest?.values["ActiveBall.ID"]!==undefined');
 const before=await read('before');console.log(JSON.stringify({before}));assert.ok(before.ids.includes(before.held));assert.ok(before.ids.includes(before.active));assert.notEqual(before.held,before.active,'The normal launch establishes an unrelated ActiveBall');
 await execute('OwnerResult1=HellHouse.DestroyBall');const first=await read('first');await execute('OwnerResult2=HellHouse.DestroyBall');const second=await read('second');
 const report={scope:'Explicit extra held ball created through HellHouse.CreateBall, plus one ordinary keyboard launch of the enrolled player ball. This isolates kicker DestroyBall ownership/return type with an unrelated ActiveBall. No body, clock, RNG, timer deadline or expected result is supplied. It does not establish natural reachability of a user-reported scoop hold.',base,native,provenance,before,first,second,errors};fs.writeFileSync(path.join(output,'kicker-ownership.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
 assert.deepEqual(errors,[]);if(!native)assert.deepEqual(await evaluate('ownerQA.fatal'),[]);assert.equal(first.first,1);assert.equal(first.firstType,3);assert.deepEqual(first.ids,before.ids.filter(id=>id!==before.held));assert.equal(second.second,0);assert.equal(second.secondType,3);assert.deepEqual(second.ids,first.ids,'Empty kicker leaves every unrelated ball alive');
}finally{socket.close();}
