// Measure the actual VPX engine in an isolated headless browser instance.
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async(expression,attempts=1200)=>{for(let i=0;i<attempts;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+expression);};
const script=async code=>evaluate(`finni.evaluate(${JSON.stringify(code)})`);
try{
  await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:360,height:720,deviceScaleFactor:1,mobile:true});
  await call('Page.navigate',{url:base});console.log('Loading native VPX reference…');
  try{await wait('!!window.finni && !document.getElementById("play").disabled');}
  catch(error){console.log(await evaluate('document.body.innerText.slice(-2500)'));throw error;}
  await evaluate('document.getElementById("play").click()');
  await wait('document.body.classList.contains("playing")');
  console.log('Native table ready; measuring unloaded flipper travel.');
  await script('SolLFlipper 0:SolRFlipper 0');
  await new Promise(r=>setTimeout(r,500));
  const samples=[];
  for(const pressed of [true,false]){
    await script(`Debug.Print "REFSTART|" & GameTime:SolLFlipper ${pressed?1:0}:SolRFlipper ${pressed?1:0}`);
    const origin=await evaluate('parseFloat(document.getElementById("log").textContent.split("REFSTART|").at(-1))');
    const start=performance.now();
    for(let i=0;i<24;i++){
      await script('Debug.Print "REFPHYSICS|" & GameTime & ":" & LeftFlipper.CurrentAngle & ":" & RightFlipper.CurrentAngle');
      const text=await evaluate('document.getElementById("log").textContent.split("REFPHYSICS|").at(-1).split("\\n")[0]');
      const [time,left,right]=text.split(':').map(parseFloat);
      samples.push([pressed,time-origin,left,right]);
      await new Promise(r=>setTimeout(r,4));
    }
  }
  const ballSamples=[];
  await script('Dim RefBalls, RefBall:RefBalls=GetBalls:Set RefBall=RefBalls(UBound(RefBalls))');
  for(const speed of [0,10]){
    await script('SolLFlipper 0:SolRFlipper 0');
    await script(`RefBall.X=430:RefBall.Y=1500:RefBall.Z=25:RefBall.VelX=${speed}:RefBall.VelY=0:RefBall.VelZ=0`);
    for(let i=0;i<16;i++){
      await script('Debug.Print "REFBALL|" & GameTime & ":" & RefBall.X & ":" & RefBall.Y & ":" & RefBall.Z & ":" & RefBall.VelX & ":" & RefBall.VelY & ":" & RefBall.VelZ');
      const row=await evaluate('document.getElementById("log").textContent.split("REFBALL|").at(-1).split("\\n")[0]');
      ballSamples.push({speed,values:row.split(':').map(parseFloat)});
      await new Promise(r=>setTimeout(r,10));
    }
  }
  console.log(JSON.stringify({flipperSamples:samples}));
  await writeFile(`${output}/vpx-physics-reference.json`,JSON.stringify({samples,ballSamples},null,2));
}finally{socket.close();}
