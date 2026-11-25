// Complete source-rate PCM comparison in an actual browser Worker. Full PCM
// storage here is for the SHA audit only, not the codec's streaming buffer.
import fs from 'node:fs';import assert from 'node:assert/strict';
const[debug,base,output]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync('three/tests/fixtures/vpx-main-vorbis-native.json'));
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(!d.id)return;const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});
 const code=`import{createNativeVorbisCodec}from${JSON.stringify(new URL('native-vorbis.js',base).href)};
 const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 try{const base=${JSON.stringify(base)},fixture=${JSON.stringify(fixture)},wasm=await(await fetch(new URL('native-audio/vorbis.wasm',base))).arrayBuffer(),codec=await createNativeVorbisCodec(wasm),rows=[];
 for(const clip of fixture.clips){const source=await(await fetch(new URL('native-audio/music/'+clip.file,base))).arrayBuffer();if(await sha(source)!==clip.sourceSHA256)throw Error('Original music source changed');const format=codec.open(new Uint8Array(source));
 for(let pass=0;pass<2;pass++){if(pass)codec.seek(0);const data=new Uint8Array((clip.sourceGranuleFrames+8192)*clip.channels*4);let frames=0,index=0;for(;;){const block=codec.read([127,8192,511,4096][index++%4]);data.set(new Uint8Array(block.pcm.buffer),frames*clip.channels*4);frames+=block.frames;if(block.eof)break;}rows.push({name:clip.name,pass,format,frames,pcmSHA256:await sha(data.subarray(0,frames*clip.channels*4)),memoryBytes:codec.memoryBytes});}codec.close();}
 codec.close();postMessage({rows,scope:'Original compiled codec in a browser Worker. Full sample hashes at authored rates, varying chunks and rewind. Audit-only full-PCM buffers are outside the codec; no destination resampling, live music timing or physical-phone claim.'});}catch(error){postMessage({error:String(error),stack:error.stack});}`;
 const result=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([${JSON.stringify(code)}],{type:'text/javascript'})),worker=new Worker(url,{type:'module'});worker.onmessage=({data})=>{worker.terminate();URL.revokeObjectURL(url);resolve(data);};worker.onerror=e=>{worker.terminate();URL.revokeObjectURL(url);reject(Error(e.message));};})`});
 assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));const data=result.result.value;fs.writeFileSync(output+'/native-vorbis-browser.json',JSON.stringify({base,...data},null,2),{flag:'wx'});assert.equal(data.error,undefined);assert.equal(data.rows.length,fixture.clips.length*2);
 for(const row of data.rows){const clip=fixture.clips.find(c=>c.name===row.name);assert.deepEqual(row.format,{channels:clip.channels,sampleRate:clip.sampleRate,granuleFrames:clip.sourceGranuleFrames});assert.equal(row.frames,clip.frames,clip.name);assert.equal(row.pcmSHA256,clip.pcmSHA256,clip.name);assert.ok(row.memoryBytes<=64*1024*1024);}
 console.log(JSON.stringify({nativeTracks:fixture.clips.length,completeWorkerDecodes:data.rows.length,allPCMBitsExact:true,peakCodecMemoryBytes:Math.max(...data.rows.map(r=>r.memoryBytes))}));
}finally{socket.close();}
