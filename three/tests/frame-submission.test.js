import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createSimulationHost} from '../simulation-host.js';
import {connectSimulation} from '../game-runtime.js';

const assets=()=>({
  layout:JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),
  specs:JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),
  source:fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),
});
function workerAdapter(){
  const thread=new Worker(new URL('./helpers/simulation-worker.mjs',import.meta.url));
  const adapter={postMessage:message=>thread.postMessage(message),terminate:()=>thread.terminate()};
  thread.on('message',data=>adapter.onmessage?.({data}));
  thread.on('error',error=>adapter.onerror?.({message:error.message}));
  return adapter;
}

test('submission reads later physical bodies, retains removed kicker balls and excludes later births without advancing physics',async()=>{
  const messages=[],host=createSimulationHost(message=>messages.push(structuredClone(message)),{allowDebug:true});
  try{
    await host.receive({type:'init',assets:assets()});
    const game=host.game,free=game.spawn('BallRelease');
    game.kick('BallRelease',free,90,4);
    const freeRecord=game.records.at(-1),freeNative=game.nativeBall(freeRecord.body);
    freeNative.body.setTranslation({x:4.3,y:10,z:1},true);
    freeRecord.body.setLinvel({x:4,y:2,z:0},true);
    const held=game.spawn('HellHouse'),heldRecord=game.records.at(-1);
    await host.receive({type:'frame',retainSubmission:true,id:10});
    const prepared=messages.find(message=>message.type==='response'&&message.id===10).result;
    const scheduled=messages.filter(message=>message.type==='snapshot').at(-1).snapshot;
    await host.receive({type:'debug',action:'advance',ticks:5,id:11});
    const heldPosition={...game.nativeBall(heldRecord.body).sync()},heldVelocity={...heldRecord.body.linvel()};
    game.remove('HellHouse',held);
    const born=game.spawn('BallRelease'),position={...freeNative.sync()},velocity={...freeRecord.body.linvel()};
    const before={time:game.time,random:game.random.getState(),scriptRandom:game.rules.scriptRandom.getState(),positions:game.physicalRecords.map(record=>({...game.nativeBall(record.body).sync()}))};
    const snapshots=messages.filter(message=>message.type==='snapshot').length;
    await host.receive({type:'submission',frame:prepared.frame,id:12});
    const submission=messages.find(message=>message.type==='response'&&message.id===12).result;
    assert.equal(messages.filter(message=>message.type==='snapshot').length,snapshots,'a submission read does not publish a new scene');
    assert.deepEqual(submission.balls.map(ball=>ball.id),scheduled.renderBalls.map(ball=>ball.id),'prepared creation order and retained identities');
    assert.ok(!submission.balls.some(ball=>ball.id===born.id),'new physics balls wait for the next scheduled frame');
    const latest=submission.balls.find(ball=>ball.id===free.id);
    assert.deepEqual(latest.position,position);
    assert.deepEqual(latest.velocity,{x:Math.fround(velocity.x),y:Math.fround(-velocity.y),z:Math.fround(velocity.z)});
    assert.notDeepEqual(latest.position,scheduled.renderBalls.find(ball=>ball.id===free.id).position);
    const retired=submission.balls.find(ball=>ball.id===held.id);
    assert.deepEqual(retired.position,heldPosition,'removed Rapier body preserves native position bits');
    assert.deepEqual(retired.velocity,{x:Math.fround(heldVelocity.x),y:Math.fround(-heldVelocity.y),z:Math.fround(heldVelocity.z)});
    assert.equal(retired.locked,true,'retain the source locked flag before kicker membership is released');
    assert.deepEqual({time:game.time,random:game.random.getState(),scriptRandom:game.rules.scriptRandom.getState(),positions:game.physicalRecords.map(record=>({...game.nativeBall(record.body).sync()}))},before);
    await host.receive({type:'frame',retainSubmission:true,id:13});
    const next=messages.find(message=>message.type==='response'&&message.id===13).result;
    await host.receive({type:'submission',frame:next.frame,id:14});
    const nextBalls=messages.find(message=>message.type==='response'&&message.id===14).result.balls;
    assert.ok(nextBalls.some(ball=>ball.id===born.id));
    assert.ok(!nextBalls.some(ball=>ball.id===held.id));
  }finally{await host.receive({type:'dispose'});}
});

