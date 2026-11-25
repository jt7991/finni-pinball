import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const [debug,base,output] = process.argv.slice(2);
const tabs = await (await fetch(`${debug}/json/list`)).json();
const socket = new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0; const pending=new Map();
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
await call('Page.enable');
const password = process.env.VOICE_STUDIO_TEST_PASSWORD;
assert(password, 'Set VOICE_STUDIO_TEST_PASSWORD to the test PocketBase studio password.');
await call('Page.navigate',{url:`${base}/voice-login`});
for (let i=0;i<100;i++) {
  if (await evaluate('!!document.getElementById("voice-login")')) break;
  await new Promise(resolve=>setTimeout(resolve,50));
}
await evaluate(`(() => {
  document.getElementById('name').value = 'Voice browser test';
  document.getElementById('password').value = ${JSON.stringify(password)};
  document.querySelector('#voice-login button').click();
})()`);
for (let i=0;i<100;i++) {
  if (await evaluate('location.pathname === "/voice"')) break;
  await new Promise(resolve=>setTimeout(resolve,50));
}
assert.equal(await evaluate('location.pathname'), '/voice', 'Sign-in opens the recording studio');
const difficultyGroups = await (await fetch(`${base}/voice-difficulty.json`)).json();
const expectedCallouts = difficultyGroups.flatMap(group => group.ids).length;
try {
  for(const [width,height,name] of [[1280,1400,'desktop'],[390,1800,'phone']]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:`${base}/voice`});
    for(let i=0;i<100;i++) {
      if(await evaluate(`document.querySelectorAll(".choose-callout").length === ${expectedCallouts}`))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(await evaluate('document.querySelectorAll(".choose-callout").length'),expectedCallouts);
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`${name} overflow`);
    const capture=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(`${output}/${name}.png`,Buffer.from(capture.data,'base64'));
  }
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.choose-callout')]
      .find(button => button.getAttribute('aria-label') === 'Select Ouch! to record');
    button.closest('details').querySelector('summary').click();
    button.click();
  })()`);
  assert.equal(await evaluate('document.getElementById("script").textContent'), 'Ouch!');
  const fixture = fileURLToPath(new URL('../assets/finni/audio/doorbell.wav', import.meta.url));
  const {root} = await call('DOM.getDocument');
  const {nodeId} = await call('DOM.querySelector',{nodeId:root.nodeId,selector:'#upload'});
  await call('DOM.setFileInputFiles',{nodeId,files:[fixture]});
  for(let i=0;i<200;i++) {
    if(await evaluate('!document.getElementById("download").disabled')) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(await evaluate('!document.getElementById("download").disabled'),true,'Upload and processing enable download');
  await evaluate(`(async()=>{
    const {PRESETS,processVoice}=await import('/voice-audio.js');
    const context=new OfflineAudioContext(1,32000,32000);
    const original=document.getElementById('original');
    const input=await context.decodeAudioData(await(await fetch(original.src)).arrayBuffer());
    for (const settings of Object.values(PRESETS)) {
      const result=await processVoice(input,{...settings,autoTrim:false});
      const decoded=await context.decodeAudioData(await result.processed.arrayBuffer());
      if(decoded.numberOfChannels!==2 || Math.abs(decoded.duration-input.duration)>.001 || decoded.sampleRate!==32000)throw Error('Format mismatch');
      if(!decoded.getChannelData(0).some(value=>Math.abs(value)>.01))throw Error('Silent render');
    }
  })()`);
  assert.equal(await evaluate(`(() => {
    const preset = document.getElementById('preset');
    preset.value = 'cartoon';
    preset.dispatchEvent(new Event('change'));
    return document.getElementById('download').disabled;
  })()`),true,'Changed settings invalidate stale export');
  for(let i=0;i<200;i++) {
    if(await evaluate('!document.getElementById("download").disabled')) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(await evaluate('document.getElementById("download").disabled'),false,'Changed treatment automatically updates export');
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
  console.log('Browser: the complete callout catalog, desktop/phone layouts, all preset audio renders, upload and simulated-microphone capture, and stale export protection pass.');
} finally {socket.close();}
