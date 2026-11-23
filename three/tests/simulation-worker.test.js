import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {createFullGame} from '../full-game.js';
import {connectSimulation} from '../game-runtime.js';
import {snapshotGame} from '../game-snapshot.js';
import {nativeRandom} from '../native-random.js';
import {createSimulationHost} from '../simulation-host.js';

const assets=()=>({layout:JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),specs:JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),source:fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8')});
function workerAdapter(){
  const thread=new Worker(new URL('./helpers/simulation-worker.mjs',import.meta.url));
  const adapter={postMessage:message=>thread.postMessage(message),terminate:()=>thread.terminate()};
  thread.on('message',data=>adapter.onmessage?.({data}));thread.on('error',error=>adapter.onerror?.({message:error.message}));
  return adapter;
}
function inspect(game){return {time:game.time,random:game.random.getState(),scriptRandom:game.rules.scriptRandom.getState(),bodies:game.physicalRecords.map(rec=>{
  const native=game.nativeBall(rec.body);native.syncAngular();return {held:rec.held,position:{...native.sync()},velocity:{...rec.body.linvel()},momentum:{...native.angularMomentum},orientation:Array.from(native.orientation.matrix)};
})};}

test('presentation timestamps record actual physical-step wall time and remain unchanged by snapshot publication',async()=>{
 let wall=5000;const messages=[],host=createSimulationHost(message=>messages.push(message),{allowDebug:true,now:()=>0,wallNow:()=>wall});try{await host.receive({type:'init',assets:assets()});assert.deepEqual(messages.filter(m=>m.type==='snapshot').at(-1).presentationClock,{epochMilliseconds:5000,lastPhysicsMilliseconds:5000});wall=5007;await host.receive({type:'debug',action:'advance',ticks:1,id:1});let message=messages.filter(m=>m.type==='snapshot').at(-1);assert.deepEqual(message.presentationClock,{epochMilliseconds:5000,lastPhysicsMilliseconds:5007});assert.equal(message.snapshot.time,0);wall=7000;await host.receive({type:'barrier',id:2});message=messages.filter(m=>m.type==='snapshot').at(-1);assert.deepEqual(message.presentationClock,{epochMilliseconds:5000,lastPhysicsMilliseconds:5007});assert.equal(message.paused,true);}finally{await host.receive({type:'dispose',id:3});}
});

