import path from 'node:path';
import {readFile} from 'node:fs/promises';

// Main's standalone pages use absolute resources at the same origin as the
// game. Both Three.js servers serve these exact shared files without VPX.
export function sharedBrowserFiles(root){
  const names=['arcade.css','arcade-background.svg','how-to-play.html','how-to-play.css','high-scores.html','high-scores.css','high-scores.js','voice.html','voice.css','voice.js','voice-audio.js','voice-lines.json','voice-session.js','voice-login.html','voice-login.js','recordings.js','voice-difficulty.json','voice-pitch-worker.js','vendor/voice-pitch.js','vendor/voice-pitch-LICENSES.txt','favicon.ico','favicon.png','fonts/PressStart2P-Regular.ttf','fonts/DMSans.ttf'];
  const files=new Map(names.map(name=>['/'+name,path.join(root,'browser',name)]));
  for(const name of ['manifest.json','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'])files.set('/'+name,path.join(root,'browser',name));
  for(const [route,name]of Object.entries({'/how-to-play':'how-to-play.html','/high-scores':'high-scores.html','/voice':'voice.html','/recordings':'voice.html','/voice-login':'voice-login.html'}))files.set(route,path.join(root,'browser',name));
  files.set('/chewy.ttf',path.join(root,'assets/fonts/chewy/Chewy-Regular.ttf'));
  return files;
}

export function sharedBrowserMiddleware(root){
  const files=sharedBrowserFiles(root),types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.txt':'text/plain'};
  return async(req,res,next)=>{
    const file=files.get(new URL(req.url,'http://localhost').pathname);if(!file)return next();
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}
    catch(error){next(error);}
  };
}
