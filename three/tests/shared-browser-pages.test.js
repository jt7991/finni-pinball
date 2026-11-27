import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {sharedBrowserMiddleware} from '../../scripts/shared-browser-files.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return'http://127.0.0.1:'+server.address().port;};
const close=server=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));

async function verifyPages(base){
  for(const name of ['manifest.json','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png']){
    const response=await fetch(base+'/'+name);assert.equal(response.status,200,name);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(root,'browser',name)));
  }
  for(const [route,file]of [['/how-to-play','how-to-play.html'],['/arcade.css','arcade.css'],['/arcade-background.svg','arcade-background.svg'],['/voice','voice.html'],['/voice-login','voice-login.html'],['/voice-session.js','voice-session.js'],['/recordings.js','recordings.js'],['/voice-difficulty.json','voice-difficulty.json']]){
    const response=await fetch(base+route);assert.equal(response.status,200,route);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(root,'browser',file)),route+' serves the exact main resource');
  }
  const head=await fetch(base+'/how-to-play',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-type'),'text/html');
  assert.equal((await fetch(base+'/voice-cast.json')).status,404,'removed catalog does not retain an obsolete route');
  const native=fs.readFileSync(path.join(root,'browser/index.html'),'utf8'),port=fs.readFileSync(path.join(root,'three/index.html'),'utf8');
  for(const pattern of [/<div class="start-links">[\s\S]*?<\/div>/,/<p><a href="\/how-to-play" target="_blank"[\s\S]*?<\/p>/])assert.equal(port.match(pattern)?.[0],native.match(pattern)?.[0],'main guide/studio links remain shared');
  const gamepad=/<details><summary>Gamepad controls<\/summary>[\s\S]*?<\/details>/;
  assert.equal(port.match(gamepad)?.[0],native.match(gamepad)?.[0],'controller instructions remain shared');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'three/public/manifest.json')));
  assert.equal(manifest.id,'/three/');assert.equal(manifest.start_url,'/three/');assert.equal(manifest.scope,'/three/');
}

test('development serves main guide and voice modules locally without a native player proxy',async()=>{
  const middleware=sharedBrowserMiddleware(root),server=http.createServer((req,res)=>middleware(req,res,error=>{res.writeHead(error?500:404);res.end();}));
  const base=await listen(server);try{await verifyPages(base);}finally{await close(server);}
});

test('production serves main pages and proxies only the exact new voice login endpoint',async()=>{
  const requests=[],backend=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);requests.push({method:req.method,url:req.url,body:Buffer.concat(chunks).toString('utf8')});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true}));});
  const backendURL=await listen(backend),work=path.join(root,'.work'),directory=fs.mkdtempSync(path.join(work,'shared-pages-test-'));fs.writeFileSync(path.join(directory,'index.html'),'<!doctype html><title>Shared pages</title>');
  const child=spawn(process.execPath,['scripts/serve-three.mjs','--host','127.0.0.1','--port','0','--directory',directory],{cwd:root,env:{...process.env,POCKETBASE_URL:backendURL},stdio:['ignore','pipe','pipe']});
  const ready=Promise.withResolvers();let stdout='',stderr='';child.stdout.on('data',bytes=>{stdout+=bytes;const match=/Finni Three\.js: (http:\/\/127\.0\.0\.1:\d+)\/three\//.exec(stdout);if(match)ready.resolve(match[1]);});child.stderr.on('data',bytes=>stderr+=bytes);child.once('error',ready.reject);child.once('exit',()=>ready.reject(Error('Shared server exited: '+stderr)));const timeout=setTimeout(()=>ready.reject(Error('Shared server startup timed out: '+stderr)),15000);
  try{
    const base=await ready.promise;clearTimeout(timeout);await verifyPages(base);
    const body=JSON.stringify({name:'Local route test',password:'fixture-only-password'}),response=await fetch(base+'/api/voice-login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{ok:true});assert.deepEqual(requests,[{method:'POST',url:'/api/voice-login',body}]);
    assert.equal((await fetch(base+'/api/voice-login-extra',{method:'POST',body})).status,404);assert.equal(requests.length,1,'an adjacent path does not reach the backend');
  }finally{
    clearTimeout(timeout);if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill();await ended;}await close(backend);
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(work));assert.ok(path.basename(directory).startsWith('shared-pages-test-'));fs.rmSync(directory,{recursive:true,force:true});
  }
});
