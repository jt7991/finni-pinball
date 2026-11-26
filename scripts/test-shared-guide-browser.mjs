import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),origin=new URL(base).origin;
const mainHTML=await readFile(new URL('../browser/how-to-play.html',import.meta.url),'utf8'),headings=[...mainHTML.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(m=>m[1].trim());assert.ok(headings.length);
const guideLink='document.querySelector('+JSON.stringify('#waiting .start-links a[href="/how-to-play"]')+')';
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[],badResponses=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);if(d.method==='Network.responseReceived'&&d.params.response.status>=400)badResponses.push({url:d.params.response.url,status:d.params.response.status});});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Guide wait '+expression);};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Page.navigate',{url:origin+'/three/'});await wait('document.getElementById("play")?.textContent==="Start game"');
  assert.equal(await evaluate(guideLink+'?.textContent'),'How to play');
  await evaluate(guideLink+'.click()');await wait('!!document.querySelector("main.guide")');
  const viewports=[];
  for(const [width,height,name]of [[1280,900,'desktop'],[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<650});await evaluate('document.fonts.ready');
    const state=await evaluate('({title:document.title,headings:[...document.querySelectorAll("main h2")].map(n=>n.textContent.trim()),overflow:document.documentElement.scrollWidth>innerWidth,back:document.querySelector(".guide-header a")?.getAttribute("href")})');
    assert.equal(state.overflow,false,name+' horizontal overflow');assert.equal(state.back,'/');assert.deepEqual(state.headings,headings);
    const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(output+'/main-guide-'+name+'.png',Buffer.from(shot.data,'base64'));viewports.push({width,height,name,...state});
  }
  await evaluate('document.querySelector(".guide-header a").click()');await wait('document.getElementById("play")?.textContent==="Start game"');
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  await writeFile(output+'/shared-guide-browser.json',JSON.stringify({base:origin,viewports,returnedToGame:true,errors,badResponses},null,2));console.log(JSON.stringify({viewports:viewports.map(v=>v.name),returnedToGame:true,errors,badResponses}));
}finally{socket.close();}
