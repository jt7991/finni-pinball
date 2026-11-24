// Isolate atlas decoding and the first real-sized DMD draw. No game runs.
import fs from 'node:fs';import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(a=>a.startsWith('--output-name='))?.slice(14)??'dmd-decode-performance.json';assert.match(name,/^[a-z0-9.-]+\.json$/i);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:new URL('dmd-atlas.json',base).href});
 for(let i=0;i<100;i++){const result=await call('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(result.result.value==='complete')break;await new Promise(resolve=>setTimeout(resolve,50));}
 const result=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const metadata=await(await fetch('/three/dmd-atlas.json')).json(),blob=await(await fetch('/three/dmd-atlas.webp')).blob(),rows=[];
  for(let trial=0;trial<6;trial++)for(const mode of (trial%2?['bitmap-none','image-decoded','bitmap-default','image']:['image','bitmap-default','image-decoded','bitmap-none'])){
   const started=performance.now();let source,url;
   if(mode.startsWith('image')){url=URL.createObjectURL(blob);source=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});if(mode==='image-decoded')await source.decode();}
   else source=await createImageBitmap(blob,...(mode==='bitmap-none'?[{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'}]:[]));
   const decoded=performance.now(),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const context=canvas.getContext('2d');context.fillStyle='#100a04';context.clearRect(0,0,1024,256);context.fillRect(0,0,1024,256);context.imageSmoothingEnabled=false;
   const drawStart=performance.now(),paint=(name,x,y,w,h)=>context.drawImage(source,...metadata[name],x*4,y*4,w*4,h*4);
   paint('d_title_anim00',0,0,256,64);for(let i=0;i<40;i++)paint(i%3===0?'d_0':'d_empty',8+i%20*12,i<20?6:34,12,22);
   const drawEnd=performance.now(),pixels=context.getImageData(0,0,1024,256).data,readbackEnd=performance.now(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),n=>n.toString(16).padStart(2,'0')).join('');
   rows.push({trial,mode,decodeMilliseconds:decoded-started,drawMilliseconds:drawEnd-drawStart,readbackMilliseconds:readbackEnd-drawEnd,hashMilliseconds:performance.now()-readbackEnd,sha256});
   if(url){URL.revokeObjectURL(url);source.src='';}else source.close();canvas.width=0;await new Promise(resolve=>setTimeout(resolve,20));
  }
  const context=document.createElement('canvas').getContext('webgl2'),extension=context.getExtension('WEBGL_debug_renderer_info');return{rows,userAgent:navigator.userAgent,renderer:extension?context.getParameter(extension.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER)};
 })()`});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
 const observed=result.result.value;assert.equal(observed.rows.length,24);assert.equal(new Set(observed.rows.map(r=>r.sha256)).size,1,'All draw outputs remain identical');assert.deepEqual(errors,[]);
 const report={scope:'Independent image sources decoded from the same lossless WebP Blob. Six alternating trials, ordinary 1024x256 DMD background plus forty glyph draws. Canvas readback forces completion separately. No production game, source clock, physics or RNG. Desktop diagnostic only.',...observed,errors};fs.writeFileSync(output+'/'+name,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify(report));
}finally{socket.close();}
