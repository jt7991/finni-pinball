// Small local production server. No VPX initialization or table unpacking.
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{host:{type:'string',default:'127.0.0.1'},port:{type:'string',default:'5174'},build:{type:'boolean',default:false}}});
if(values.build){const {build}=await import('vite');await build({root:path.join(root,'three'),configFile:path.join(root,'vite.config.js')});}
const directory=path.join(root,'browser/three');
await stat(path.join(directory,'index.html'));
const compressed=new Map();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.vbs':'text/plain','.wasm':'application/wasm','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.m4a':'audio/mp4','.ttf':'font/ttf'};
const api={'/api/leaderboard':'/api/finni/leaderboard','/api/runs':'/api/finni/runs','/api/scores':'/api/finni/scores'};
const voice=new Map(['/voice','/voice.html','/voice.css','/voice.js','/voice-audio.js','/voice-lines.json'].map(route=>[route,path.join(root,'browser',route==='/voice'?'voice.html':route.slice(1))]));
voice.set('/chewy.ttf',path.join(root,'assets/fonts/chewy/Chewy-Regular.ttf'));
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
      if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      const allowed=api[url.pathname]||/^\/api\/(?:collections\/(?:voice_team\/auth-with-password|voice_takes\/records)|files\/)/.test(url.pathname);
      if(!allowed){res.writeHead(404);res.end();return;}
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>(api[url.pathname]?4096:8500000)){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const response=await fetch(`${process.env.POCKETBASE_URL||'http://127.0.0.1:8090'}${api[url.pathname]||url.pathname}${url.search}`,{
        method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json','X-Real-IP':req.socket.remoteAddress,...req.headers.authorization?{Authorization:req.headers.authorization}:{}},
        body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(10000),
      });
      res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(url.pathname==='/'){res.writeHead(302,{Location:'/three/'});res.end();return;}
    if(url.pathname==='/vpx'){res.writeHead(302,{Location:`http://${req.headers.host.split(':')[0]}:8765/`});res.end();return;}
    if(!['GET','HEAD'].includes(req.method)||!voice.has(url.pathname)&&!url.pathname.startsWith('/three/')){res.writeHead(404);res.end();return;}
    const relative=decodeURIComponent(url.pathname.slice('/three/'.length));
    const file=voice.get(url.pathname)??path.resolve(directory,relative||'index.html');
    if(!voice.has(url.pathname)&&!file.startsWith(directory+path.sep)){res.writeHead(404);res.end();return;}
    const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
    const ext=path.extname(file),headers={'Content-Type':mime[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache',Vary:'Accept-Encoding'};
    if(/gzip/.test(req.headers['accept-encoding']||'')&&['.js','.css','.json','.vbs','.glb','.wasm','.html'].includes(ext)&&info.size<8*1024*1024){
      const previous=compressed.get(file);let data=previous?.mtime===info.mtimeMs?previous.data:null;
      if(!data){data=gzipSync(await readFile(file));compressed.set(file,{data,mtime:info.mtimeMs});}
      res.writeHead(200,{...headers,'Content-Encoding':'gzip','Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }else{
      res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
    }
  }catch(error){if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:503,{'Content-Type':'text/plain'});res.end('Unavailable.');}
});
server.listen(Number(values.port),values.host,()=>console.log(`Finni Three.js: http://${values.host}:${values.port}/three/`));
