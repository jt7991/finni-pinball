import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {spawn} from 'node:child_process';import {once} from 'node:events';import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),work=path.join(root,'.work');
async function withServer(run,{audit=false}={}){
 const directory=fs.mkdtempSync(path.join(work,'static-cache-test-'));
 fs.writeFileSync(path.join(directory,'index.html'),'<!doctype html><title>Cache probe</title>');
 const file=path.join(directory,'geometry.bin'),original=Buffer.from('native geometry A\n'.repeat(1024));fs.writeFileSync(file,original);fs.utimesSync(file,1700000000,1700000000);
 const auditFile=path.join(directory,'responses.ndjson');
 const child=spawn(process.execPath,['scripts/serve-three.mjs','--directory',directory,'--host','127.0.0.1','--port','0',...audit?['--static-audit-log',auditFile]:[]],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';const ready=Promise.withResolvers();
 child.stdout.on('data',data=>{stdout+=data;const match=/Finni Three\.js: (http:\/\/127\.0\.0\.1:\d+\/three\/)/.exec(stdout);if(match)ready.resolve(match[1]);});
 child.stderr.on('data',data=>{stderr+=data;});child.once('error',ready.reject);child.once('exit',code=>ready.reject(Error('Static server exited '+code+': '+stderr)));
 const timeout=setTimeout(()=>ready.reject(Error('Static server startup timed out: '+stderr)),15000);
 try{const base=await ready.promise;clearTimeout(timeout);await run({base,directory,file,original,auditFile});}
 finally{
  clearTimeout(timeout);
  if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill();await exit;}
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(work),'Cleanup stays in the worktree test directory');
  assert.ok(path.basename(directory).startsWith('static-cache-test-'));fs.rmSync(directory,{recursive:true,force:true});
 }
}
const request=(base,file='',{method='GET',headers={}}={})=>new Promise((resolve,reject)=>{
 const req=http.request(new URL(file,base),{method,headers,agent:false},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));response.on('error',reject);});req.on('error',reject);req.end();
});
// Receiving Content-Length bytes can precede the server read stream's close.
// Windows briefly forbids replacing/removing that still-open file. Wait only
// for that OS lock; all response/body/validator assertions remain unchanged.
async function afterFileRelease(operation){
 const deadline=Date.now()+2000;
 for(;;)try{return operation();}catch(error){if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||Date.now()>=deadline)throw error;await new Promise(r=>setTimeout(r,10));}
}

test('production assets validate GET and HEAD without resending unchanged bodies',async()=>{
 await withServer(async({base,original,auditFile})=>{
  const first=await request(base,'geometry.bin');assert.equal(first.status,200);assert.deepEqual(first.body,original);const etag=first.headers.etag;assert.match(etag,/^W\/"[A-Za-z0-9_-]+"$/);
  assert.equal(first.headers['cache-control'],'no-cache');assert.equal(first.headers.vary,'Accept-Encoding');
  for(const condition of [etag,etag.slice(2),'"unrelated", '+etag,'*'])for(const method of ['GET','HEAD']){
   const response=await request(base,'geometry.bin',{method,headers:{'If-None-Match':condition}});assert.equal(response.status,304);assert.equal(response.body.length,0);assert.equal(response.headers.etag,etag);assert.equal(response.headers['cache-control'],'no-cache');assert.equal(response.headers.vary,'Accept-Encoding');
  }
  const head=await request(base,'geometry.bin',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),original.length);assert.equal(head.headers.etag,etag);
  const miss=await request(base,'geometry.bin',{headers:{'If-None-Match':'"unrelated"'}});assert.equal(miss.status,200);assert.deepEqual(miss.body,original);
  const index=await request(base),cachedIndex=await request(base,'',{headers:{'If-None-Match':index.headers.etag}});assert.equal(index.status,200);assert.equal(cachedIndex.status,304);assert.equal(cachedIndex.body.length,0);
  const records=fs.readFileSync(auditFile,'utf8').trim().split('\n').map(JSON.parse),record=records.find(row=>row.url==='/three/geometry.bin'&&row.method==='GET'&&row.ifNoneMatch===etag);
  assert.equal(record.status,304);assert.equal(record.etag,etag,'Server audit and actual HTTP headers agree');
 },{audit:true});
});

