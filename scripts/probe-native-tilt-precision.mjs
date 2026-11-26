// Original unmodified engine, fresh native instances and public pendulum
// readings. Controller supplies declared Nudge inputs; no physical state reset.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import {tiltPrecisionScenarios} from './tilt-precision-scenarios.mjs';
const [debug,base,output]=process.argv.slice(2),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=fs.readFileSync('three/public/rules.vbs','utf8');
const metadata=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(metadata.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const getSub=name=>{const matches=source.match(new RegExp('^Sub '+name+'\\b[^\\n]*\\n[\\s\\S]*?^End Sub','gmi'));assert.equal(matches?.length,1);return matches[0];};
const handlers=['LeftFlipper_Timer','Table1_KeyDown','Table1_KeyUp'].map(name=>{
 const original=getSub(name),logger=name==='LeftFlipper_Timer'?' If TiltQAOn Then TiltQAObserve\n':` If TiltQAOn And keycode=MechanicalTilt Then Debug.Print "TILT_PREC_KEY|" & GameTime & "|${name.endsWith('Down')?'1':'0'}"\n`,at=name==='LeftFlipper_Timer'?original.lastIndexOf('End Sub'):original.indexOf('\n')+1;
 const observed=original.slice(0,at)+logger+original.slice(at);assert.equal(observed.replace(logger,''),original);return{name,originalSHA256:sha(original),observed};
});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[],cases=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const execute=statement=>evaluate('finni.evaluate('+JSON.stringify(statement)+')');
const wait=async expression=>{for(let i=0;i<1600;i++){if(await evaluate(`(()=>{if(document.body.classList.contains('engine-error'))throw Error(document.getElementById('log')?.textContent.slice(-1200));return ${expression};})()`))return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Native tilt wait: '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const scenario of tiltPrecisionScenarios){
  console.log('Native tilt scenario '+scenario.name);
  await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  await evaluate(`(()=>{window.tiltPrecisionQA={rows:[],keys:[],inputs:[]};const node=document.getElementById('log'),descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');Object.defineProperty(node,'textContent',{get(){return descriptor.get.call(this);},set(value){const line=String(value).split('\\n').at(-1),match=line.match(/TILT_PREC_(ROW|KEY|INPUT)\\|/);if(!match)return descriptor.set.call(this,value);const values=line.slice(line.indexOf(match[0])+match[0].length).replace(/'$/,'').split('|').map(Number);if(!values.every(Number.isFinite))throw Error('Finite tilt observation required');tiltPrecisionQA[({ROW:'rows',KEY:'keys',INPUT:'inputs'})[match[1]]].push(values);}});})()`);
  const control=`Dim TiltQAOn,TiltQAOrigin,TiltQAX,TiltQAY,TiltQAPercent
TiltQAOn=False:TiltQAOrigin=-1
Sub TiltQAObserve
 If TiltQAOrigin<0 Then TiltQAOrigin=GameTime
 NudgeTiltStatus TiltQAX,TiltQAY,TiltQAPercent
 Debug.Print "TILT_PREC_ROW|" & GameTime & "|" & FormatNumber(CDbl(TiltQAX),32,-1,0,0) & "|" & FormatNumber(CDbl(TiltQAY),32,-1,0,0) & "|" & FormatNumber(CDbl(TiltQAPercent),32,-1,0,0)
 Select Case GameTime-TiltQAOrigin
${scenario.inputs.map(([ms,angle,force])=>`  Case ${ms}:Debug.Print "TILT_PREC_INPUT|" & GameTime & "|${angle}|${force}":Nudge ${angle},${force}`).join('\n')}
 End Select
 If GameTime-TiltQAOrigin>=1500 Then TiltQAOn=False
End Sub
${handlers.map(handler=>handler.observed).join('\n')}`;
  await execute(control);await execute('TiltQAOn=True');await wait('tiltPrecisionQA.rows.length>=1501');
  const observed=await evaluate('tiltPrecisionQA'),origin=observed.rows[0][0],relative=rows=>rows.map(([ms,...values])=>[ms-origin,...values]);
  const rows=relative(observed.rows);assert.equal(rows.length,1501);rows.forEach((row,index)=>assert.equal(row[0],index));assert.deepEqual(relative(observed.inputs),scenario.inputs);
  cases.push({...scenario,origin,rows,keys:relative(observed.keys),deliveredInputs:relative(observed.inputs),controller:control});
 }
 const bytes=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());assert.equal(sha(bytes),metadata.engineSHA256);assert.deepEqual(errors,[]);
 const capture={scope:'Four fresh unmodified native games. The original LeftFlipper timer and keyboard handlers retain every statement and gain only observer/controller calls. Each 1ms timer observes public NudgeTiltStatus before supplying a declared ordinary Nudge input. The first timer defines relative time zero. No body, cabinet, pendulum, RNG, timer deadline or clock state is restored. Decimal public getter readings are retained; zero sign is not exposed by FormatNumber.',engineSHA256:sha(bytes),metadata,sourceScriptSHA256:sha(source),scenarioSHA256:sha(fs.readFileSync(new URL('./tilt-precision-scenarios.mjs',import.meta.url))),probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),handlers:handlers.map(({observed,...record})=>record),cases,errors};
 fs.writeFileSync(output+'/native-tilt-precision.json',JSON.stringify(capture,null,2),{flag:'wx'});console.log(JSON.stringify({cases:cases.map(row=>({name:row.name,rows:row.rows.length,keys:row.keys.length})),errors}));
}catch(error){
 const observation=await evaluate('({title:document.title,button:document.getElementById("play")?.textContent,classes:document.body.className,capture:window.tiltPrecisionQA,log:document.getElementById("log")?.textContent.slice(-2500)})').catch(()=>null);
 fs.writeFileSync(output+'/native-tilt-precision-failure.json',JSON.stringify({error:String(error),cases,observation,errors},null,2),{flag:'wx'});throw error;
}finally{socket.close();}
