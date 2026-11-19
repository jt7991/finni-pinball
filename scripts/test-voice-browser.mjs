import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output] = process.argv.slice(2);
const tabs = await (await fetch(`${debug}/json/list`)).json();
const socket = new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0; const pending=new Map();
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
await call('Page.enable');
try {
  for(const [width,height,name] of [[1280,1400,'desktop'],[390,1800,'phone']]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:`${base}/voice`});
    for(let i=0;i<100;i++) {
      if(await evaluate('document.querySelectorAll("#line option").length === 235'))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(await evaluate('document.querySelectorAll("#line option").length'),235);
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`${name} overflow`);
    const capture=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(`${output}/${name}.png`,Buffer.from(capture.data,'base64'));
  }
  const audio=await evaluate(`(async()=>{
    const {PRESETS,processVoice,wav}=await import('/voice-audio.js');
    const context=new OfflineAudioContext(1,32000,32000),buffer=context.createBuffer(1,32000,32000);
    const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=.1*Math.sin(2*Math.PI*440*i/32000);
    for(const settings of Object.values(PRESETS)) {
      const result=await processVoice(buffer,settings);
      const decoded=await context.decodeAudioData(await result.processed.arrayBuffer());
      if(decoded.numberOfChannels!==2 || Math.abs(decoded.duration-1)>.001 || decoded.sampleRate!==32000)throw Error('Format mismatch');
      if(!decoded.getChannelData(0).some(value=>Math.abs(value)>.01))throw Error('Silent render');
    }
    const upload=document.getElementById('upload'),transfer=new DataTransfer();
    transfer.items.add(new File([wav(buffer)],'test.wav',{type:'audio/wav'}));upload.files=transfer.files;upload.dispatchEvent(new Event('change'));
    return true;
  })()`);
  assert.equal(audio,true);
  for(let i=0;i<200;i++) {
    if(await evaluate('!document.getElementById("download").disabled')) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(await evaluate('!document.getElementById("download").disabled'),true,'Upload and processing enable download');
  assert.equal(await evaluate('document.getElementById("submit").disabled'),true,'Submission requires sign-in');
  await evaluate('document.getElementById("pitch").value=4;document.getElementById("pitch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.getElementById("download").disabled'),true,'Changed settings invalidate stale export');
  await evaluate('document.getElementById("record").click()');
  for(let i=0;i<100;i++) {
    if(await evaluate('document.getElementById("record").textContent === "Stop recording"')) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(await evaluate('document.getElementById("record").textContent'), 'Stop recording');
  await new Promise(resolve=>setTimeout(resolve,800));
  await evaluate('document.getElementById("record").click()');
  for(let i=0;i<200;i++) {
    if(await evaluate('!document.getElementById("download").disabled')) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(await evaluate('!document.getElementById("download").disabled'),true,'Microphone take processes');
  console.log('Browser: 234 lines, desktop/phone layouts, all three audio renders, upload and simulated-microphone capture, and stale export protection pass.');
} finally {socket.close();}
