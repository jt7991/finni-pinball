import {createFullGame} from './full-game.js';
import {STEP} from './game-constants.js';
import {describeGame,snapshotGame,snapshotSubmissionBall} from './game-snapshot.js';

// The same host runs in browser Workers and the Node protocol regression tests.
export function createSimulationHost(send,{allowDebug=false,now=()=>performance.now(),wallNow=()=>Date.now()}={}){
  let game,paused=true,disposed=false,fatal=false,timer,queued=false,anchorWall=0,anchorTick=0,tick=0,lastPublish=0;
  const epochMilliseconds=wallNow();let lastPhysicsMilliseconds=epochMilliseconds;
  let nextFrame=0,retainedFrame;
  const names=new Set(),queries=new Set(['bChooseBattle']),effects=[],objectStates=new Map();
  const stats={ticks:0,physicsMs:0,maxChunkMs:0,lagMs:0,snapshotMs:0,snapshots:0,snapshotObjectFields:0};
  const channel=new MessageChannel();
  function publish(){
    if(!game||disposed)return;
    const start=now(),snapshot=snapshotGame(game,names,queries,objectStates);
    stats.snapshotMs+=now()-start;
    stats.snapshots++;stats.snapshotObjectFields+=snapshot.objects.reduce((count,[,state])=>count+Object.keys(state).length,0);
    send({type:'snapshot',snapshot,effects:effects.splice(0),stats:{...stats},paused,presentationClock:{epochMilliseconds,lastPhysicsMilliseconds}});lastPublish=now();
  }
  function fail(error){
    fatal=true;paused=true;clearTimeout(timer);send({type:'fatal',message:error.message,stack:error.stack});
  }
  function enqueue(){if(!queued&&!disposed&&!paused&&!fatal){queued=true;channel.port2.postMessage(0);}}
  function pump(){
    queued=false;if(disposed||paused||fatal)return;
    try{
      const start=now(),due=anchorTick+Math.floor((start-anchorWall)/(STEP*1000));
      for(let count=0;tick<due&&count<4;count++){
        const before=now();lastPhysicsMilliseconds=wallNow();game.step();stats.physicsMs+=now()-before;tick++;stats.ticks++;
        if(now()-start>=4)break;
      }
      stats.maxChunkMs=Math.max(stats.maxChunkMs,now()-start);
      stats.lagMs=Math.max(0,(due-tick)*STEP*1000);
      if(now()-lastPublish>=8)publish();
      const next=anchorWall+(tick-anchorTick+1)*STEP*1000-now();
      if(next<=0)enqueue();else timer=setTimeout(enqueue,next);
    }catch(error){fail(error);}
  }
  channel.port1.onmessage=pump;
  function pause(value){
    if(paused===value)return;
    paused=value;clearTimeout(timer);
    if(!paused){anchorWall=now();anchorTick=tick;enqueue();}
  }
  async function init(message){
    if(game)throw Error('Simulation is already initialized');
    const stored=new Map(message.storage??[]),storage={load:key=>stored.has(key)?stored.get(key):'',save:(key,value)=>{stored.set(key,value);effects.push({type:'storage',key,value});}};
    let assets=message.assets;
    if(!assets){
      const load=async(name,json=true)=>{const response=await fetch(new URL(name,message.base));if(!response.ok)throw Error(`${name} could not be loaded.`);return json?response.json():response.text();};
      const [layout,specs,source]=await Promise.all([load('layout.json'),load('objects.json'),load('rules.vbs',false)]);assets={layout,specs,source};
    }
    game=await createFullGame(assets.layout,assets.specs,assets.source,event=>effects.push({type:'event',event}),{
      play:(name,settings)=>effects.push({type:'play',name,settings}),stop:name=>effects.push({type:'stop',name}),
    },{storage,frameAnimations:true});
    const description=describeGame(game);for(const [name,state]of description.objects)objectStates.set(name,{...state});send({type:'ready',description});publish();
  }
  function debug(command){
    if(!allowDebug)throw Error('Simulation inspection is unavailable in this build');
    if(command.action==='advance'){
      if(!paused)throw Error('Pause before advancing the simulation');
      if(!Number.isSafeInteger(command.ticks)||command.ticks<0||command.ticks>100000)throw Error('Invalid tick count');
      for(let i=0;i<command.ticks;i++){lastPhysicsMilliseconds=wallNow();game.step();tick++;stats.ticks++;}return;
    }
    if(command.action==='value')return game.rules.value(command.expression);
    if(command.action==='run')return game.rules.run(command.name,...(command.args??[]));
    if(command.action==='place'){
      const record=game.records.find(rec=>rec.body.handle===command.ballHandle);if(!record)throw Error('Ball no longer exists');
      for(const vector of [command.position,command.velocity])if(!vector||!['x','y','z'].every(axis=>Number.isFinite(vector[axis])))throw Error('Invalid ball state');
      game.nativeBall(record.body).body.setTranslation(command.position,true);record.body.setLinvel(command.velocity,true);record.body.setAngvel({x:0,y:0,z:0},true);return;
    }
    if(command.action==='inspect')return {
      time:game.time,random:game.random.getState?.(),scriptRandom:game.rules.scriptRandom.getState(),
      bodies:game.physicalRecords.map(rec=>{const native=game.nativeBall(rec.body);native.syncAngular();return {held:rec.held,position:{...native.sync()},velocity:{...rec.body.linvel()},momentum:{...native.angularMomentum},orientation:Array.from(native.orientation.matrix)};}),
    };
    throw Error('Unknown simulation inspection command');
  }
  async function receive(message){
    try{
      let result,bodyReadOnly=false;
      if(message.type==='init')await init(message);
      else{
        if(!game||disposed||fatal)throw Error('Simulation is unavailable');
        switch(message.type){
          case 'start':game.start();break;
          case 'input':game.input(message.action,message.down);break;
          case 'release':game.release();break;
          case 'pause':pause(message.value);break;
          case 'frame':
            game.prepareFrame();game.sync();
            if(message.retainSubmission){
              if(retainedFrame)throw Error('A prepared frame is already awaiting submission');
              retainedFrame={id:++nextFrame,records:game.physicalRecords.slice()};
              result={frame:retainedFrame.id};
            }
            break;
          case 'submission':
            if(!retainedFrame||retainedFrame.id!==message.frame)throw Error('Prepared frame is unavailable');
            result={frame:retainedFrame.id,balls:retainedFrame.records.map(record=>snapshotSubmissionBall(game,record)),paused,presentationClock:{epochMilliseconds,lastPhysicsMilliseconds}};
            retainedFrame=undefined;bodyReadOnly=true;
            break;
          case 'execute':game.rules.execute(message.statement);break;
          case 'subscribe':for(const name of message.names??[])names.add(name);for(const query of message.queries??[])queries.add(query);break;
          case 'debug':result=debug(message);break;
          case 'barrier':break;
          case 'dispose':retainedFrame=undefined;disposed=true;clearTimeout(timer);channel.port1.close();channel.port2.close();game.dispose();break;
          default:throw Error('Unknown simulation command');
        }
        if(!bodyReadOnly)publish();
      }
      if(message.id)send({type:'response',id:message.id,result});
    }catch(error){
      if(message.id)send({type:'response',id:message.id,error:error.message});
      if(!['debug'].includes(message.type))fail(error);
    }
  }
  return {receive,get game(){return game;}};
}
