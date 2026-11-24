// Cold production-load inventory, including the real simulation worker's
// requests. No game is started and no clocks, RNG or state are replaced.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const cacheDisabled=!process.argv.includes('--allow-http-cache');
const requiredAtlasTransfers=process.argv.find(arg=>arg.startsWith('--require-atlas-transfers='))?.split('=')[1];
if(requiredAtlasTransfers!==undefined)assert.ok(Number.isInteger(Number(requiredAtlasTransfers))&&Number(requiredAtlasTransfers)>0);
const name=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'production-startup-resources.json';
assert.match(name,/^[a-z0-9.-]+\.json$/i);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),resources=new Map(),errors=[];
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
socket.addEventListener('message',async event=>{
 const data=JSON.parse(event.data),params=data.params;
 if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
 if(data.method==='Runtime.exceptionThrown')errors.push(params);
 if(data.method==='Target.attachedToTarget'){
  const session=data.params.sessionId;
  try{await call('Network.enable',{},session);await call('Network.setCacheDisabled',{cacheDisabled},session);}
  catch(error){errors.push({workerNetwork:error.message});}
  finally{await call('Runtime.runIfWaitingForDebugger',{},session);}
 }
 if(data.method?.startsWith('Network.')){
  const key=(data.sessionId??'page')+':'+params.requestId;
  if(data.method==='Network.requestWillBeSent')resources.set(key,{url:params.request.url,target:data.sessionId?'worker':'page',type:params.type,requestTime:params.timestamp});
  const row=resources.get(key);if(!row)return;
  if(data.method==='Network.responseReceived'){row.status=params.response.status;row.mimeType=params.response.mimeType;row.encoding=Object.entries(params.response.headers).find(([key])=>key.toLowerCase()==='content-encoding')?.[1]??'identity';row.diskCache=!!params.response.fromDiskCache;}
  if(data.method==='Network.dataReceived')row.receivedBodyBytes=(row.receivedBodyBytes??0)+params.encodedDataLength;
  if(data.method==='Network.loadingFinished'){row.transferredBytes=params.encodedDataLength;row.finishTime=params.timestamp;}
  if(data.method==='Network.loadingFailed')row.failure=params.errorText;
 }
});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled});
 await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.startupAuditDraws=0;for(const Context of [WebGLRenderingContext,WebGL2RenderingContext])for(const key of ['drawElements','drawArrays']){const original=Context.prototype[key];Context.prototype[key]=function(...args){startupAuditDraws++;return original.apply(this,args);};}`});
 const started=Date.now();await call('Page.navigate',{url:base});let ready=false;
 for(let attempt=0;attempt<400;attempt++){if(await evaluate('document.getElementById("play")?.textContent==="Start game"&&startupAuditDraws>0')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(ready,'Production is ready and has rendered');
 assert.equal(await evaluate('!!window.finniThree'),false);assert.equal(await evaluate('document.body.classList.contains("playing")'),false);
 assert.deepEqual(errors,[]);
 const rows=[...resources.values()].map(row=>({...row,pending:row.finishTime===undefined&&!row.failure,observedBytes:row.transferredBytes??row.receivedBodyBytes??0})).sort((a,b)=>b.observedBytes-a.observedBytes);
 assert.ok(rows.some(row=>row.target==='worker'&&row.transferredBytes>0),'Worker requests are included');
 const atlasTransfers=rows.filter(row=>new URL(row.url).pathname.endsWith('/dmd-atlas.png'));
 const report={scope:'Cold production startup to enabled Start and first WebGL draw. Phone-sized desktop Edge viewport and empty browser profile; HTTP cache policy is recorded separately. Completed transfer sizes include headers; pending requests retain observed encoded body bytes separately. Not phone hardware or cellular speed. No game starts and no source clock/RNG/state is replaced.',base,httpCacheDisabled:cacheDisabled,coldStartupMilliseconds:Date.now()-started,viewport:{width:390,height:844,deviceScaleFactor:2,mobile:true},transferredBytes:rows.reduce((sum,row)=>sum+(row.transferredBytes??0),0),pendingBodyBytes:rows.filter(row=>row.pending).reduce((sum,row)=>sum+(row.receivedBodyBytes??0),0),atlasTransfers:atlasTransfers.length,rows,errors};
 await writeFile(output+'/'+name,JSON.stringify(report,null,2));console.log(JSON.stringify({coldStartupMilliseconds:report.coldStartupMilliseconds,transferredBytes:report.transferredBytes,largest:rows.slice(0,10)}));
 assert.ok(rows.every(row=>!row.failure&&(row.pending||row.status<400)),'Every completed startup request succeeds');
 if(requiredAtlasTransfers!==undefined)assert.equal(atlasTransfers.length,Number(requiredAtlasTransfers),'Actual startup atlas transfer count');
}finally{socket.close();}