test('real worker preserves every body, native RNG, authored rules, DMD, audio and control order',async()=>{
  const fixture=assets(),events=[],directEvents=[],sounds=[],directSounds=[];
  const local=await createFullGame(structuredClone(fixture.layout),structuredClone(fixture.specs),fixture.source,event=>directEvents.push(event),{play:(name,settings)=>directSounds.push(['play',name,settings]),stop:name=>directSounds.push(['stop',name])},{storage:{load:()=>'',save:()=>{}},frameAnimations:true});
  const worker=workerAdapter();let remote;
  try{
    remote=await connectSimulation(worker,{assets:fixture},event=>events.push(event),{play:(name,settings)=>sounds.push(['play',name,settings]),stop:name=>sounds.push(['stop',name])});
    local.random=nativeRandom(12345,67890);
    local.rules.scriptRandom.rnd(-1);local.rules.scriptRandom.randomize(123.5);local.rules.engine._registerFunction('Timer',()=>({type:'Single',value:123.5}));
    local.rules.execute('Song=""');
    await remote.debug({action:'test-prepare'});
    // Script wall-clock initialization can select different attract music.
    // Compare subsequent effects after installing the common measurement
    // stream and clearing that prior song.
    assert.ok(sounds.some(s=>s[0]==='play'),'initial audio crossed the worker boundary');
    sounds.length=0;directSounds.length=0;
    const digits=Array.from({length:41},(_,i)=>`digit${String(i+1).padStart(3,'0')}`);
    for(const name of digits)remote.rules.objects.get(name);await remote.flush();
    const compare=async()=>{
      assert.deepEqual(await remote.debug({action:'inspect'}),inspect(local));
      assert.deepEqual(remote.renderBalls,local.physicalRecords.map(rec=>{const native=local.nativeBall(rec.body),v=rec.body.linvel(),f=Math.fround;return{id:rec.body.handle,position:{...native.sync()},velocity:{x:f(v.x),y:f(-v.y),z:f(v.z)},orientation:native.orientation.matrix.slice(),radius:25,locked:!!rec.held&&rec.held!=='lane',...rec.render};}),'all source ball positions, velocities, original orientation bits and visual properties cross the worker');
      assert.ok(Number.isInteger(remote.presentationClock.epochMilliseconds));assert.ok(remote.presentationClock.lastPhysicsMilliseconds>=remote.presentationClock.epochMilliseconds);
      assert.equal(remote.plungerPosition,local.plunger.pos,'native plunger position crosses the worker boundary');
      assert.deepEqual(remote.cabinetOffset,local.cabinetNudge.nativeOffset,'native metre displacement crosses the worker boundary');
      for(const [name,motion]of local.visualMotions)assert.deepEqual(remote.visualMotions.get(name),motion.snapshot(),name+' visual frame state');
      for(const key of ['state','score','player','ballNumber','charge','inLane','tilted','gameState','held'])assert.deepEqual(remote[key],local[key],key);
      for(const name of digits)assert.equal(remote.rules.objects.get(name).imagea,local.rules.objects.get(name).imagea,name);
      assert.deepEqual(events,directEvents);assert.equal(sounds.length,directSounds.length);
      for(let i=0;i<sounds.length;i++)assert.deepEqual(sounds[i],directSounds[i],`ordered audio effect ${i}`);
    };
    const advance=async ticks=>{for(let i=0;i<ticks;i++)local.step();await remote.debug({action:'advance',ticks});local.prepareFrame();local.sync();await remote.prepareFrame();await compare();};
    const input=async(action,down)=>{local.input(action,down);remote.input(action,down);await remote.flush();await compare();};
    local.start();remote.start();await remote.flush();await advance(2100);
    assert.equal(remote.inLane,true);
    await input('launch',true);await advance(550);
    local.release();remote.release();await remote.flush();await advance(150);
    assert.equal(remote.charge,0);assert.equal(remote.held.launch,false);
    await input('launch',true);await advance(1000);await input('launch',false);await advance(750);
    await input('left',true);await input('right',true);await advance(40);await input('left',false);await advance(80);
    local.release();remote.release();await remote.flush();await compare();
    await input('nudgeLeft',true);await advance(17);assert.notEqual(remote.cabinetOffset.x,0,'real input reaches native cabinet motion');await input('nudgeLeft',false);await advance(200);
    local.rules.run('AddMultiball',2);await remote.debug({action:'run',name:'AddMultiball',args:[2]});await advance(2500);
    assert.ok(remote.records.length>=2,'complete runtime creates overlapping physical balls');
    const target=remote.targetMotions.get('target010'),flipper=remote.flippers[0],digit=remote.rules.objects.get('digit001');
    const statement='Target010.Collidable=False:Target010.IsDropped=True';local.rules.execute(statement);await remote.rules.execute(statement);await advance(65);
    assert.equal(remote.targetMotions.get('target010'),target);assert.equal(remote.flippers[0],flipper);assert.equal(remote.rules.objects.get('digit001'),digit);assert.equal(target.offset,-52);
    const standup=remote.targetMotions.get('target001'),spec=fixture.specs.objects.find(s=>s.name==='Target001'),front=Math.max(...spec.collision_mesh.vertices.map(v=>v[1]))*spec.size.y;
    assert.equal(remote.targetMotions.size,14);assert.equal(standup.drop,false);assert.equal(standup.rotZ,-90);
    const position={x:(spec.position.x+front+25.01)*.01,y:(2115-(spec.position.y-spec.size.x*.4))*.01,z:.45},velocity={x:-8,y:0,z:0},record=local.records[0];
    local.nativeBall(record.body).body.setTranslation(position,true);record.body.setLinvel(velocity,true);record.body.setAngvel({x:0,y:0,z:0},true);
    await remote.debug({action:'place',ballHandle:remote.records[0].body.handle,position,velocity});await advance(17);
    assert.equal(remote.targetMotions.get('target001'),standup,'stand-up render reference stays stable');assert.ok(standup.offset>0&&standup.offset<=13,'physical face contact reaches the worker animation');
    await advance(17);assert.equal(standup.offset,13);await advance(40);assert.equal(standup.offset,0,'native stand-up returns to rest');
    const lamp=remote.rules.objects.get('li044');await remote.flush();
    const sequenceStatement=fixture.specs.objects.filter(s=>s.kind==='LightSequencer').map(s=>s.name+'.StopPlay').join(':')+':li044.State=2:LightSeqGi.UpdateInterval=20:LightSeqGi.Play SeqRandom,7,,200:LightSeqInserts.UpdateInterval=8:LightSeqInserts.Play SeqDownOn,25,1';
    local.rules.execute(sequenceStatement);await remote.rules.execute(sequenceStatement);
    for(let frame=0;frame<30;frame++){
      await advance(17);
      const expected=local.rules.objects.get('li044');
      for(const field of ['state','sequenceactive','sequencestate','inplayintensity','inplayon','intensityscale','blinkpattern','colorfull'])assert.equal(lamp[field],expected[field],`worker lamp ${field}`);
    }
    assert.equal(remote.rules.objects.get('li044'),lamp,'sequence snapshots retain the subscribed render object');
    const bumper=remote.visualMotions.get('bumper1');local.rules.execute('Bumper1.PlayHit');await remote.rules.execute('Bumper1.PlayHit');await advance(17);assert.equal(remote.visualMotions.get('bumper1'),bumper,'render motion object stays stable');assert.ok(bumper.ringOffset<0,'source PlayHit depresses the native ring');await advance(200);
    const description=snapshotGame(local,new Set(digits),new Set(['bChooseBattle']));assert.doesNotThrow(()=>structuredClone(description));
  }finally{local.dispose();if(remote)await remote.dispose();else worker.terminate();}
});

