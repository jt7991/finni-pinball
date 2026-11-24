// Production routing, shared name-entry markup and high-score page states.
// Only the leaderboard GET response is stubbed; no real scores are submitted.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),origin=new URL(base).origin;
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[],results=[];
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
  if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<300;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+expression);};
try{
  for(const route of ['/high-scores','/high-scores.html','/high-scores.js','/high-scores.css','/fonts/PressStart2P-Regular.ttf','/fonts/DMSans.ttf']){
    const response=await fetch(origin+route);assert.equal(response.status,200,route);assert.ok((await response.arrayBuffer()).byteLength>0,route);
  }
  await call('Page.enable');await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const nativeFetch=window.fetch;
    window.scoreResponse={items:[{initials:'PLAYER123456',score:1234567},{initials:'FINNI',score:25000}]};
    window.fetch=(url,...args)=>new URL(url,location.href).pathname==='/api/leaderboard'
      ?Promise.resolve(new Response(JSON.stringify(window.scoreResponse),{status:window.scoreFailure?503:200,headers:{'Content-Type':'application/json'}}))
      :nativeFetch(url,...args);
  })()`});
  for(const [name,width,height] of [['phone',390,844],['desktop',1280,900]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='phone'});
    await call('Page.navigate',{url:origin+'/high-scores'});
    await wait('document.querySelectorAll("#scores-rows tr").length===2');await evaluate('document.fonts.ready');
    assert.equal(await evaluate('document.getElementById("record-name").textContent'),'PLAYER123456');
    assert.equal(await evaluate('document.getElementById("record-score").textContent'),(1234567).toLocaleString());
    assert.equal(await evaluate('document.fonts.check("12px Pixel")&&document.fonts.check("16px \'DM Sans\'")'),true);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,name+' no horizontal overflow');
    assert.equal(await evaluate('new URL(document.querySelector("nav a").href).pathname'),'/');
    await evaluate('window.scoreResponse={items:[]};document.getElementById("refresh-scores").click()');
    await wait('document.getElementById("scores-status").textContent.startsWith("No scores yet")');
    assert.equal(await evaluate('document.getElementById("scores-table").hidden'),true);
    await evaluate('window.scoreFailure=true;document.getElementById("refresh-scores").click()');
    await wait('document.getElementById("scores-status").textContent.startsWith("Could not refresh")');
    assert.equal(await evaluate('document.getElementById("refresh-scores").disabled'),false);
    results.push({viewport:name,rankings:true,empty:true,unavailable:true});
  }
  await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
  assert.equal(await evaluate('document.getElementById("initials").maxLength'),12);
  assert.equal(await evaluate('document.getElementById("initials").pattern'),'[A-Za-z0-9]{1,12}');
  assert.equal(await evaluate('document.querySelector("#leaderboard-panel a").pathname'),'/high-scores');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/high-scores-production.json',JSON.stringify({base,results,errors,scope:'Real production routes, fonts, phone/desktop score-page success, empty and unavailable states, and shared 12-character name-entry markup. Leaderboard GET uses test responses; no live scores written.'},null,2));
  console.log('PASS production high-score routes, fonts, phone/desktop states and shared name entry');
}finally{socket.close();}
