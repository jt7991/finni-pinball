// Cold production-load inventory, including the real simulation worker's
// requests. No game is started and no clocks, RNG or state are replaced.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const cacheDisabled=!process.argv.includes('--allow-http-cache');
const loadCount=Number(process.argv.find(arg=>arg.startsWith('--loads='))?.split('=')[1]??1),requireWarm=process.argv.includes('--require-warm-validation');
const serverAuditFile=process.argv.find(arg=>arg.startsWith('--server-audit-log='))?.slice('--server-audit-log='.length),usedServerRecords=new Set();
assert.ok(Number.isInteger(loadCount)&&loadCount>=1&&loadCount<=4);
if(requireWarm)assert.ok(loadCount>=2&&!cacheDisabled,'Warm validation requires repeated normal-cache loads');
const requiredAtlasTransfers=process.argv.find(arg=>arg.startsWith('--require-atlas-transfers='))?.split('=')[1];
if(requiredAtlasTransfers!==undefined)assert.ok(Number.isInteger(Number(requiredAtlasTransfers))&&Number(requiredAtlasTransfers)>0);
const name=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'production-startup-resources.json';
assert.match(name,/^[a-z0-9.-]+\.json$/i);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0,activeLoad=0;const pending=new Map(),resources=new Map(),extraInfo=new Map(),errors=[],reports=[];
const header=(headers,name)=>Object.entries(headers??{}).find(([key])=>key.toLowerCase()===name)?.[1];
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
  if(data.method==='Network.requestWillBeSent')resources.set(key,{load:activeLoad,url:params.request.url,target:data.sessionId?'worker':'page',type:params.type,requestTime:params.timestamp,requestEpochMilliseconds:params.wallTime*1000,...extraInfo.get(key)});
  if(data.method==='Network.requestWillBeSentExtraInfo'||data.method==='Network.responseReceivedExtraInfo'){
   const extra=extraInfo.get(key)??{};
   if(data.method==='Network.requestWillBeSentExtraInfo'){extra.ifNoneMatch=header(params.headers,'if-none-match');extra.ifModifiedSince=header(params.headers,'if-modified-since');}
   else{extra.wireStatus=params.statusCode;extra.etag=header(params.headers,'etag');extra.cacheControl=header(params.headers,'cache-control');}
   extraInfo.set(key,extra);Object.assign(resources.get(key)??{},extra);
  }
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
 for(let load=0;load<loadCount;load++){
 if(load){await call('Page.navigate',{url:'about:blank'});for(let attempt=0;attempt<100;attempt++){if(await evaluate('location.href==="about:blank"'))break;await new Promise(resolve=>setTimeout(resolve,20));}assert.equal(await evaluate('location.href'),'about:blank');}
 activeLoad=load;
 const started=Date.now();await call('Page.navigate',{url:base});let ready=false;
 for(let attempt=0;attempt<400;attempt++){if(await evaluate('document.getElementById("play")?.textContent==="Start game"&&startupAuditDraws>0')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(ready,'Production is ready and has rendered');
 assert.equal(await evaluate('!!window.finniThree'),false);assert.equal(await evaluate('document.body.classList.contains("playing")'),false);
 assert.deepEqual(errors,[]);
 const rows=[...resources.values()].filter(row=>row.load===load).map(row=>({...row,pending:row.finishTime===undefined&&!row.failure,observedBytes:row.transferredBytes??row.receivedBodyBytes??0})).sort((a,b)=>b.observedBytes-a.observedBytes);
 if(serverAuditFile){
  const text=await readFile(serverAuditFile,'utf8'),records=text.split('\n').slice(0,-1).map((line,index)=>({...JSON.parse(line),index}));
  for(const row of rows){
   const matches=records.filter(record=>!usedServerRecords.has(record.index)&&new URL(record.url,base).href===row.url&&Math.abs(record.started-row.requestEpochMilliseconds)<1000).sort((a,b)=>Math.abs(a.started-row.requestEpochMilliseconds)-Math.abs(b.started-row.requestEpochMilliseconds));
   const record=matches[0];if(!record)continue;usedServerRecords.add(record.index);
   row.serverValidation=record;
   if(row.wireStatus!==undefined)assert.equal(record.status,row.wireStatus,'Browser and server independently observe the same wire status');
   if(row.etag!==undefined)assert.equal(record.etag,row.etag);
   if(row.ifNoneMatch!==undefined)assert.equal(record.ifNoneMatch,row.ifNoneMatch);
  }
 }
 assert.ok(rows.some(row=>row.target==='worker'&&row.transferredBytes>0),'Worker requests are included');
 const atlasTransfers=rows.filter(row=>new URL(row.url).pathname.endsWith('/dmd-atlas.png'));
 const report={scope:'Production startup to enabled Start and first WebGL draw. First load uses an empty browser profile; subsequent loads use the same normal browser cache after visiting about:blank. Optional server records are independently matched once by URL and observed request epoch; existing browser wire-status/ETag observations must agree. HTTP cache policy is recorded separately. Completed transfer sizes include headers; pending requests retain observed encoded body bytes separately. Not phone hardware or cellular speed. No game starts and no source clock/RNG/state is replaced.',base,load,httpCacheDisabled:cacheDisabled,serverAuditFile,coldStartupMilliseconds:Date.now()-started,viewport:{width:390,height:844,deviceScaleFactor:2,mobile:true},transferredBytes:rows.reduce((sum,row)=>sum+(row.transferredBytes??0),0),pendingBodyBytes:rows.filter(row=>row.pending).reduce((sum,row)=>sum+(row.receivedBodyBytes??0),0),atlasTransfers:atlasTransfers.length,rows,errors};
 reports.push(report);await writeFile(output+'/'+name,JSON.stringify(loadCount===1?report:{base,httpCacheDisabled:cacheDisabled,loads:reports,errors},null,2));console.log(JSON.stringify({load,coldStartupMilliseconds:report.coldStartupMilliseconds,transferredBytes:report.transferredBytes,validated:rows.filter(row=>row.wireStatus===304).length,largest:rows.slice(0,5)}));
 assert.ok(rows.every(row=>!row.failure&&(row.pending||row.status<400)),'Every completed startup request succeeds');
 if(requiredAtlasTransfers!==undefined)assert.equal(atlasTransfers.length,Number(requiredAtlasTransfers),'Actual startup atlas transfer count');
 if(requireWarm&&load){
  assert.ok(report.transferredBytes<reports[0].transferredBytes*.1,'Reopening avoids unchanged asset bodies');
  const assets=rows.filter(row=>{const url=new URL(row.url);return url.origin===new URL(base).origin&&/^https?:$/.test(url.protocol)&&!url.pathname.startsWith('/api/');});
  assert.ok(assets.length>0);
  for(const row of assets){
   assert.ok((row.wireStatus??row.serverValidation?.status)===304||row.diskCache&&row.observedBytes===0,'Every static request validates or uses cached data: '+row.url);
   assert.equal(row.receivedBodyBytes??0,0,'Unchanged static bodies are not transferred again');
   if(row.serverValidation?.status===304)assert.equal(row.serverValidation.ifNoneMatch,row.serverValidation.etag,'Browser validates the existing asset version');
  }
  for(const suffix of ['/three/','/layout.json','/objects.json','/rules.vbs','/native-table/table-meshes.delta.bin','/dmd-atlas.png']){
   const rowsForAsset=rows.filter(row=>new URL(row.url).pathname.endsWith(suffix));assert.ok(rowsForAsset.length,'Warm load includes '+suffix);
   assert.ok(rowsForAsset.every(row=>(row.wireStatus??row.serverValidation?.status)===304||row.diskCache&&row.observedBytes===0),'Every '+suffix+' cache entry is validated or served from cache');
  }
 }
 }
}finally{socket.close();}
