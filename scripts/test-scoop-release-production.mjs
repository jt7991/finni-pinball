// Controlled active-mode/stale-ready qualification, then a physical scoop
// approach while two other authored balls are live. No expected-output rescue.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {partyChooserScript} from '../browser/party-chooser.js';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-player'),installFix=process.argv.includes('--install-scoop-fix');
const source=fs.readFileSync('three/public/rules.vbs','utf8'),sub=name=>source.match(new RegExp('^Sub '+name+'\\b[^\\n]*[\\s\\S]*?^End Sub','mi'))[0];
const instrumentation='Dim ScoopQKicks\nScoopQKicks=0\n'+sub('kickBallOut').replace(/(If BallsinHole> 0 Then)/i,'$1\n ScoopQKicks=ScoopQKicks+1');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Scoop wait '+expression);};
const execute=statement=>evaluate(native?'finni.evaluate('+JSON.stringify(statement)+')':'scoopQA.command('+JSON.stringify({type:'execute',statement})+')');
const fields=['GameTime','BallsInHole','bChooseBattle','Battle(CurrentPlayer,0)','BallsOnPlayfield','ScoopQKicks'];
async function read(){
  if(native){
    await execute('Debug.Print "SCOOP_RELEASE_QA|" & '+fields.map(f=>'CStr('+f+')').join(' & "|" & '));
    return evaluate(`(()=>{const row=[...document.getElementById('log').textContent.matchAll(/SCOOP_RELEASE_QA\\|(\\d+)\\|(\\d+)\\|(True|False)\\|(\\d+)\\|(\\d+)\\|(\\d+)/g)].at(-1);if(!row)throw Error('Missing native scoop observation');return{ms:Number(row[1]),hole:Number(row[2]),choosing:row[3]==='True',mode:Number(row[4]),balls:Number(row[5]),kicks:Number(row[6])};})()`);
  }
  await evaluate('scoopQA.command({type:"barrier"})');return evaluate('(()=>{const v=scoopQA.latest.values;return{ms:Math.round(scoopQA.latest.time*1000),hole:v.BallsInHole,choosing:v.bChooseBattle,mode:v["Battle(CurrentPlayer,0)"],balls:v.BallsOnPlayfield,kicks:v.ScoopQKicks};})()');
}
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  if(!native)await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.scoopQA={pending:new Map(),id:910000,latest:null,fatal:[]};s.command=message=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({...message,id});});window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='response'&&s.pending.has(data.id)){const p=s.pending.get(data.id);s.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}if(data.type==='snapshot')s.latest={time:data.snapshot.time,values:Object.fromEntries(data.snapshot.values),paused:data.paused};if(data.type==='fatal')s.fatal.push(data.message);});}postMessage(message,...args){if(message.type==='init')s.worker=this;return super.postMessage(message,...args);}};})()`});
  await call('Page.navigate',{url:base});await wait('!!document.getElementById("play")&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  if(installFix)await execute(partyChooserScript);
  await execute(instrumentation);
  if(!native)await evaluate('scoopQA.command('+JSON.stringify({type:'subscribe',names:[],queries:fields.slice(1)})+')');
  await execute('Battle(CurrentPlayer,0)=1:bBattleReady=True:CreateNewBall:CreateNewBall');
  const qualified=await read();assert.equal(qualified.balls,3);assert.equal(qualified.choosing,false);
  await execute('Dim ScoopQBalls,ScoopQBall:ScoopQBalls=GetBalls():For Each ScoopQBall In ScoopQBalls:If ScoopQBall.ID=3 Then:ScoopQBall.X=293.68433:ScoopQBall.Y=530:ScoopQBall.Z=25:ScoopQBall.VelX=0:ScoopQBall.VelY=-8:ScoopQBall.VelZ=0:End If:Next');
  const samples=[];let captured;
  for(let i=0;i<100;i++){const state=await read();samples.push(state);if(state.hole>0){captured=state;break;}await new Promise(r=>setTimeout(r,25));}
  assert.ok(captured,'incoming ball physically reaches the scoop');assert.equal(captured.choosing,false);assert.equal(captured.mode,1);
  let released;
  while(samples.at(-1).ms-captured.ms<2200){const state=await read();samples.push(state);if(state.kicks>0){released=state;break;}await new Promise(r=>setTimeout(r,25));}
  const report={scope:'Explicit active-mode and stale-ready qualification with two additional balls created by authored CreateNewBall. One declared physical approach selects live ball ID3. Original KickBallOut body gains only a counter inside its existing positive-hole condition. No clocks, RNG, timer deadlines, collision outputs or ball rescue are supplied. This verifies the rejected-chooser branch during multiball, not natural reachability of the initial stale-ready qualification.',base,native,installFix,qualified,captured,released,samples,errors};
  fs.writeFileSync(output+'/scoop-release-production.json',JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({native,installFix,qualified,captured,released,errors}));
  assert.deepEqual(errors,[]);if(!native)assert.deepEqual(await evaluate('scoopQA.fatal'),[]);assert.ok(released,'captured multiball must receive its normal eject callback');assert.equal(released.choosing,false);assert.equal(released.mode,1);
}finally{socket.close();}