test('worker delivers final state before game-over and starts a physical replay',async()=>{
  const worker=workerAdapter(),events=[];let game;
  try{
    game=await connectSimulation(worker,{assets:assets()},event=>events.push({type:event.type,state:game?.state,score:game?.score}));
    game.start();await game.debug({action:'advance',ticks:2100});
    for(let ball=1;ball<=3;ball++){
      assert.equal(game.records.length,1,`ball ${ball} physically released`);assert.equal(game.inLane,true);
      await game.debug({action:'test-drain'});await game.debug({action:'advance',ticks:20000});
    }
    assert.equal(game.state,'over');assert.equal(game.records.length,0);
    const over=events.filter(event=>event.type==='over');assert.equal(over.length,1);assert.equal(over[0].state,'over');assert.equal(over[0].score,game.score);
    game.start();await game.debug({action:'advance',ticks:1700});assert.equal(game.state,'playing');assert.equal(game.ballNumber,1);assert.equal(game.records.length,1);
  }finally{if(game)await game.dispose();else worker.terminate();}
});

test('worker restores saved high scores and commits ordered storage writes before a barrier',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),writes=[],memory=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(key,value)=>{memory.set(key,value);writes.push([key,value]);}}});
  const worker=workerAdapter();let game;
  try{
    game=await connectSimulation(worker,{assets:assets(),storage:[['HighScore1',987654321],['HighScore1Name','ABC']]});
    assert.equal(await game.debug({action:'value',expression:'HighScore(0)'}),987654321);
    assert.equal(await game.debug({action:'value',expression:'HighScoreName(0)'}),'ABC');
    await game.rules.execute('SaveValue "fixture", "WorkerProbe", 123:SaveValue "fixture", "WorkerProbe", 456');await game.flush();
    assert.deepEqual(writes.filter(([key])=>key==='finni-three-rule-WorkerProbe'),[['finni-three-rule-WorkerProbe','123'],['finni-three-rule-WorkerProbe','456']]);
    assert.equal(memory.get('finni-three-rule-WorkerProbe'),'456');
  }finally{if(game)await game.dispose();else worker.terminate();if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});

test('worker clock pauses without advancing hidden time, resumes and cancels held controls',async()=>{
  const worker=workerAdapter();let game;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    game=await connectSimulation(worker,{assets:assets()});
    const initial=game.time;await sleep(60);await game.flush();assert.equal(game.time,initial,'initial asset loading stays paused');
    game.start();await game.debug({action:'advance',ticks:2100});game.input('left',true);game.input('launch',true);await game.flush();
    assert.equal(game.held.left,true);assert.equal(game.held.launch,true);
    game.setPaused(false);await sleep(100);game.release();game.setPaused(true);await game.flush();
    const paused=game.time;assert.ok(paused>initial);assert.equal(game.held.left,false);assert.equal(game.held.launch,false);
    await sleep(100);await game.flush();assert.equal(game.time,paused,'pause discards wall time');
    const resumedAt=performance.now();game.setPaused(false);await sleep(50);game.setPaused(true);await game.flush();
    assert.ok(game.time>paused);assert.ok((game.time-paused)*1000<=performance.now()-resumedAt+10,'resume does not replay paused wall time');
    assert.ok(game.runtimeStats.ticks>0);assert.equal(game.error,null);
  }finally{if(game)await game.dispose();else worker.terminate();}
});