test('a real worker holds scheduled visuals while later ball data arrives and commits queued replies after their snapshots',async()=>{
  const worker=workerAdapter();let game;
  try{
    game=await connectSimulation(worker,{assets:assets()});
    game.start();await game.debug({action:'advance',ticks:2100});
    await game.rules.execute('Dim StagedBall:Set StagedBall=BallRelease.CreateBall:BallRelease.Kick 90,1:StagedBall.X=430:StagedBall.Y=900:StagedBall.Z=100:StagedBall.VelX=4:StagedBall.VelY=-2:StagedBall.AngMomZ=1000');
    const target=game.rules.objects.get('target010');await game.flush();
    const receive=worker.onmessage,incoming=[];let advanced=false;
    worker.onmessage=event=>{
      incoming.push(event.data);
      if(!advanced&&event.data.type==='response'&&event.data.result?.frame&&!event.data.result.balls){
        advanced=true;
        // Explicit controlled physical input between native preparation and
        // submission. This override exists only in the Node test bootstrap.
        worker.postMessage({type:'debug',action:'advance',ticks:20});
      }
      receive(event);
    };
    const scheduledTime=game.time,scheduledTarget=target.isdropped;
    const submission=await game.prepareSubmissionFrame();
    assert.equal(game.time,scheduledTime,'later physics snapshots stay queued during the prepared frame');
    assert.equal(game.rules.objects.get('target010'),target);
    assert.equal(target.isdropped,scheduledTarget);
    const later=incoming.filter(message=>message.type==='snapshot').at(-1);
    assert.ok(later.snapshot.time>scheduledTime);
    assert.deepEqual(submission.presentationClock,later.presentationClock);
    assert.deepEqual(submission.balls.map(ball=>ball.position),later.snapshot.renderBalls.map(ball=>ball.position));
    assert.notDeepEqual(game.renderBalls.map(ball=>ball.position),submission.balls.map(ball=>ball.position));
    assert.notDeepEqual(game.renderBalls.at(-1).orientation,later.snapshot.renderBalls.at(-1).orientation,'scheduled rotation remains earlier than physical orientation');
    let resolved=false,observed,commandId,timeout;
    const post=worker.postMessage;
    worker.postMessage=message=>{if(message.type==='execute')commandId=message.id;post(message);};
    const arrived=new Promise((resolve,reject)=>{
      timeout=setTimeout(()=>reject(Error('Worker command did not arrive')),5000);
      observed=()=>{clearTimeout(timeout);resolve();};
    });
    worker.onmessage=event=>{
      receive(event);
      if(event.data.type==='response'&&event.data.id===commandId)observed();
    };
    const command=game.rules.execute('Target010.IsDropped=True').then(()=>{resolved=true;assert.equal(!!target.isdropped,true,'reply observes its already-applied snapshot');});
    await arrived;
    assert.equal(resolved,false,'command response must wait while its snapshot is held');
    assert.equal(target.isdropped,scheduledTarget);
    await assert.rejects(game.prepareSubmissionFrame(),/already pending/);
    game.finishSubmissionFrame();await command;
    assert.equal(game.submission,undefined);
    assert.equal(game.time,later.snapshot.time);
    assert.equal(resolved,true);
    assert.equal(game.error,null);
    await game.prepareSubmissionFrame();game.finishSubmissionFrame();
  }finally{if(game)await game.dispose();else worker.terminate();}
});

test('disposing during frame preparation releases held messages and settles the frame request',async()=>{
  const worker=workerAdapter();let game;
  try{
    game=await connectSimulation(worker,{assets:assets()});
    const prepared=game.prepareSubmissionFrame(),rejected=assert.rejects(prepared,/closing/);
    await game.dispose();await rejected;
    assert.equal(game.submission,undefined);
  }finally{worker.terminate();}
});

test('game-over waits with its prepared scene, commits final state before the event and permits a physical replay',async()=>{
  const worker=workerAdapter(),events=[];let game;
  try{
    game=await connectSimulation(worker,{assets:assets()},event=>events.push({type:event.type,state:game?.state,score:game?.score}));
    game.start();await game.debug({action:'advance',ticks:2100});
    for(let ball=1;ball<3;ball++){
      await game.debug({action:'test-drain'});
      await game.debug({action:'advance',ticks:20000});
      await game.prepareSubmissionFrame();game.finishSubmissionFrame();
      assert.equal(game.ballNumber,ball+1);assert.equal(game.records.length,1);
    }
    await game.prepareSubmissionFrame();
    const receive=worker.onmessage,post=worker.postMessage;let finalId,observe;
    worker.postMessage=message=>{if(message.type==='debug'&&message.action==='advance')finalId=message.id;post(message);};
    const arrived=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Final physics response did not arrive')),10000);
      observe=()=>{clearTimeout(timeout);resolve();};
    });
    worker.onmessage=event=>{receive(event);if(event.data.type==='response'&&event.data.id===finalId)observe();};
    const drain=game.debug({action:'test-drain'}),advance=game.debug({action:'advance',ticks:20000});
    await arrived;
    assert.equal(game.state,'playing');
    assert.equal(events.filter(event=>event.type==='over').length,0,'game-over remains queued with its physical snapshot');
    game.finishSubmissionFrame();await Promise.all([drain,advance]);
    assert.equal(game.state,'over');assert.equal(game.records.length,0);
    const over=events.filter(event=>event.type==='over');assert.equal(over.length,1);assert.equal(over[0].state,'over');assert.equal(over[0].score,game.score);
    game.start();await game.debug({action:'advance',ticks:1700});
    const replay=await game.prepareSubmissionFrame();
    assert.equal(game.state,'playing');assert.equal(game.ballNumber,1);assert.equal(game.records.length,1);
    assert.ok(replay.bodies.has(game.records[0].body.handle));game.finishSubmissionFrame();
    assert.equal(game.error,null);
  }finally{if(game)await game.dispose();else worker.terminate();}
});
