// Compare the shared encoded source against the preceding direct-URL Image
// path and independent native ImageBitmap decode, then exercise the real old
// and new display APIs. The reference is the retained unmodified function from
// the preceding implementation, with its source commit and digest pinned.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),referenceFile=path.resolve('.work/three-review/dmd-display-original-reference.mjs');
const reference=JSON.parse(fs.readFileSync(new URL('../three/tests/fixtures/dmd-display-original.json',import.meta.url)));
assert.equal(reference.sourceCommit,'15a93815b30f7de8cbfd068190a128b2878fea4b');
assert.equal(reference.componentSHA256,'b4c2acdc3c54ba9a360720ef6834dbcfdff0fb0feb9a766fd7206cd39ddf0871');
assert.equal(createHash('sha256').update(reference.source).digest('hex'),reference.componentSHA256);
if(fs.existsSync(referenceFile))assert.equal(fs.readFileSync(referenceFile,'utf8'),reference.source);else fs.writeFileSync(referenceFile,reference.source);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await call('Page.navigate',{url:base});let ready=false;
 for(let i=0;i<400;i++){if(await evaluate('!!window.finniThree')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready);
 const result=await evaluate(`(async()=>{
  const {loadDmdAtlasBlob,loadDmdAtlasImage}=await import('/three/dmd-atlas.js'),actualMedia=await import('/three/media.js'),referenceMedia=await import(${JSON.stringify('/three/@fs/'+referenceFile.replaceAll('\\','/'))});
  const url='/three/dmd-atlas.png',blob=await loadDmdAtlasBlob(url),image=await loadDmdAtlasImage(url),originalImage=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url+'?direct-image-reference';});
  const options={imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'},bitmap=await createImageBitmap(blob,options),response=await fetch(url+'?direct-bitmap-reference');if(!response.ok)throw Error('Original atlas unavailable');const originalBitmap=await createImageBitmap(await response.blob(),options);
  const compareDecoded=(a,b)=>{
   if(a.width!==b.width||a.height!==b.height)throw Error('Atlas dimensions changed');
   const canvases=[a,b].map(()=>{const c=document.createElement('canvas');c.width=a.width;c.height=128;return c;}),contexts=canvases.map(c=>c.getContext('2d',{willReadFrequently:true}));let differences=0,channels=0;
   for(let y=0;y<a.height;y+=128){const height=Math.min(128,a.height-y);[a,b].forEach((source,i)=>{contexts[i].clearRect(0,0,a.width,128);contexts[i].drawImage(source,0,y,a.width,height,0,0,a.width,height);});const pixels=contexts.map(c=>c.getImageData(0,0,a.width,height).data);for(let i=0;i<pixels[0].length;i++){if(pixels[0][i]!==pixels[1][i])differences++;channels++;}}
   return{width:a.width,height:a.height,channels,differences};
  };
  const displayDecode=compareDecoded(image,originalImage),nativeDecode=compareDecoded(bitmap,originalBitmap);bitmap.close();originalBitmap.close();
  const atlas=await(await fetch('/three/dmd-atlas.json')).json(),names=Object.keys(atlas),objects=new Map(Array.from({length:41},(_,i)=>['digit'+String(i+1).padStart(3,'0'),{imagea:'d_empty'}]));
  const canvases=[0,1].map(()=>document.createElement('canvas')),displays=await Promise.all([actualMedia.createDisplay(canvases[0],objects,'/three/'),referenceMedia.createDisplay(canvases[1],objects,'/three/')]);
  const contexts=canvases.map(canvas=>canvas.getContext('2d',{willReadFrequently:true}));let frames=0,channels=0,differences=0;
  for(let start=0;start<names.length;start+=40){for(let i=0;i<40;i++)objects.get('digit'+String(i+1).padStart(3,'0')).imagea=names[start+i]??'d_empty';objects.get('digit041').imagea=names[(start*7)%names.length];displays.forEach(display=>display.draw());const pixels=contexts.map(context=>context.getImageData(0,0,1024,256).data);for(let i=0;i<pixels[0].length;i++){if(pixels[0][i]!==pixels[1][i])differences++;channels++;}frames++;}
  return{scope:'Original Image URL and independent raw ImageBitmap decoding versus shared unchanged encoded bytes. Real old/new display APIs use common controlled image names; production game state is untouched. Full atlas channels and every sprite name are checked.',displayDecode,nativeDecode,display:{sprites:names.length,frames,channels,differences}};
 })()`);
 const provenance={sourceCommit:reference.sourceCommit,sourceFileSHA256:reference.sourceFileSHA256,componentSHA256:reference.componentSHA256};
 fs.writeFileSync(output+'/shared-dmd-atlas-pixels.json',JSON.stringify({result,reference:provenance,errors},null,2));console.log(JSON.stringify({result,reference:provenance,errors}));
 assert.deepEqual(errors,[]);for(const row of [result.displayDecode,result.nativeDecode]){assert.equal(row.width,4096);assert.equal(row.height,4672);assert.equal(row.channels,4096*4672*4);assert.equal(row.differences,0);}
 assert.equal(result.display.sprites,1218);assert.equal(result.display.frames,31);assert.equal(result.display.differences,0);
}finally{socket.close();}
