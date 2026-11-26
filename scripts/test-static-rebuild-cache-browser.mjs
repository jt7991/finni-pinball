// One browser cache, two server processes and two byte-identical build trees.
// Reuse the startup auditor so page and simulation-worker traffic are observed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const [debug,,output]=process.argv.slice(2),root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'.work/three-candidate-static-batches-r1'),rebuilt=path.resolve(root,process.argv.find(arg=>arg.startsWith('--rebuilt-directory='))?.slice('--rebuilt-directory='.length)??'.work/three-candidate-content-cache-r1');
assert.equal(path.dirname(rebuilt),path.join(root,'.work'));assert.ok(path.basename(rebuilt).startsWith('three-candidate-content-cache-'));
assert.ok(!fs.existsSync(rebuilt),'Use a fresh rebuilt output');fs.cpSync(source,rebuilt,{recursive:true,errorOnExist:true,force:false});
let server;
async function start(directory,port,label){
 const audit=path.join(output,label+'-server.ndjson'),child=spawn(process.execPath,[path.join(root,'scripts/serve-three.mjs'),'--directory',directory,'--host','127.0.0.1','--port',String(port),'--static-audit-log',audit],{cwd:root,env:{...process.env,POCKETBASE_URL:'http://127.0.0.1:18090'},stdio:['ignore','pipe','pipe']});
 let text='',errors='';const ready=Promise.withResolvers();
 child.stdout.on('data',data=>{text+=data;const match=/Finni Three\.js: (http:\/\/127\.0\.0\.1:\d+\/three\/)/.exec(text);if(match)ready.resolve(match[1]);});child.stderr.on('data',data=>{errors+=data;});child.once('error',ready.reject);child.once('exit',code=>ready.reject(Error('Server exited '+code+': '+errors)));
 server=child;const timer=setTimeout(()=>ready.reject(Error('Server startup timed out: '+errors)),15000);
 try{return{base:await ready.promise,audit};}finally{clearTimeout(timer);}
}
async function stop(){if(server&&server.exitCode===null&&server.signalCode===null){const ended=once(server,'exit');server.kill();await ended;}server=undefined;}
async function audit(label,{base,audit}){
 const child=spawn(process.execPath,[path.join(root,'scripts/audit-production-startup-browser.mjs'),debug,base,output,'--allow-http-cache','--settle-static-requests','--output-name='+label+'.json','--server-audit-log='+audit],{cwd:root,stdio:'inherit'});
 const [code]=await once(child,'exit');assert.equal(code,0,label+' browser audit');return JSON.parse(fs.readFileSync(path.join(output,label+'.json')));
}
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 const first=await start(source,0,'before'),before=await audit('before',first);
 // Terminate the old page's worker before replacing the HTTP process, while
 // retaining this Edge profile's real HTTP cache and original origin.
 await call('Page.navigate',{url:'about:blank'});
 for(let i=0;i<100;i++){const value=await call('Runtime.evaluate',{expression:'location.href',returnByValue:true});if(value.result.value==='about:blank')break;await new Promise(resolve=>setTimeout(resolve,20));}
 const originBefore=new URL(first.base).origin;
 for(let i=0;i<100;i++){const targets=await call('Target.getTargets');if(!targets.targetInfos.some(t=>t.type==='worker'&&(t.url.startsWith(originBefore)||t.url.startsWith('blob:'+originBefore))))break;await new Promise(resolve=>setTimeout(resolve,20));}
 await stop();const second=await start(rebuilt,Number(new URL(first.base).port),'after');assert.equal(second.base,first.base);
 const after=await audit('after',second),origin=new URL(first.base).origin;
 const assets=after.rows.filter(row=>{const url=new URL(row.url);return /^https?:$/.test(url.protocol)&&url.origin===origin&&!url.pathname.startsWith('/api/');});
 assert.ok(assets.length>0);assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);
 for(const row of assets){
  assert.ok((row.wireStatus??row.serverValidation?.status)===304||row.diskCache&&row.observedBytes===0,'Rebuilt static asset validates: '+row.url);
  assert.equal(row.receivedBodyBytes??0,0,'No unchanged static body is transferred: '+row.url);
  assert.ok(!row.pending||row.serverValidation?.finished&&row.serverValidation.status===304&&row.wireStatus===304,'Browser completion or independently confirmed empty 304: '+row.url);
 }
 for(const suffix of ['/three/','/layout.json','/objects.json','/rules.vbs','/native-table/table-meshes.delta.bin','/dmd-atlas.webp'])assert.ok(assets.some(row=>new URL(row.url).pathname.endsWith(suffix)),suffix+' is observed');
 const bank=assets.find(row=>/\/native-audio\/effects-[a-f0-9]+\.bank$/.test(new URL(row.url).pathname));assert.ok(bank,'Full original effect bank validates after the rebuild');
 const changedIdentity=fs.statSync(path.join(source,'index.html'),{bigint:true}).ino!==fs.statSync(path.join(rebuilt,'index.html'),{bigint:true}).ino;assert.equal(changedIdentity,true);
 const report={scope:'Real Edge HTTP cache retained across a server-process replacement at the same origin. The rebuilt tree is a fresh byte-identical copy with different file identities. Both startup audits require the actual packaged worker, enabled Start, first WebGL draw and no game start. Browser and server wire observations must agree; no source state, clocks or RNG are restored. This proves unchanged-body reuse, not a phone speed or gameplay parity claim.',base:first.base,source,rebuilt,changedIdentity,before:{file:'before.json',transferredBytes:before.transferredBytes},after:{file:'after.json',transferredBytes:after.transferredBytes,staticAssets:assets.length,bankBytesTransferred:bank.receivedBodyBytes??0},errors:[]};
 fs.writeFileSync(path.join(output,'static-rebuild-cache.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
}finally{await stop();socket.close();}