test('gzip and identity responses stay fresh after same-size writes with preserved mtime',async()=>{
 await withServer(async({base,file,original})=>{
  const first=await request(base,'geometry.bin',{headers:{'Accept-Encoding':'gzip'}});assert.equal(first.status,200);assert.equal(first.headers['content-encoding'],'gzip');assert.deepEqual(gunzipSync(first.body),original);
  const old=fs.statSync(file,{bigint:true}),updated=Buffer.from(original.toString().replaceAll('geometry A','geometry B'));assert.equal(updated.length,original.length);
  fs.writeFileSync(file,updated);fs.utimesSync(file,1700000000,1700000000);assert.equal(fs.statSync(file,{bigint:true}).mtimeNs,old.mtimeNs);
  const fresh=await request(base,'geometry.bin',{headers:{'Accept-Encoding':'gzip','If-None-Match':first.headers.etag}});assert.equal(fresh.status,200);assert.notEqual(fresh.headers.etag,first.headers.etag);assert.deepEqual(gunzipSync(fresh.body),updated,'Stored gzip must follow the changed file');
  const identity=await request(base,'geometry.bin');assert.deepEqual(identity.body,updated);assert.equal(identity.headers['content-encoding'],undefined);assert.equal(identity.headers.etag,fresh.headers.etag);
  const validated=await request(base,'geometry.bin',{headers:{'Accept-Encoding':'gzip','If-None-Match':identity.headers.etag}});assert.equal(validated.status,304);assert.equal(validated.body.length,0);
  const head=await request(base,'geometry.bin',{method:'HEAD',headers:{'Accept-Encoding':'gzip'}});assert.equal(head.status,200);assert.equal(Number(head.headers['content-length']),fresh.body.length);assert.equal(head.body.length,0);
 });
});

test('replaced, removed and unsupported static requests cannot reuse an obsolete validator',async()=>{
 await withServer(async({base,directory,file,original})=>{
  const first=await request(base,'geometry.bin');
  const replacement=path.join(directory,'replacement.bin'),updated=Buffer.from(original.toString().replaceAll('geometry A','geometry C'));fs.writeFileSync(replacement,updated);fs.utimesSync(replacement,1700000000,1700000000);await afterFileRelease(()=>fs.renameSync(replacement,file));
  const fresh=await request(base,'geometry.bin',{headers:{'If-None-Match':first.headers.etag}});assert.equal(fresh.status,200);assert.notEqual(fresh.headers.etag,first.headers.etag);assert.deepEqual(fresh.body,updated);
  const post=await request(base,'geometry.bin',{method:'POST',headers:{'If-None-Match':'*'}});assert.equal(post.status,404);
  await afterFileRelease(()=>fs.unlinkSync(file));const missing=await request(base,'geometry.bin',{headers:{'If-None-Match':'*'}});assert.equal(missing.status,404);
  const absent=await request(base,'missing.bin',{headers:{'If-None-Match':first.headers.etag}});assert.equal(absent.status,404);
 });
});

