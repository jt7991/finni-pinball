// Measure actual CPU-throttle coverage in the paused production game's worker.
// No physics state, clock, random word, input or game packet is replaced.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const [debug,base,output]=process.argv.slice(2);
const name=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'worker-throttle-coverage.json';
assert.match(name,/^[a-z0-9.-]+\.json$/i);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0,workerSession,workerURL;
const pending=new Map(),errors=[],records=[];
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
 const id=++seq;pending.set(id,{resolve,reject});
 socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
});
socket.addEventListener('message',event=>{
 const data=JSON.parse(event.data);
 if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
 if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
 if(data.method==='Target.attachedToTarget'){
  const {sessionId,targetInfo}=data.params;
  if(targetInfo.type==='worker'&&targetInfo.url.includes('simulation-worker')){workerSession=sessionId;workerURL=targetInfo.url;}
 }
});
const evaluate=async(expression,sessionId)=>{
 const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
 assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
};
const wait=async expression=>{
 for(let count=0;count<400;count++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}
 throw Error('Timed out: '+expression);
};
// The same fixed arithmetic and iteration count execute in both targets. Keep
// the result observable and warm the functions before retaining measurements.
const install=`(()=>{
 globalThis.cpuThrottleProbe={burn(iterations){let total=0;const start=performance.now();for(let i=0;i<iterations;i++)total+=Math.sqrt((i&4095)+.5);this.total=total;return{milliseconds:performance.now()-start,total};}};
 for(let i=0;i<3;i++)cpuThrottleProbe.burn(4000000);
})()`;
const measure=async(sessionId)=>{
 const result=await evaluate('Array.from({length:5},()=>cpuThrottleProbe.burn(32000000))',sessionId);
 assert.ok(result.every(row=>row.total===result[0].total&&row.milliseconds>0));
 const sorted=result.map(row=>row.milliseconds).sort((a,b)=>a-b);
 return{samples:result,medianMilliseconds:sorted[2]};
};
let workerCommandError;
try{
 await call('Runtime.enable');await call('Page.enable');
 await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
 await call('Emulation.setCPUThrottlingRate',{rate:1});
 await call('Page.navigate',{url:base});
 await wait('document.getElementById("play")?.textContent==="Start game"');
 assert.ok(workerSession,'Actual production simulation worker attached');
 assert.match(workerURL,/simulation-worker/);
 assert.equal(await evaluate('!!window.finniThree'),false,'No development game hook');
 await evaluate(install);await evaluate(install,workerSession);
 for(const mainRate of [1,4,1]){
  await call('Emulation.setCPUThrottlingRate',{rate:mainRate});
  const record={stage:'page-command',mainRate,main:await measure(),worker:await measure(workerSession)};
  records.push(record);console.log(JSON.stringify(record));
 }
 try{await call('Emulation.setCPUThrottlingRate',{rate:4},workerSession);}
 catch(error){workerCommandError=error.message;}
 if(!workerCommandError){
  records.push({stage:'worker-command',workerRate:4,main:await measure(),worker:await measure(workerSession)});
  await call('Emulation.setCPUThrottlingRate',{rate:1},workerSession);
  records.push({stage:'worker-command',workerRate:1,main:await measure(),worker:await measure(workerSession)});
 }
 assert.deepEqual(errors,[]);
 const checksums=records.flatMap(record=>[...record.main.samples,...record.worker.samples].map(sample=>sample.total));
 assert.ok(checksums.every(total=>total===checksums[0]),'Both targets and every throttle stage complete identical arithmetic');
 assert.equal(await evaluate('document.body.classList.contains("playing")'),false,'Calibration never starts gameplay');
 const normal=records[0],slowed=records[1];
 const report={scope:'Fixed arithmetic in the actual production page and simulation worker before Start. Measures throttle coverage on this desktop browser, not phone speed or gameplay performance. No game input/state/RNG/clock/packet is replaced.',base,workerURL,userAgent:await evaluate('navigator.userAgent'),iterations:32000000,records,...workerCommandError?{workerCommandError}:{},pageCommandRatios:{main:slowed.main.medianMilliseconds/normal.main.medianMilliseconds,worker:slowed.worker.medianMilliseconds/normal.worker.medianMilliseconds},errors};
 await writeFile(output+'/'+name,JSON.stringify(report,null,2));
 console.log(JSON.stringify({pageCommandRatios:report.pageCommandRatios,workerCommandError}));
}finally{
 if(workerSession&&!workerCommandError)await call('Emulation.setCPUThrottlingRate',{rate:1},workerSession).catch(()=>{});
 await call('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});socket.close();
}
