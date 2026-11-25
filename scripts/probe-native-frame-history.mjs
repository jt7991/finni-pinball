// Original native frames beginning with the first tonemap. Readbacks preserve
// all native clocks, state and rendering; their cost remains part of the run.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
import{installNativeSceneClockObserver}from './native-scene-clock-observer.mjs';
import{installNativeTimerDispatchObserver}from './native-timer-dispatch-observer.mjs';
import{installNativePostprocessObserver}from './native-postprocess-observer.mjs';
import{installNativeWholeFrameObserver}from './native-whole-frame-observer.mjs';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
import{installNativeBallPresentationObserver}from './native-ball-presentation-observer.mjs';
import{installNativeRandomizeClockObserver}from './native-randomize-clock-observer.mjs';
import{installNativeTextureAuditObserver}from './native-texture-audit-observer.mjs';
import{nativeTextureCacheLayout}from './native-texture-cache-layout.mjs';
import{installNativeFlipperMotionObserver}from './native-flipper-motion-observer.mjs';
import{missionRenderScenario,installMissionRenderController}from './native-mission-render-controller.mjs';
import{missionCompletionScenario,partyFinaleVictoryScenario,installMissionCompletionController}from './native-mission-completion-controller.mjs';
import{sideModeScenario,installSideModeController}from './native-side-mode-controller.mjs';
import{partyChooserScript}from '../browser/party-chooser.js';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'initial-history-r1';
const deferImageEncoding=process.argv.includes('--defer-image-encoding'),asyncReadback=process.argv.includes('--async-readback');if(asyncReadback)assert.ok(deferImageEncoding,'Asynchronous readback requires deferred encoding');
const completeFinale=process.argv.includes('--complete-party-finale'),requireFinaleVictory=process.argv.includes('--require-finale-victory');
const finaleWindow=process.argv.find(arg=>arg.startsWith('--finale-window='))?.split('=')[1]??'entry';assert.ok(['entry','victory'].includes(finaleWindow));const imageMilestone=finaleWindow==='victory'?'party-finale-victory':'party-finale';
const imageFrameCount=Number(process.argv.find(arg=>arg.startsWith('--frames='))?.slice(9)??6),warmupFrames=Number(process.argv.find(arg=>arg.startsWith('--warmup-frames='))?.slice(16)??0),launchControls=process.argv.includes('--launch-controls'),sustainedControls=process.argv.includes('--sustained-controls');
let frameCount=completeFinale?Number(process.argv.find(arg=>arg.startsWith('--max-history-frames='))?.split('=')[1]??8192):warmupFrames+imageFrameCount;
assert.ok(Number.isInteger(imageFrameCount)&&imageFrameCount>=2&&imageFrameCount<=128);assert.ok(Number.isInteger(warmupFrames)&&warmupFrames>=0&&Number.isInteger(frameCount)&&frameCount>=imageFrameCount&&frameCount<=8192);if(launchControls||sustainedControls)assert.ok(frameCount>=32);assert.ok(!launchControls||!sustainedControls);const declaredFrameLimit=frameCount;
if(completeFinale)assert.ok(deferImageEncoding&&warmupFrames===0,'Finale uses deferred encoding and an explicit milestone-triggered image window');if(requireFinaleVictory)assert.ok(completeFinale);
const scenarioFile=process.argv.find(arg=>arg.startsWith('--scenario-inputs='))?.slice(18),scenarioInputs=scenarioFile?JSON.parse(fs.readFileSync(scenarioFile)):[];
assert.ok(Array.isArray(scenarioInputs));for(const [i,input]of scenarioInputs.entries()){assert.ok(Number.isInteger(input.afterMilliseconds)&&input.afterMilliseconds>=0&&(!i||input.afterMilliseconds>=scenarioInputs[i-1].afterMilliseconds));assert.ok(typeof input.script==='string'||typeof input.code==='string'&&typeof input.down==='boolean');}if(scenarioFile)assert.ok(!launchControls&&!sustainedControls);
const missionText=process.argv.find(arg=>arg.startsWith('--mission-controller='))?.slice(21),missionScenario=missionText===undefined?null:missionRenderScenario(Number(missionText));if(missionScenario){assert.ok(!scenarioFile&&!launchControls&&!sustainedControls);assert.equal(warmupFrames,0,'Mission transition capture starts with original initialization');assert.ok(frameCount>=64);}
const completionText=process.argv.find(arg=>arg.startsWith('--complete-mission='))?.split('=')[1],sideModes=process.argv.includes('--complete-side-modes'),guardPartyChooser=process.argv.includes('--guard-party-chooser'),requireControllerComplete=process.argv.includes('--require-controller-complete');
assert.ok([completionText!==undefined,sideModes,completeFinale].filter(Boolean).length<=1,'Completion controllers are distinct');
const controllerKind=completeFinale?'physical-party-finale':sideModes?'physical-side-modes':completionText!==undefined?'physical-mission-completion':null;
const controllerObjects=controllerKind?JSON.parse(fs.readFileSync('three/public/objects.json')).objects:null;
const physicalScenario=completeFinale?partyFinaleVictoryScenario(controllerObjects):sideModes?sideModeScenario(controllerObjects):controllerKind?missionCompletionScenario(controllerObjects,Number(completionText)):null;
if(controllerKind)assert.ok(!missionScenario&&!scenarioFile&&!launchControls&&!sustainedControls&&(warmupFrames>0||completeFinale),'Physical completion uses its own declared controller and uninterrupted warm-up');
if(requireControllerComplete)assert.ok(controllerKind,'Completion gate requires a physical controller');
if(guardPartyChooser)assert.ok(controllerKind,'Chooser correction is recorded and applied by the physical controller capture');
const cadence=Number(process.argv.find(arg=>arg.startsWith('--cadence-ms='))?.slice(13)??180);assert.ok(Number.isInteger(cadence)&&cadence>=50&&cadence<=1000);
const tracePixel=process.argv.find(arg=>arg.startsWith('--trace-first-pixel='))?.slice(20).split(',').map(Number);if(tracePixel)assert.ok(tracePixel.length===2&&tracePixel.every(Number.isInteger));
const geometryFrames=process.argv.find(arg=>arg.startsWith('--geometry-frames='))?.slice(18).split(',').map(Number)??(tracePixel?[1]:undefined);if(geometryFrames)assert.ok(geometryFrames.every(frame=>Number.isInteger(frame)&&frame>=1&&frame<=frameCount));
const postprocessFrames=process.argv.find(arg=>arg.startsWith('--postprocess-frames='))?.slice(21).split(',').map(Number);if(postprocessFrames)assert.ok(postprocessFrames.every(frame=>Number.isInteger(frame)&&frame>=1&&frame<=frameCount));
assert.match(name,/^[a-z0-9-]+$/);const directory=path.join(output,'native-frame-history-'+name);assert.equal(fs.existsSync(directory),false,'Preserve previous captures');fs.mkdirSync(directory,{recursive:true});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
async function transferJSON(expression){
 const length=await evaluate('window.nativeFrameCaptureJSON=JSON.stringify('+expression+');nativeFrameCaptureJSON.length');
 assert.ok(Number.isInteger(length)&&length>0);const chunks=[],size=1024*1024;
 for(let offset=0;offset<length;offset+=size){const chunk=await evaluate(`nativeFrameCaptureJSON.slice(${offset},${offset+size})`);assert.equal(chunk.length,Math.min(size,length-offset));chunks.push(chunk);}
 await evaluate('delete window.nativeFrameCaptureJSON');const serialized=chunks.join('');assert.equal(serialized.length,length);return JSON.parse(serialized);
}
const wait=async expression=>{for(let i=0;i<5000;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 const source="if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1','detailed');"+(process.argv.includes('--flipper-motion')?'('+installNativeFlipperMotionObserver.toString()+')();':'')+'('+installNativeRandomizeClockObserver.toString()+')();('+installNativeStartupObserver.toString()+')('+(sustainedControls||warmupFrames||missionScenario||controllerKind?120000:10000)+');('+installNativeSceneClockObserver.toString()+')('+JSON.stringify({maxFrames:Math.max(1000,frameCount+16)})+');('+installNativeTimerDispatchObserver.toString()+')();('+installNativeBallPresentationObserver.toString()+')();('+installNativePostprocessObserver.toString()+')('+JSON.stringify({highPrecisionDepth:true,deferImageEncoding,asyncReadback})+');'+(process.argv.includes('--texture-audit')?'('+installNativeTextureAuditObserver.toString()+')();':'')+'('+installNativeWholeFrameObserver.toString()+')('+JSON.stringify({fromInitialization:true,imagesOnly:true,frames:frameCount,freezeObserversAfterCapture:sustainedControls||warmupFrames>0||!!missionScenario||!!controllerKind,...completeFinale?{imageWhen:imageMilestone,imageFrames:imageFrameCount}:warmupFrames?{imageFromFrame:warmupFrames+1}:{},postprocessImages:process.argv.includes('--postprocess-images'),captureFlasherGeometry:process.argv.includes('--flasher-geometry'),...postprocessFrames?{postprocessFrames}:{},...geometryFrames?{geometryFrames}:{},...tracePixel?{tracePixel}:{}})+');';
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');
 await evaluate(`(()=>{nativeBallPresentation.install();nativeRandomizeClocks.install();nativeBallPresentation.maxRecords=${Math.max(1024,frameCount*16)};nativeBallPresentation.armed=true;window.nativePlayerInputs=[];const engine=finni.engine,raw=engine.ccall;engine.ccall=function(...args){let row;if(args[0]==='vpinball_wasm_eval_script')nativePlayerInputs.push(row={frameIndex:nativeStartup.frameIndex(),ms:nativeStartup.read()?.ms,script:args[3][0]});const result=raw.apply(this,args);if(row?.script.startsWith('Debug.Print "FINNI_STATE|'))row.uiState={score:Number(document.getElementById('score').textContent.replace(/,/g,'')),ball:document.getElementById('ball').textContent,playing:document.body.classList.contains('game-in-play'),plunger:document.body.classList.contains('ball-in-plunger')};return result;};})()`);
 if(process.argv.includes('--texture-audit')){const layout=nativeTextureCacheLayout(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()));await evaluate('nativeTextureAudit.layout='+JSON.stringify(layout)+';nativeTextureAudit.getterFunctions=nativeTextureAudit.layout.indices');}
 await evaluate('document.getElementById("play").click()');
 const actions=[];
 if(controllerKind){
  await wait('document.body.classList.contains("ball-in-plunger")');
  if(guardPartyChooser)await evaluate('finni.evaluate('+JSON.stringify(partyChooserScript)+')');
  await evaluate('window.nativeGameplay={get done(){return nativeWholeFrame.frames.length>=nativeWholeFrame.captureFrameCount;}}');
  await evaluate('('+(sideModes?installSideModeController:installMissionCompletionController).toString()+')('+JSON.stringify(physicalScenario)+')');
 }
 if(missionScenario)await evaluate('('+installMissionRenderController.toString()+')('+JSON.stringify(missionScenario)+','+frameCount+')');
 if(scenarioFile)await evaluate(`(()=>{const inputs=${JSON.stringify(scenarioInputs)};let index=0;window.nativeScenarioActions=[];document.activeElement?.blur();const timer=setInterval(()=>{if(nativeWholeFrame.frames.length===${frameCount}){clearInterval(timer);return;}const snapshot=nativeStartup.read();if(!snapshot)return;const ms=snapshot.ms;while(index<inputs.length&&ms>=inputs[index].afterMilliseconds){const input=inputs[index++];nativeScenarioActions.push({...input,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()});if(input.script)finni.evaluate(input.script);else window.dispatchEvent(new KeyboardEvent(input.down?'keydown':'keyup',{code:input.code,key:input.code.startsWith('Shift')?'Shift':input.code==='Space'?' ':'Enter',bubbles:true}));}},16);})()`);

 if(sustainedControls){
  await wait('document.body.classList.contains("ball-in-plunger")');
  await evaluate(`(()=>{document.activeElement?.blur();let origin=nativeStartup.read().ms,held=new Set(),pullAt=null,lastLaunch=-Infinity;window.nativeSustainedActions=[];const key=(code,down)=>{if(held.has(code)===down)return;down?held.add(code):held.delete(code);window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code.startsWith('Shift')?'Shift':'Enter',bubbles:true}));nativeSustainedActions.push({code,down,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()});};const timer=setInterval(()=>{if(nativeWholeFrame.frames.length===${frameCount}){clearInterval(timer);return;}const ms=nativeStartup.read().ms,phase=Math.floor((ms-origin)/${cadence})%4;key('ShiftLeft',phase===0||phase===1);key('ShiftRight',phase===1||phase===2);if(pullAt!==null&&ms-pullAt>=600){key('Enter',false);pullAt=null;lastLaunch=ms;}else if(pullAt===null&&ms-lastLaunch>=3000&&document.body.classList.contains('ball-in-plunger')){key('Enter',true);pullAt=ms;}},16);})()`);
 }
 if(launchControls){
  await wait('document.body.classList.contains("ball-in-plunger")');
  const key=async(code,down)=>{await call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.startsWith('Shift')?'Shift':code==='Enter'?'Enter':'x'});actions.push({code,down,...await evaluate('({ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()})')});};
  for(const code of ['ShiftLeft','ShiftRight','Enter'])await key(code,true);
  await new Promise(resolve=>setTimeout(resolve,600));await key('Enter',false);await key('KeyX',true);await key('KeyX',false);
  await new Promise(resolve=>setTimeout(resolve,300));await key('ShiftLeft',false);await key('ShiftRight',false);
 }
 await wait('nativeWholeFrame.frames.length===nativeWholeFrame.captureFrameCount||nativeWholeFrame.errors.length>0');
 frameCount=await evaluate('nativeWholeFrame.captureFrameCount');
 const imageStart=await evaluate('nativeWholeFrame.imageFromFrame');if(completeFinale)assert.ok(Number.isInteger(imageStart),'Original controller must reach the declared finale image milestone');
 if(sustainedControls)actions.push(...await evaluate('nativeSustainedActions'));
 if(missionScenario){const controller=await evaluate('nativeMissionRenderController');assert.deepEqual(controller.errors,[]);assert.equal(controller.stage,'active','Declared mission must actually start');assert.equal(controller.actions.filter(row=>row.kind==='approach').length,1);actions.push(...controller.actions);}
 const physicalController=controllerKind?await evaluate(sideModes?'nativeSideModeController':'nativeMissionCompletionController'):null;
 if(physicalController){assert.deepEqual(physicalController.errors,[]);actions.push(...physicalController.actions);}
 if(scenarioFile){actions.push(...await evaluate('nativeScenarioActions'));assert.equal(actions.length,scenarioInputs.length,'Every declared scenario input executed inside the recording');}
 if(process.argv.includes('--texture-audit')){await evaluate('Promise.all(nativeTextureAudit.pending)');await evaluate('nativeTextureAudit.textureObjects=nativeTextureAudit.inspectTextureHashes()');}
 const encodingBeforeReadbacks=await evaluate('({...nativePostprocess.imageEncoding})');
 await evaluate('nativePostprocess.io.finishReadbacks()');
 const encodingBeforeExport=await evaluate('({...nativePostprocess.imageEncoding})');
 const meta=await transferJSON('({flipperMotion:window.nativeFlipperMotion,textureAudit:window.nativeTextureAudit?{layout:nativeTextureAudit.layout,uploads:nativeTextureAudit.uploads,textureObjects:nativeTextureAudit.textureObjects,bindings:nativeTextureAudit.bindings}:undefined,frames:nativeWholeFrame.frames.map(({images,...frame})=>({...frame,images:Object.fromEntries(Object.entries(images).map(([name,{bytes,...image}])=>[name,image]))})),clock:nativeSceneClock,timers:nativeTimerDispatch,startup:nativeStartup,randomizeClocks:nativeRandomizeClocks,playerInputs:nativePlayerInputs,presentation:{records:nativeBallPresentation.records,errors:nativeBallPresentation.errors,layout:nativeBallPresentation.layout},errors:nativeWholeFrame.errors})');
 assert.deepEqual(meta.errors,[]);assert.equal(meta.frames.length,frameCount);
 for(let i=0;i<meta.frames.length;i++){
  const frame=meta.frames[i];assert.deepEqual(frame.errors,[]);
  for(const [key,image]of Object.entries(frame.images)){
   const bytes=Buffer.from(await evaluate(`nativeWholeFrame.frames[${i}].images[${JSON.stringify(key)}].bytes`),'base64'),file=`frame-${i}-${key}.bin`;
   fs.writeFileSync(path.join(directory,file),bytes);image.file=file;image.sha256=createHash('sha256').update(bytes).digest('hex');
  }
 }
 const engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());meta.engineSHA256=createHash('sha256').update(engine).digest('hex');assert.equal(meta.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 meta.clockABI=nativeFrameClockLayout(engine);meta.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(meta.reference.sourceSha256,meta.reference.controlledSha256);assert.deepEqual(meta.reference.controlledOverrides,{});meta.errors=errors;
 meta.playerSource={};for(const file of ['app.js','views.js'])meta.playerSource[file]=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/'+file,base))).arrayBuffer())).digest('hex');
 assert.deepEqual(meta.frames.map(frame=>frame.frameIndex),Array.from({length:frameCount},(_,i)=>i+1),'No initialization frames omitted');meta.requestedFrames=frameCount;meta.actions=actions;if(warmupFrames||completeFinale)meta.imageWindow={warmupFrames:completeFinale?imageStart-1:warmupFrames,imageFrames:imageFrameCount};if(completeFinale)meta.imageTrigger={kind:imageMilestone,firstFrame:imageStart,maxHistoryFrames:declaredFrameLimit};if(scenarioFile)meta.scenario={file:scenarioFile,inputs:scenarioInputs,scope:'Explicit declared scenario inputs. Initial qualification and one approach pose are not natural progression. Every native evaluation is recorded as an input; later physics, ball creation, rules and rendering remain under the original engine.'};
 if(launchControls||sustainedControls){assert.ok(actions.every(action=>action.frameIndex<=frameCount),'Every ordinary input must occur inside the uninterrupted capture');assert.ok(meta.frames.some(frame=>frame.snapshot.balls.length>=4),'Normal Start creates the play ball');}
 if(meta.flipperMotion)assert.deepEqual(meta.flipperMotion.errors,[]);
 if(scenarioFile)meta.scenarioLog=await evaluate('document.getElementById("log").textContent.split(String.fromCharCode(10)).filter(line=>line.includes("RENDER_MODE|")||line.includes("RENDER_SCENARIO|"))');
 meta.scope=frameCount+' consecutive native tonemapped frames, beginning with original initialization. Ordinary UI Start'+(sustainedControls?', repeated launch and alternating flipper keys':launchControls?', launch, flipper and nudge keys':' only')+'. Original WASM/table/clocks/state/draws unchanged; image readback overhead is part of the observed timing. Outputs and prior images are expectations, never model inputs.';
 if(scenarioFile||missionScenario)meta.scope+=' Declared qualification/approach inputs and original key-handler calls are preserved in metadata. They are controlled inputs, not natural qualification; the original engine executes all later physics and authored rules.';
 if(sustainedControls)meta.controller={cadenceMilliseconds:cadence};
 if(missionScenario){meta.missionController=missionScenario;meta.scenarioLog=await evaluate('document.getElementById("log").textContent.split(String.fromCharCode(10)).filter(line=>line.includes("RENDER_MODE|")||line.includes("RENDER_SCENARIO|"))');assert.ok(meta.scenarioLog.some(line=>new RegExp('RENDER_MODE[|][0-9]+[|]'+missionScenario.mission+'[|]').test(line)),'Native source confirms the requested mission');assert.ok(meta.scenarioLog.some(line=>/RENDER_SCENARIO[|][0-9]+[|][0-9]+[|]False/.test(line)),'Original source confirms lane exit before the controlled approach');}
 if(physicalController){
  const controllerFile='scripts/'+(sideModes?'native-side-mode-controller.mjs':'native-mission-completion-controller.mjs');
  meta.physicalController={kind:controllerKind,scenario:physicalScenario,sourceSHA256:createHash('sha256').update(fs.readFileSync(controllerFile)).digest('hex'),result:physicalController,completionRequired:requireControllerComplete,finaleVictoryRequired:requireFinaleVictory};
  meta.scope+=' '+physicalScenario.scope+' The image window is explicit; all earlier frames still execute in the replay.';
 }
 if(guardPartyChooser)meta.playerCorrections={partyChooserSHA256:createHash('sha256').update(partyChooserScript).digest('hex')};
 meta.imageEncoding={deferred:deferImageEncoding,asyncReadback,beforeReadbacks:encodingBeforeReadbacks,beforeExport:encodingBeforeExport,afterExport:await evaluate('({...nativePostprocess.imageEncoding})')};
 fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(meta));
 if(requireControllerComplete)assert.equal(physicalController.completed,true,'Declared physical controller must complete within the retained uninterrupted history');
 if(requireFinaleVictory){assert.equal(physicalController.finale?.outcome,'native-victory');assert.equal(physicalController.finale.win.won,7);}
 console.log(JSON.stringify({directory,frames:meta.frames.length,imageFrames:meta.frames.filter(frame=>Object.keys(frame.images).length).length,firstImageMilliseconds:meta.frames.find(frame=>Object.keys(frame.images).length)?.snapshot.ms,lastMilliseconds:meta.frames.at(-1).snapshot.ms,errors}));assert.deepEqual(errors,[]);
}catch(error){fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:String(error),errors,observed:await evaluate('({errors:nativeWholeFrame?.errors,frames:nativeWholeFrame?.frames?.length,log:document.getElementById("log")?.textContent?.slice(-3000),controller:window.nativeMissionCompletionController??window.nativeSideModeController,encoding:window.nativePostprocess?.imageEncoding,imageFromFrame:nativeWholeFrame?.imageFromFrame,captureFrameCount:nativeWholeFrame?.captureFrameCount})').catch(()=>null)}));throw error;}finally{socket.close();}