test('identical rebuilt assets keep their validator across independent server directories',async()=>{
 await withServer(async first=>{
  const original=await request(first.base,'geometry.bin',{headers:{'Accept-Encoding':'gzip'}});
  await withServer(async second=>{
   assert.notEqual(fs.statSync(first.file,{bigint:true}).ino,fs.statSync(second.file,{bigint:true}).ino);
   for(const method of ['GET','HEAD']){
    const reused=await request(second.base,'geometry.bin',{method,headers:{'If-None-Match':original.headers.etag,'Accept-Encoding':'gzip'}});
    assert.equal(reused.status,304);assert.equal(reused.body.length,0);assert.equal(reused.headers.etag,original.headers.etag);
   }
   const changed=Buffer.from(second.original.toString().replaceAll('geometry A','geometry D'));fs.writeFileSync(second.file,changed);fs.utimesSync(second.file,1700000000,1700000000);
   const fresh=await request(second.base,'geometry.bin',{headers:{'If-None-Match':original.headers.etag}});assert.equal(fresh.status,200);assert.deepEqual(fresh.body,changed);assert.notEqual(fresh.headers.etag,original.headers.etag);
   const unchanged=await request(first.base,'geometry.bin',{headers:{'If-None-Match':original.headers.etag}});assert.equal(unchanged.status,304);
  });
 });
});

test('identical replacements and timestamp changes do not force the same body to download again',async()=>{
 await withServer(async({base,directory,file,original})=>{
  const initial=await request(base,'geometry.bin'),replacement=path.join(directory,'same.bin');fs.writeFileSync(replacement,original);await afterFileRelease(()=>fs.renameSync(replacement,file));
  const replaced=await request(base,'geometry.bin',{headers:{'If-None-Match':initial.headers.etag}});assert.equal(replaced.status,304);assert.equal(replaced.body.length,0);
  fs.utimesSync(file,1800000000,1800000000);
  const touched=await request(base,'geometry.bin',{headers:{'If-None-Match':initial.headers.etag,'Accept-Encoding':'gzip'}});assert.equal(touched.status,304);assert.equal(touched.body.length,0);
 });
});

test('previous stat-based validators refetch current bytes before migrating to content validation',async()=>{
 await withServer(async({base,file,original})=>{
  const info=fs.statSync(file,{bigint:true}),version=[info.dev,info.ino,info.size,info.mtimeNs,info.ctimeNs].join(':'),legacy='W/"'+createHash('sha256').update(version).digest('base64url')+'"';
  // The stamp alone cannot prove what bytes the browser has cached. Refresh
  // that representation once rather than accepting a possibly colliding tag.
  const migrated=await request(base,'geometry.bin',{headers:{'If-None-Match':legacy}});assert.equal(migrated.status,200);assert.deepEqual(migrated.body,original);assert.notEqual(migrated.headers.etag,legacy);
  const changed=Buffer.from(original.toString().replaceAll('geometry A','geometry E'));fs.writeFileSync(file,changed);fs.utimesSync(file,1700000000,1700000000);
  const fresh=await request(base,'geometry.bin',{headers:{'If-None-Match':legacy}});assert.equal(fresh.status,200);assert.deepEqual(fresh.body,changed);assert.notEqual(fresh.headers.etag,migrated.headers.etag);
 });
});

test('concurrent static responses keep their exact body and content tag through replacements',async()=>{
 await withServer(async({base,directory,file,original})=>{
  const variants=[original,...['B','C'].map(letter=>Buffer.from(original.toString().replaceAll('geometry A','geometry '+letter)))];
  const responses=Promise.all(Array.from({length:32},(_,i)=>request(base,'geometry.bin',{headers:{'Accept-Encoding':i%2?'gzip':'identity'}})));
  for(let i=0;i<16;i++){
   await new Promise(resolve=>setImmediate(resolve));
   const replacement=path.join(directory,'replacement-'+i+'.bin');fs.writeFileSync(replacement,variants[1+i%2]);fs.utimesSync(replacement,1700000000,1700000000);await afterFileRelease(()=>fs.renameSync(replacement,file));
  }
  for(const response of await responses){
   assert.equal(response.status,200);const body=response.headers['content-encoding']==='gzip'?gunzipSync(response.body):response.body;
   assert.ok(variants.some(bytes=>bytes.equals(body)),'Serve one complete immutable file generation');
   assert.equal(response.headers.etag,'W/"'+createHash('sha256').update(body).digest('base64url')+'"','The header describes the actual selected response body');
  }
 });
});
