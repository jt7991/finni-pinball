import fs from 'node:fs';
import {installNativeUniformPointerObserver} from './native-uniform-pointer-observer.mjs';
import {installNativeUniformAlignmentReference} from './native-uniform-alignment-reference.mjs';
import {installNativeMechanismPoseObserver} from './native-mechanism-pose-observer.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installNativePostprocessObserver} from './native-postprocess-observer.mjs';
import {installNativeWholeFrameObserver} from './native-whole-frame-observer.mjs';
import {installNativeBallPresentationObserver} from './native-ball-presentation-observer.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(value=>value.startsWith('--capture-name='))?.slice(15)??'control';
assert.match(name,/^[a-z0-9-]+$/);const directory=path.join(output,'native-whole-frame-'+name);assert.ok(!fs.existsSync(path.join(directory,'capture.json')),'Preserve existing captures; select a new name');fs.mkdirSync(directory,{recursive:true});
const lit=process.argv.includes('--lit');
const nativePrepass=process.argv.includes('--native-prepass'),allInserts=process.argv.includes('--all-inserts');
const alignmentReference=process.argv.includes('--uniform-alignment-reference');if(alignmentReference)assert.ok(process.argv.includes('--observe-uniform-pointers'),'Compatibility reference requires original pointer evidence');
const classicVariant=process.argv.find(value=>value.startsWith('--classic-variant='))?.slice(18);if(classicVariant){assert.equal(classicVariant,'fade-color');assert.ok(lit&&allInserts);}
const mechanismPoses=process.argv.includes('--observe-mechanism-poses');
const requestedQuality=process.argv.includes('--detailed')?'detailed':null;
const tracePixel=process.argv.find(value=>value.startsWith('--trace-pixel='))?.slice(14).split(',').map(Number);if(tracePixel)assert.ok(tracePixel.length===2&&tracePixel.every(Number.isInteger));
const ballFields=['X','Y','Z','Radius','Color','Visible','ReflectionEnabled','ForceReflection','BulbIntensityScale','PlayfieldReflectionScale','FrontDecal'];
const imageModeLight=process.argv.find(value=>value.startsWith('--classic-image-mode='))?.slice(21);if(imageModeLight)assert.ok(lit&&allInserts);
const cameraPreset=process.argv.find(value=>value.startsWith('--camera-preset='))?.slice(16);if(cameraPreset)assert.ok(['classic','balanced','topdown','playfield'].includes(cameraPreset));
assert.ok(!allInserts||lit,'All-insert control requires --lit');
const objects=JSON.parse(fs.readFileSync('three/public/objects.json')).objects,layout=JSON.parse(fs.readFileSync('three/public/layout.json')),items=[...new Map([...layout.items,...objects].filter(item=>item.name).map(item=>[item.name.toLowerCase(),item])).values()];
const classicNames=JSON.parse(fs.readFileSync('three/public/native-classic/native-classic.json')).parts.map(part=>part.spec.name);
if(imageModeLight)assert.ok(classicNames.includes(imageModeLight),'Explicit source classic light');
const fields={Timer:['Enabled'],Primitive:['Visible','RotX','RotY','RotZ'],Wall:['Visible','SideVisible'],Ramp:['Visible'],Rubber:['Visible'],Light:['Visible','State','Color','ColorFull','Intensity','IntensityScale','GetInPlayIntensity','GetInPlayStateBool'],Flasher:['Visible','ImageA','ImageB','Color','Opacity','Amount','Filter','AddBlend','ModulateVsAdd','Height'],HitTarget:['Visible','IsDropped'],Flipper:['Visible','CurrentAngle'],Gate:['Visible','ShowBracket','CurrentAngle'],Spinner:['Visible','CurrentAngle'],Trigger:['Visible'],Bumper:['BaseVisible','CapVisible','RingVisible','SkirtVisible']};
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
const native=statement=>evaluate('finni.evaluate('+JSON.stringify(statement)+')');
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 if(requestedQuality)await call('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1',${JSON.stringify(requestedQuality)});`});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});('+installNativeBallPresentationObserver.toString()+')();('+installNativeWholeFrameObserver.toString()+')();'+(alignmentReference?'('+installNativeUniformAlignmentReference.toString()+')();':'')+(process.argv.includes('--observe-uniform-pointers')?'('+installNativeUniformPointerObserver.toString()+')();':'')+(mechanismPoses?'('+installNativeMechanismPoseObserver.toString()+')();':'')});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 if(cameraPreset)await evaluate('(()=>{const select=document.getElementById("camera-view");select.value='+JSON.stringify(cameraPreset)+';select.dispatchEvent(new Event("change",{bubbles:true}));})()');
 const select=item=>'Set WholeSetupObj=GetElementByName("'+item+'")';
 const setup=['Dim WholeSetupObj',...(!nativePrepass?['DisableStaticPrerendering=True']:[]),...items.filter(item=>item.kind==='Timer').flatMap(item=>[select(item.name),'WholeSetupObj.Enabled=False']),...items.filter(item=>item.kind==='LightSequencer').flatMap(item=>[select(item.name),'WholeSetupObj.StopPlay']),...items.filter(item=>item.kind==='Light'&&(!classicNames.includes(item.name)||allInserts)).flatMap(item=>[select(item.name),'WholeSetupObj.State=1']),...(!lit?classicNames:[]).flatMap(item=>[select(item),'WholeSetupObj.Visible=False'])];
 if(classicVariant)setup.push(...classicNames.flatMap(name=>[select(name),'WholeSetupObj.Color=&H2D8711','WholeSetupObj.ColorFull=&HF1A842','WholeSetupObj.IntensityScale=0.37']));
 if(imageModeLight)setup.push(select(imageModeLight),'WholeSetupObj.ImageMode=True');
 await native(setup.join(':'));await evaluate('(async()=>{for(let i=0;i<40;i++)await new Promise(requestAnimationFrame);})()');await call('Emulation.setFocusEmulationEnabled',{enabled:false});await evaluate('(async()=>{for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);nativeBallPresentation.install();})()');
 await native('Dim WholeObj,WholeValue,WholeText,WholeBalls,WholeBall:On Error Resume Next');
 const requested=items.flatMap(item=>(fields[item.kind]??[]).concat(imageModeLight&&item.kind==='Light'?['ImageMode']:[]).map(field=>({name:item.name,kind:item.kind,field}))),observedLines=new Set();
 const collect=async()=>{for(const line of (await evaluate('document.getElementById("log").textContent')).split(/\r?\n/))if(/WHOLE_(PROP|MISSING|BALL)\|/.test(line))observedLines.add(line);};
 for(let offset=0;offset<requested.length;offset+=8){
  const script=['On Error Resume Next'];
  for(const {name,field}of requested.slice(offset,offset+8)){
   const key=name+'|'+field,isString=['ImageA','ImageB','Filter'].includes(field),isBoolean=['Enabled','Visible','SideVisible','ShowBracket','IsDropped','BaseVisible','CapVisible','RingVisible','SkirtVisible','GetInPlayStateBool','AddBlend','ImageMode'].includes(field);
   script.push('Err.Clear','Set WholeObj=GetElementByName("'+name+'")','WholeValue=WholeObj.'+field,'WholeText='+(isString||isBoolean?'CStr(WholeValue)':'FormatNumber(WholeValue,12,-1,0,0)'),'If Err.Number=0 Then Debug.Print "WHOLE_PROP|'+key+'|" & WholeText Else Debug.Print "WHOLE_MISSING|'+key+'|" & Err.Description');
  }
  await native(script.join('\n'));await collect();
 }
 await native('WholeBalls=GetBalls:For Each WholeBall In WholeBalls:Debug.Print "WHOLE_BALL|" & WholeBall.ID & "|" & '+ballFields.map(field=>['Visible','ReflectionEnabled','ForceReflection','FrontDecal'].includes(field)?'CStr(WholeBall.'+field+')':'FormatNumber(WholeBall.'+field+',12,-1,0,0)').join(' & "|" & ')+':Next:On Error Goto 0');
 await collect();const stateLog=Array.from(observedLines).join('\n');
 await native('Debug.Print "WHOLE_STATIC_DISABLED|" & CStr(DisableStaticPrerendering)');
 const actualStaticDisabled=(await evaluate('document.getElementById("log").textContent')).match(/WHOLE_STATIC_DISABLED\|(True|False)/)?.[1];assert.ok(actualStaticDisabled,'Observe the actual source render mode');
 fs.writeFileSync(path.join(directory,'state-readback.json'),JSON.stringify({requested,stateLog}));
 for(const item of items.filter(item=>item.kind==='Timer'))assert.ok(stateLog.includes('WHOLE_PROP|'+item.name+'|Enabled|False'),'source timer stopped: '+item.name);
 if(!lit)for(const item of classicNames)assert.ok(stateLog.includes('WHOLE_PROP|'+item+'|Visible|False'),'source classic control applied: '+item);
 assert.equal([...stateLog.matchAll(/WHOLE_(?:PROP|MISSING)\|/g)].length,requested.length,'every requested native property is observed or explicitly missing');
 if(tracePixel)await evaluate('nativeWholeFrame.tracePixel='+JSON.stringify(tracePixel));
 if(process.argv.includes('--observe-light-geometry'))await evaluate('nativeWholeFrame.captureLightGeometry=true');
 await evaluate('nativeBallPresentation.armed=true;nativeWholeFrame.armed=true');
 await wait('nativeWholeFrame.done&&nativeBallPresentation.records.length>=7');
 const capture=await evaluate('({frame:nativeWholeFrame,balls:nativeBallPresentation,nativeTextures:nativePostprocess.textures,canvas:{width:document.getElementById("canvas").width,height:document.getElementById("canvas").height}})');
 const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());capture.engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');capture.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();capture.control={setup,classicNames,fields,requested,scope:'Explicit unlit-classic controlled native frame; all remaining bulb lights set on, timers/sequences stopped, then native physics defocused. Native shader commands, uniforms, buffers, body state and clocks execute unchanged.'};capture.stateLog=stateLog;capture.errors=errors;
 capture.control.classicMode=allInserts?'all-on':lit?'authored':'hidden';
 capture.control.nativePrepass=nativePrepass;capture.control.staticDisabled=actualStaticDisabled==='True';capture.control.allInserts=allInserts;
 capture.control.uniformAlignmentReference=alignmentReference;
 capture.control.classicVariant=classicVariant??'authored';
 capture.control.requestedQuality=requestedQuality;capture.control.imageModeLight=imageModeLight??null;
 capture.control.ballFields=ballFields;
 capture.control.cameraPreset=await evaluate('document.getElementById("camera-view").value');if(cameraPreset)assert.equal(capture.control.cameraPreset,cameraPreset);
 if(lit)capture.control.scope='Controlled native frame with classic inserts '+(allInserts?'explicitly set on.':'at authored visibility/state.')+' Non-classic bulbs set on, timers/sequences stopped, then physics defocused. '+(nativePrepass?'Original native static prerender mode retained.':'Static prerender explicitly disabled for the render-all control.')+' Native uniforms, draw commands, body state and clocks execute unchanged.';
 if(classicVariant)capture.control.scope+=' Explicit insert color and 0.37 intensity-scale variant.';
 for(const [key,image]of Object.entries(capture.frame.images)){const bytes=Buffer.from(image.bytes,'base64'),file=key+'.bin';fs.writeFileSync(path.join(directory,file),bytes);image.file=file;image.sha256=createHash('sha256').update(bytes).digest('hex');delete image.bytes;}
 if(process.argv.includes('--observe-uniform-pointers')){const pointers=await evaluate('nativeUniformPointers');assert.deepEqual(pointers.errors,[]);assert.ok(pointers.rows.length);pointers.engineSHA256=capture.engineSHA256;pointers.scope=alignmentReference?'Original CPU/import and incoming Emscripten bytes observed before the explicit alignment bridge; uploaded bytes observed afterward.':'Read-only original import pointers, original CPU bytes and unchanged WebGL uploads in this captured frame.';fs.writeFileSync(path.join(directory,'uniform-pointers.json'),JSON.stringify(pointers));console.log(JSON.stringify({uniformPointerRows:pointers.rows.length,basicRows:pointers.rows.filter(row=>row.basic).length,alignments:[...new Set(pointers.rows.map(row=>row.pointerAlignment))]}));}
 if(alignmentReference){const bridge=await evaluate('nativeUniformAlignmentReference');assert.deepEqual(bridge.errors,[]);bridge.sourceSHA256=createHash('sha256').update(installNativeUniformAlignmentReference.toString()).digest('hex');bridge.scope='Explicit reference WebGL byte-alignment compatibility only; original WASM/table/draws execute unchanged. Not an unmodified-GPU reference.';capture.control.alignmentBridge=bridge;capture.control.scope=capture.control.scope.replace('Native uniforms, draw commands, body state and clocks execute unchanged.','Native CPU uniform computations, draw commands, body state and clocks execute unchanged.')+' Explicit reference compatibility bridge reads unaligned glUniform*v data at the original WASM byte pointer; this is not an unchanged-WebGL capture.';fs.writeFileSync(path.join(directory,'uniform-alignment.json'),JSON.stringify(bridge));}
 if(mechanismPoses){const parts=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')).parts.filter(part=>part.spec.kind==='Bumper'),specs=[...new Map(parts.map(part=>[part.spec.name,part.spec])).values()],poses=await evaluate('nativeMechanismPoses.snapshot('+JSON.stringify(specs)+')');assert.deepEqual(poses.errors,[]);assert.equal(Object.keys(poses.latest).length,3);capture.mechanismPoses=poses;}
 fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(capture));await call('Page.captureScreenshot',{format:'png'}).then(result=>fs.writeFileSync(path.join(directory,'native.png'),Buffer.from(result.data,'base64')));
 console.log(JSON.stringify({directory,engine:capture.engineSHA256,canvas:capture.canvas,draws:capture.frame.draws.length,images:Object.fromEntries(Object.entries(capture.frame.images).map(([key,image])=>[key,{width:image.width,height:image.height,arrayType:image.arrayType}])),frameIndex:capture.frame.frameIndex,requested:requested.length,properties:[...stateLog.matchAll(/WHOLE_PROP\|/g)].length,missing:[...stateLog.matchAll(/WHOLE_MISSING\|/g)].length,ballRows:[...stateLog.matchAll(/WHOLE_BALL\|/g)].length,ballCallbacks:capture.balls.records.length,errors:[...errors,...capture.frame.errors,...capture.balls.errors]}));
 assert.deepEqual(errors,[]);assert.deepEqual(capture.frame.errors,[]);assert.deepEqual(capture.balls.errors,[]);assert.ok(capture.frame.images.hdr);assert.ok(capture.frame.images.depth);assert.ok(capture.frame.images.final);assert.ok(capture.balls.records.every(record=>record.clocks.length===0),'physics is defocused, so no ball extrapolation occurs');
}finally{socket.close();}
