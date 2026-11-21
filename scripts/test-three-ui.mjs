import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0,pageTransferred=0,workerTransferred=0;const pending=new Map(),errors=[],requests=[],measurements=[];
socket.addEventListener('message',async event=>{
  const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}
  if(d.method==='Runtime.exceptionThrown')errors.push(d.params);
  if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);
  if(d.method==='Network.loadingFinished'){if(d.sessionId)workerTransferred+=d.params.encodedDataLength;else pageTransferred+=d.params.encodedDataLength;}
  if(d.method==='Target.attachedToTarget'){
    const session=d.params.sessionId;
    try{await call('Network.enable',{},session);await call('Network.setCacheDisabled',{cacheDisabled:true},session);}
    catch(error){errors.push({workerNetwork:error.message});}
    finally{await call('Runtime.runIfWaitingForDebugger',{},session);}
  }
});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const touch=points=>call('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:4,radiusY:4,force:1}))});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.testDraws=0;for(const Context of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=Context.prototype.drawElements;Context.prototype.drawElements=function(...args){window.testDraws++;return draw.apply(this,args);};}`});
  for(const [width,height,name]of [[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape'],[1440,900,'desktop']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:name!=='desktop'});
    await call('Emulation.setTouchEmulationEnabled',{enabled:name!=='desktop',maxTouchPoints:5});
    pageTransferred=0;workerTransferred=0;const started=Date.now();
    await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
    await wait('window.testDraws>0');
    const measurement={viewport:name,coldStartupMs:Date.now()-started,transferredBytes:pageTransferred+workerTransferred,pageTargetTransferredBytes:pageTransferred,workerTargetsTransferredBytes:workerTransferred,pageTargetJSHeapBytes:await evaluate('performance.memory?.usedJSHeapSize??null')};measurements.push(measurement);console.log('STARTUP',JSON.stringify(measurement));
    await evaluate('document.getElementById("play").click()');
    await wait('document.body.classList.contains("ball-in-plunger")');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name} no overflow`);
    if(name==='phone'||name==='small-phone'){
      const left=await center('#flip-zones [data-input=left]'),right=await center('#flip-zones [data-input=right]');
      await touch([left,right]);assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),2);
      if(await evaluate('!!window.finniThree?.game.workerSimulation')){
        await evaluate('finniThree.game.flush()');assert.equal(await evaluate('finniThree.game.held.left&&finniThree.game.held.right'),true,'both physical flippers held');
      }
      await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),0);
      if(await evaluate('!!window.finniThree?.game.workerSimulation')){
        await evaluate('finniThree.game.flush()');assert.equal(await evaluate('finniThree.game.held.left||finniThree.game.held.right'),false,'physical flippers release after touch cancellation');
        await touch([left]);await evaluate('window.dispatchEvent(new Event("blur"));finniThree.game.flush()');await touch([]);
        assert.equal(await evaluate('finniThree.game.held.left'),false,'focus loss releases physical flipper');
        const pausedAt=await evaluate('finniThree.game.time');await new Promise(r=>setTimeout(r,100));assert.equal(await evaluate('finniThree.game.time'),pausedAt,'worker stops during focus loss');
        await evaluate('window.dispatchEvent(new Event("focus"))');await wait(`finniThree.game.time>${pausedAt}`);
      }
      const launch=await center('#launch');await touch([launch]);await new Promise(r=>setTimeout(r,500));await touch([]);
    }else{
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});
      assert.ok(await evaluate('document.querySelector("[data-input=left]").classList.contains("pressed")'));
      await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(r=>setTimeout(r,500));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});
    }
    await wait('!document.body.classList.contains("ball-in-plunger")');
    if(name==='phone'&&await evaluate('!!window.finniThree?.game.workerSimulation')){
      await evaluate(`(()=>{const g=finniThree.game,r=g.records.find(r=>!r.held);return g.debug({action:'place',ballHandle:r.body.handle,position:{x:g.scoop.x,y:g.scoop.y,z:.27},velocity:{x:0,y:0,z:0}});})()`);
      await wait('finniThree.game.rules.value("bChooseBattle")');
      const before=await evaluate('finniThree.game.debug({action:"value",expression:"Battlenr"})');
      const right=await center('#flip-zones [data-input=right]');await touch([right]);await touch([]);await evaluate('finniThree.game.flush()');
      assert.notEqual(await evaluate('finniThree.game.debug({action:"value",expression:"Battlenr"})'),before,'touch chooses authored mission');
      const action=await center('[data-input=action]');await touch([action]);await touch([]);await evaluate('finniThree.game.flush()');
      assert.ok(await evaluate('finniThree.game.debug({action:"value",expression:"Battle(CurrentPlayer,0)"})')>0,'Action starts authored mission');
      await wait('finniThree.game.records.some(r=>!r.held)');console.log('PASS worker scoop capture, physical mission selection and Action');
    }
    if(name!=='desktop')await evaluate('document.getElementById("touch-help").click();document.querySelector("#touch-guide [popovertarget=controls-panel]").click()');
    else await evaluate('document.getElementById("settings").click()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    await evaluate('document.getElementById("controls-panel").hidePopover()');
    if(name!=='desktop')await evaluate('document.getElementById("dismiss-touch-guide").click()');
    await writeFile(`${output}/main-ui-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('PASS',name,'main UI, real controls, launch and settings');
  }
  if(await evaluate('!!window.finniThree')){
    await evaluate('document.getElementById("controls-panel").showPopover()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    const animation=await evaluate(`(async()=>{
      const {game,view}=finniThree,render=view.renderer.render;let scene;
      if(game.workerSimulation){game.setPaused(true);await game.flush();}
      try{view.renderer.render=function(s,c){scene=s;return render.call(this,s,c);};view.render(1);}finally{view.renderer.render=render;}
      const parts=[...game.spinners,...game.gates.filter(g=>g.spec.is_visible)].map(spinner=>{
        const plate=scene.getObjectByName(spinner.spec.name+(spinner.spec.kind==='Gate'?'Wire':'Plate'));if(!plate)return {name:spinner.spec.name,missing:true};
        const saved=spinner.angle,position=plate.position.clone();spinner.angle=0;view.render(1);const start=plate.quaternion.clone();
        spinner.angle=Math.PI/2;view.render(1);const rotation=start.angleTo(plate.quaternion),axleMovement=position.distanceTo(plate.position);
        spinner.angle=saved;view.render(1);return {name:plate.name,rotation,axleMovement};
      });
      const state=game.rules.objects.get('target010'),motion=game.targetMotions.get('target010'),mesh=scene.getObjectByName('Target010'),collidable=motion.collidable;
      const advance=async ticks=>{if(game.workerSimulation){await game.debug({action:'advance',ticks});await game.prepareFrame();}else for(let ms=0;ms<ticks;ms++)game.step();};
      const set=async statement=>{await game.rules.execute(statement);};
      await set('Target010.Collidable=False');await advance(100);await set('Target010.IsDropped=False');await advance(100);view.render(1);const up=mesh.position.y;
      await set('Target010.IsDropped=True');await advance(25);view.render(1);const middle={offset:motion.offset,delta:mesh.position.y-up};
      await advance(40);view.render(1);const end={offset:motion.offset,delta:mesh.position.y-up};await set('Target010.Collidable='+ (collidable?'True':'False'));
      const specs=(await(await fetch(new URL('objects.json',location.href))).json()).objects,standups=[];
      for(const name of ['Target001','Target005','Target013']){
        const spec=specs.find(s=>s.name===name),target=game.targetMotions.get(name.toLowerCase()),node=scene.getObjectByName(name),pivot=node.position.clone(),geometry=node.geometry.uuid;
        await set(name+'.Collidable=False:'+name+'.IsDropped=False');await advance(100);await advance(100);view.render(1);const rest=node.quaternion.clone();
        await set(name+'.Visible=False:'+name+'.Collidable=True');
        const a=spec.rot_z*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},t={x:Math.cos(a),y:Math.sin(a)},front=Math.max(...spec.collision_mesh.vertices.map(v=>v[1]))*spec.size.y,record=game.records.find(r=>!r.held);
        if(!record)throw Error('Stand-up test requires an active playable ball');
        const place=async(z,tangent)=>game.debug({action:'place',ballHandle:record.body.handle,position:{x:(spec.position.x+n.x*(front+25.01)+t.x*tangent)*.01,y:(2115-(spec.position.y+n.y*(front+25.01)+t.y*tangent))*.01,z:z*.01},velocity:{x:-n.x*8,y:n.y*8,z:0}});
        const before=game.score;await place(45,spec.size.x*.4);await advance(17);view.render(1);const hidden={visible:node.visible,offset:target.offset,scoreDelta:game.score-before};
        await set(name+'.Visible=True');await advance(17);view.render(1);const first={offset:target.offset,angle:rest.angleTo(node.quaternion)};
        await advance(17);view.render(1);const peak={offset:target.offset,angle:rest.angleTo(node.quaternion)};
        await advance(40);view.render(1);const settled={offset:target.offset,angle:rest.angleTo(node.quaternion)};
        let point;
        if(name==='Target001'){const score=game.score;await place(25,0);await advance(17);view.render(1);point={offset:target.offset,angle:rest.angleTo(node.quaternion),scoreDelta:game.score-score};}
        standups.push({name,drop:target.drop,rotZ:target.rotZ,hidden,first,peak,settled,point,pivotMovement:pivot.distanceTo(node.position),sameGeometry:geometry===node.geometry.uuid});
      }
      await set(specs.filter(s=>s.kind==='LightSequencer').map(s=>s.name+'.StopPlay').join(':'));
      const lamp=game.rules.objects.get('li044');
      await set('li044.State=2:LightSeqInserts.Play SeqAllOff');if(game.workerSimulation)await game.flush();view.render(1);
      const sequenceOff={script:lamp.state,locked:lamp.sequenceactive,display:lamp.sequencestate};
      await set('li044.State=1:LightSeqInserts.StopPlay');if(game.workerSimulation)await game.flush();view.render(1);
      const sequenceRestored={script:lamp.state,locked:lamp.sequenceactive};
      await set('LightSeqInserts.UpdateInterval=20:LightSeqInserts.Play SeqBlinking,,2,10');
      await advance(17);await advance(17);await advance(17);view.render(1);
      const sequenceBlink={script:lamp.state,locked:lamp.sequenceactive,display:lamp.sequencestate};
      await set('LightSeqInserts.StopPlay');
      return {parts,target:{middle,end},standups,sequences:{off:sequenceOff,restored:sequenceRestored,blink:sequenceBlink}};
    })()`);
    const plates=animation.parts;
    assert.deepEqual(animation.sequences.off,{script:2,locked:true,display:0});
    assert.deepEqual(animation.sequences.restored,{script:1,locked:false});
    assert.deepEqual(animation.sequences.blink,{script:1,locked:true,display:1});
    await writeFile(`${output}/light-sequence-animation.json`,JSON.stringify(animation.sequences,null,2));console.log('PASS native light sequence overrides, saved script state and worker render-frame blinking');
    assert.equal(plates.length,4);
    for(const plate of plates){assert.equal(plate.missing,undefined);assert.ok(Math.abs(plate.rotation-Math.PI/2)<1e-6);assert.equal(plate.axleMovement,0);}
    await writeFile(`${output}/mechanism-animation.json`,JSON.stringify(plates,null,2));console.log('PASS original spinner plates and gate wires rotate around fixed axles');
    assert.ok(animation.target.middle.offset<0&&animation.target.middle.offset>-52,'visible target moves progressively');
    assert.ok(Math.abs(animation.target.middle.delta-animation.target.middle.offset*.00053975)<1e-8);
    assert.equal(animation.target.end.offset,-52);assert.ok(Math.abs(animation.target.end.delta+52*.00053975)<1e-8,'native 52 VPU target travel');
    await writeFile(`${output}/target-animation.json`,JSON.stringify(animation.target,null,2));console.log('PASS original drop-target mesh follows native animation travel');
    for(const target of animation.standups){
      assert.equal(target.drop,false);assert.equal(target.hidden.visible,false);assert.equal(target.hidden.offset,0);assert.ok(target.hidden.scoreDelta>0,'hidden physical face still scores');
      assert.equal(target.first.offset,8.5);assert.ok(Math.abs(target.first.angle-8.5*Math.PI/180)<1e-7);
      assert.equal(target.peak.offset,13);assert.ok(Math.abs(target.peak.angle-13*Math.PI/180)<1e-7);
      assert.equal(target.settled.offset,0);assert.ok(target.settled.angle<1e-7);assert.equal(target.pivotMovement,0);assert.equal(target.sameGeometry,true);
      if(target.point){assert.ok(target.point.scoreDelta>0);assert.equal(target.point.offset,0);assert.ok(target.point.angle<1e-7,'vertex hit does not arm a stand-up bounce');}
    }
    await writeFile(`${output}/standup-animation.json`,JSON.stringify(animation.standups,null,2));console.log('PASS original stand-up meshes receive physical face hits, hidden queues and fixed-pivot native bounce');
  }
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/table\.vpx|vpinball\.(wasm|js)/.test(url)),false);
  await writeFile(`${output}/main-ui-startup.json`,JSON.stringify(measurements,null,2));
}finally{socket.close();}
