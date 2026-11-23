import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'native-startup-r1.json';assert.match(name,/^[a-z0-9.-]+\.json$/i);
const file=output+'/'+name;assert.equal(fs.existsSync(file),false,'Preserve existing native captures');
const throughMilliseconds=Number(process.argv.find(arg=>arg.startsWith('--through-ms='))?.slice(13)??1);assert.ok(Number.isInteger(throughMilliseconds)&&throughMilliseconds>=1&&throughMilliseconds<=2000);
const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate('document.body.classList.contains("engine-error")'))throw Error('Native engine failed: '+await evaluate('document.getElementById("log").textContent.slice(-1000)'));if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeStartupObserver.toString()+')('+throughMilliseconds+');'});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');
 await wait('document.body.classList.contains("ball-in-plunger")');
 await wait('nativeStartup.done');
 const observed=await evaluate('(()=>{const {read,...data}=nativeStartup;return {...data,live:read()};})()');
 const actualEngine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());
 const result={reference,engineSHA256:createHash('sha256').update(actualEngine).digest('hex'),observed,errors,scope:'Original native clock imports pass through unchanged; read-only initial Player, physics clocks, RNG and live Ball memory snapshots at GameTime0 and first positive time. This diagnostic does not yet reconstruct native script-clock inputs or establish complete startup parity.'};
 fs.writeFileSync(file,JSON.stringify(result,null,2));assert.deepEqual(errors,[]);assert.deepEqual(observed.errors,[]);assert.ok(observed.firstThreeBalls&&observed.lastZero&&observed.firstPositive,'startup and first advancing clock were observed');
 assert.equal(result.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(observed.boundaries.length,throughMilliseconds);for(let i=0;i<throughMilliseconds;i++)assert.equal(observed.boundaries[i].ms,i+1,'every initial physical clock is observed');
 console.log(JSON.stringify({file,records:observed.records.length,clocks:observed.clocks,boundaries:observed.boundaries.length,lastZeroMilliseconds:observed.lastZero.ms,lastZeroSeconds:observed.lastZero.seconds,firstPositiveMilliseconds:observed.firstPositive.ms}));
}catch(error){let observed;try{observed=await evaluate('(()=>{const {read,...data}=nativeStartup;return {...data,live:read()};})()');}catch{}fs.writeFileSync(file+'.partial',JSON.stringify({error:String(error),reference,observed,errors},null,2));throw error;}finally{socket.close();}
