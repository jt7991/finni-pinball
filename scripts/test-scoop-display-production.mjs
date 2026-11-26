// Controlled physical multiball coverage plus real UI keys and displayed pixels.
// Observe both rule queries and the player's existing display subscriptions.
// Rule-only coverage cannot establish that the chooser is actually painted.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {earnedScoopFields,earnedScoopBooleans,observeEarnedScoop,runEarnedScoop} from './earned-multiball-scoop-scenario.mjs';

const [debug,base,output]=process.argv.slice(2);
const freezeDisplay=process.argv.includes('--negative-freeze-display');
const source=JSON.parse(fs.readFileSync('three/public/source-table.json','utf8'));
const metadata=await(await fetch(new URL('source-table.json',base))).json();
assert.equal(metadata.sourceTableSHA256,source.sourceTableSHA256);assert.equal(metadata.engineSHA256,source.engineSHA256);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;
const pending=new Map(),errors=[],display=[],executedActions=[];
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
  if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(expression,milliseconds=60000)=>{
  for(let i=0;i<milliseconds/50;i++){if(await evaluate(expression))return;await sleep(50);}
  throw Error('Scoop display timed out: '+expression);
};
const execute=statement=>{
  executedActions.push({kind:'execute',statement});
  return evaluate('scoopDisplay.command('+JSON.stringify({type:'execute',statement})+')');
};
const key=async(code,keyValue)=>{
  await evaluate('document.getElementById("canvas").focus()');
  assert.equal(await evaluate('document.activeElement.id'),'canvas');
  executedActions.push({kind:'key',code,key:keyValue});
  for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,code,key:keyValue});
};
async function touchAction(){
  const point=await evaluate(`(()=>{const r=document.querySelector('[data-input="action"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height};})()`);
  assert.ok(point.width>0&&point.height>0,'Action button occupies layout space');
  executedActions.push({kind:'touch',action:'action',x:point.x,y:point.y});
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:7}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const read=async()=>{
  await evaluate('scoopDisplay.command({type:"barrier"})');
  const values=await evaluate('scoopDisplay.latest');
  return Object.fromEntries(Object.entries(earnedScoopFields).map(([name,query])=>[name,
    name==='ids'?String(values[query]??'').split(',').filter(Boolean).map(Number):
    earnedScoopBooleans.has(name)?!!values[query]:Number(values[query])]));
};
async function observeDisplay(label,image){
  // Both the source rule and the live render object must reach the image. A
  // script-only observation cannot establish that choices are actually shown.
  const scene=value=>String(value??'').replace(/_anim\d+$/,'');
  const matches='(value=>String(value??" ").replace(/_anim\\d+$/,"")==='+JSON.stringify(image)+')';
  await wait(matches+'(scoopDisplay.latest?.["digit041.ImageA"])',8000);
  await wait(matches+'(scoopDisplay.objects.get("digit041")?.imagea)',8000);
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const observed=await evaluate(`(()=>{
    const canvas=document.getElementById('dmd'),rect=canvas.getBoundingClientRect();
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let hash=2166136261;const colors=new Set();
    for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===0)colors.add(pixels[i]*65536+pixels[i+1]*256+pixels[i+2]);}
    return {image:scoopDisplay.objects.get('digit041').imagea,hash:hash>>>0,colors:colors.size,
      width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height,
      visible:document.visibilityState,time:scoopDisplay.time};
  })()`);
  assert.ok(observed.cssWidth>0&&observed.cssHeight>0,'DMD occupies visible layout space');
  assert.equal(scene(observed.image),image);
  assert.equal(observed.visible,'visible');assert.ok(observed.colors>16,'actual DMD contains image pixels');
  const screenshot=await call('Page.captureScreenshot',{format:'png'});
  const file='scoop-display-'+label+'.png';fs.writeFileSync(path.join(output,file),Buffer.from(screenshot.data,'base64'));
  display.push({label,...observed,screenshot:file});return observed;
}
try{
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const NativeWorker=window.Worker,s=window.scoopDisplay={pending:new Map(),id:970000,latest:{},objects:new Map(),fatal:[],extraQueries:[],freezeCanvas:false};
    for(const name of ['clearRect','fillRect','drawImage']){
      const original=CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name]=function(...args){if(s.freezeCanvas&&this.canvas.id==='dmd')return;return original.apply(this,args);};
    }
    s.command=message=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({...message,id});});
    window.Worker=class extends NativeWorker{
      constructor(...args){super(...args);this.addEventListener('message',({data})=>{
        if(data.type==='response'&&s.pending.has(data.id)){const task=s.pending.get(data.id);s.pending.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result);}
        if(data.type==='fatal')s.fatal.push(data.message);
        const states=data.type==='ready'?data.description.objects:data.type==='snapshot'?data.snapshot.objects:[];
        for(const [name,state]of states??[])s.objects.set(name,{...s.objects.get(name),...state});
        if(data.type==='snapshot'){s.latest=Object.fromEntries(data.snapshot.values);s.time=data.snapshot.time;}
      });}
      postMessage(message,...args){
        if(message.type==='init')s.worker=this;
        if(message.type==='subscribe'){
          s.subscription=message;
          message={...message,queries:[...new Set([...message.queries,...s.extraQueries])]};
        }
        return super.postMessage(message,...args);
      }
    };
  })()`});
  await call('Page.navigate',{url:base});
  await wait('document.getElementById("play")?.textContent==="Start game"');
  assert.equal(await evaluate('!!window.finniThree'),false,'use the production build');
  await evaluate('document.getElementById("play").click()');
  await wait('document.body.classList.contains("ball-in-plunger")');
  await execute(observeEarnedScoop(fs.readFileSync('three/public/rules.vbs','utf8')));
  await evaluate('scoopDisplay.extraQueries='+JSON.stringify([...Object.values(earnedScoopFields),'digit041.ImageA'])+';scoopDisplay.worker.postMessage(scoopDisplay.subscription)');
  await evaluate('document.getElementById("canvas").focus()');
  await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await sleep(650);
  await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});
  await wait('!document.body.classList.contains("ball-in-plunger")');
  let checked=false;
  const result=await runEarnedScoop({read,assert,advance:sleep,input:async(action,down)=>{
    assert.equal(action,'action');executedActions.push({kind:'key',code:'Space',down});
    await call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code:'Space',key:' '});
  },execute:async statement=>{
    if(statement.startsWith('Table1_KeyDown')&&!checked){
      checked=true;
      const first=await observeDisplay('presents','d_finni_presents_select');
      if(freezeDisplay)await evaluate('scoopDisplay.freezeCanvas=true');
      await key('ShiftRight','Shift');const next=await observeDisplay('invitations','d_finni_invitations_select');
      assert.notEqual(next.hash,first.hash,'real right flipper changes the painted chooser');
      await key('ShiftLeft','Shift');const returned=await observeDisplay('presents-return','d_finni_presents_select');
      assert.notEqual(returned.hash,next.hash,'real left flipper repaints the original mode choice');
      // The separate earned-scoop regression covers the scripted 60-key
      // burst. Here, confirm through the actual touch control instead.
      await touchAction();return;
    }
    return execute(statement);
  }});
  assert.ok(checked);assert.deepEqual(errors,[]);assert.deepEqual(await evaluate('scoopDisplay.fatal'),[]);
  const report={base,metadata,scope:'Controlled physical three-lock and scoop approaches from the shared earned-multiball scenario; actual browser flipper keys must change and restore visible DMD choices while the chooser holds three balls. The shared scenario requested key burst is replaced by one actual Action touch; the requested and executed actions are separately recorded. Existing player object subscriptions are retained and rule queries added. No rule qualification, RNG, clock, timer deadline, expected output or rescue is supplied. This is UI and release coverage, not exact native trajectory parity.',display,rows:result.rows,requestedScenarioActions:result.actions,executedActions,errors};
  fs.writeFileSync(path.join(output,'scoop-display-production.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({display,phases:result.rows.map(r=>({phase:r.phase,hole:r.hole,kicks:r.scoopKicks,starts:r.starts})),errors}));
}catch(error){
  const screenshot=await call('Page.captureScreenshot',{format:'png'}).catch(()=>null);
  if(screenshot)fs.writeFileSync(path.join(output,'scoop-display-failure.png'),Buffer.from(screenshot.data,'base64'));
  fs.writeFileSync(path.join(output,'scoop-display-failure.json'),JSON.stringify({base,freezeDisplay,error:String(error),display,observed:await evaluate('({latest:scoopDisplay.latest,displayImage:scoopDisplay.objects.get("digit041")?.imagea,fatal:scoopDisplay.fatal,subscription:scoopDisplay.subscription})').catch(String),errors},null,2),{flag:'wx'});
  throw error;
}finally{socket.close();}
