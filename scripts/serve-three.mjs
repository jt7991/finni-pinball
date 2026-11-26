// Small local production server. No VPX initialization or table unpacking.
import http from 'node:http';
import {openSync,writeSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {sharedBrowserFiles} from './shared-browser-files.mjs';
import {createStaticAssetValidator} from './static-asset-validator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{host:{type:'string',default:'127.0.0.1'},port:{type:'string',default:'5174'},directory:{type:'string',default:'browser/three'},build:{type:'boolean',default:false},'static-audit-log':{type:'string'}}});
const directory=path.resolve(root,values.directory);
if(values.build){const {build}=await import('vite');await build({root:path.join(root,'three'),configFile:path.join(root,'vite.config.js'),build:{outDir:directory}});}
await stat(path.join(directory,'index.html'));
const staticAudit=values['static-audit-log']?openSync(values['static-audit-log'],'wx'):undefined;
const compressed=new Map();
const validateAsset=createStaticAssetValidator();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.vbs':'text/plain','.glsl':'text/plain','.wasm':'application/wasm','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain','.m4a':'audio/mp4','.flac':'audio/flac','.wav':'audio/wav','.ttf':'font/ttf'};
mime['.mp3']='audio/mpeg';
const api={'/api/leaderboard':'/api/finni/leaderboard','/api/runs':'/api/finni/runs','/api/scores':'/api/finni/scores'};
const voice=sharedBrowserFiles(root);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(url.pathname.startsWith('/api/voice-ai/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'ElevenLabs is available locally when the native server is started with --voice-ai.'}));return;}
      if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      const allowed=api[url.pathname]||url.pathname==='/api/voice-login'||/^\/api\/(?:collections\/(?:voice_team\/auth-with-password|voice_takes\/records)|files\/)/.test(url.pathname);
      if(!allowed){res.writeHead(404);res.end();return;}
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>(api[url.pathname]?4096:8500000)){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const response=await fetch(`${process.env.POCKETBASE_URL||'http://127.0.0.1:8090'}${api[url.pathname]||url.pathname}${url.search}`,{
        method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json','X-Real-IP':req.socket.remoteAddress,...req.headers.authorization?{Authorization:req.headers.authorization}:{}},
        body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(10000),
      });
      res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json',...response.headers.has('cache-control')?{'Cache-Control':response.headers.get('cache-control')}:{},...response.headers.has('content-disposition')?{'Content-Disposition':response.headers.get('content-disposition')}:{}});res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(url.pathname==='/'){res.writeHead(302,{Location:'/three/'});res.end();return;}
    if(url.pathname==='/vpx'){res.writeHead(302,{Location:`http://${req.headers.host.split(':')[0]}:8765/`});res.end();return;}
    if(!['GET','HEAD'].includes(req.method)||!voice.has(url.pathname)&&!url.pathname.startsWith('/three/')){res.writeHead(404);res.end();return;}
    const relative=decodeURIComponent(url.pathname.slice('/three/'.length));
    const file=voice.get(url.pathname)??path.resolve(directory,relative||'index.html');
    if(!voice.has(url.pathname)&&!file.startsWith(directory+path.sep)){res.writeHead(404);res.end();return;}
    let info=await stat(file,{bigint:true});if(!info.isFile()){res.writeHead(404);res.end();return;}
    const {etag,body}=await validateAsset(file,info);
    const ext=path.extname(file),headers={'Content-Type':mime[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache',Vary:'Accept-Encoding',ETag:etag};
    if(staticAudit!==undefined){
      const started=Date.now();
      res.once('finish',()=>writeSync(staticAudit,JSON.stringify({started,finished:Date.now(),url:req.url,method:req.method,status:res.statusCode,ifNoneMatch:req.headers['if-none-match'],etag})+'\n'));
    }
    // RFC 9110 section 13.1.2 uses weak comparison for GET/HEAD validation.
    const condition=req.headers['if-none-match'];
    const matches=condition&&(condition.trim()==='*'||condition.split(',').some(value=>value.trim().replace(/^W\//,'')===etag.slice(2)));
    if(matches){
      res.writeHead(304,headers);res.end();return;
    }
    if(/gzip/.test(req.headers['accept-encoding']||'')&&['.js','.css','.json','.vbs','.glsl','.glb','.wasm','.html','.bin','.ttf','.svg','.wav'].includes(ext)&&body.length<32*1024*1024){
      const previous=compressed.get(file);let data=previous?.etag===etag?previous.data:null;
      if(!data){data=gzipSync(body);compressed.set(file,{data,etag});}
      res.writeHead(200,{...headers,'Content-Encoding':'gzip','Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }else{
      res.writeHead(200,{...headers,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
    }
  }catch(error){if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:503,{'Content-Type':'text/plain'});res.end('Unavailable.');}
});
server.listen(Number(values.port),values.host,()=>console.log(`Finni Three.js: http://${values.host}:${server.address().port}/three/`));
