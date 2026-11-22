// Main-thread view of the complete game. Every command is applied in order in
// the simulation worker. Stable object references let the existing scene bind
// to targets, lights and mechanisms once, just as it did to the local engine.
export async function createRuntimeGame(base,emit,media){
  const worker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
  const stored=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key?.startsWith('finni-three-rule-'))continue;
      try{stored.push([key.slice('finni-three-rule-'.length),JSON.parse(localStorage.getItem(key))]);}catch{}
    }
  }catch{}
  return connectSimulation(worker,{base:new URL(base,location.href).href,storage:stored},emit,media);
}

export function connectSimulation(worker,init,emit=()=>{},media){
  let next=0,initialized=false,resolveReady,rejectReady,paused=true,subscriptionsQueued=false;
  let preparingFrame=false,closing=false,frameHold;
  const pending=new Map(),bodies=new Map(),names=new Set(),queries=new Set(['bChooseBattle']),values=new Map();
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const game={workerSimulation:true,nativeDisplacements:true,error:null,records:[],targetMotions:new Map(),runtimeStats:{},time:0};
  function fail(error){
    game.error=error;if(!initialized)rejectReady(error);
    frameHold=undefined;game.submission=undefined;
    for(const entry of pending.values())entry.reject(error);pending.clear();
    worker.terminate();
  }
  function post(message){if(game.error)throw game.error;worker.postMessage(message);}
  function request(message,{holdAfterResponse=false}={}){return new Promise((resolve,reject)=>{
    const id=++next;pending.set(id,{resolve,reject,holdAfterResponse});
    try{post({...message,id});}catch(error){pending.delete(id);reject(error);}
  });}
  function subscribe(){
    if(subscriptionsQueued)return;subscriptionsQueued=true;
    queueMicrotask(()=>{subscriptionsQueued=false;if(!game.error)post({type:'subscribe',names:[...names],queries:[...queries]});});
  }
  class RenderObjects extends Map{
    get(name){if(!names.has(name)){names.add(name);subscribe();}return super.get(name);}
  }
  const objects=new RenderObjects();
  game.rules={objects,value(query){if(!queries.has(query)){queries.add(query);subscribe();}return values.get(query);},
    execute(statement){return request({type:'execute',statement}).catch(error=>{fail(error);});}};
  function body(state){
    let result=bodies.get(state.id);
    if(!result){result={handle:state.id,translation(){return this.p;},rotation(){return this.q;}};bodies.set(state.id,result);}
    result.p=state.p;result.q=state.rotation;return result;
  }
  function apply(snapshot){
    const {ball,records,flippers,spinners,gates,targets,visualMotions,objects:states,values:queryValues,...root}=snapshot;
    Object.assign(game,root);game.ball=body(ball);
    game.records=records.map(record=>({body:body(record),previous:record.previous,held:record.held,inLane:record.inLane}));
    const retained=new Set([ball.id,...records.map(r=>r.id)]);for(const id of bodies.keys())if(!retained.has(id))bodies.delete(id);
    flippers.forEach((angle,i)=>{game.flippers[i].angle=angle;});
    spinners.forEach((angle,i)=>{game.spinners[i].angle=angle;});gates.forEach((angle,i)=>{game.gates[i].angle=angle;});
    for(const [name,offset,revision]of targets)Object.assign(game.targetMotions.get(name),{offset,revision});
    for(const [name,state]of visualMotions)Object.assign(game.visualMotions.get(name),state);
    for(const [name,state]of states)Object.assign(Map.prototype.get.call(objects,name),state);
    for(const [query,value]of queryValues)values.set(query,value);
  }
  function receive(data){
    try{
      // Preserve the scheduled scene while the ordered body-only read runs.
      // Replies wait with their snapshots, so callers never observe a stale
      // scene after a command promise has resolved.
      if(frameHold&&(data.type==='snapshot'||data.type==='response'&&data.id!==frameHold.responseId)){
        frameHold.messages.push(data);return;
      }
      if(data.type==='ready'){
        const {objects:states,targetMotions,visualMotions,...description}=data.description;Object.assign(game,description);
        for(const [name,state]of states)objects.set(name,state);
        game.targetMotions=new Map(targetMotions);
        game.visualMotions=new Map(visualMotions);
      }else if(data.type==='snapshot'){
        apply(data.snapshot);game.runtimeStats=data.stats;game.simulationPaused=data.paused;game.presentationClock=data.presentationClock;
        // Publish the resulting score and state before delivering lifecycle events.
        for(const effect of data.effects){
          if(effect.type==='event')emit(effect.event);
          else if(effect.type==='play')media?.play(effect.name,effect.settings);
          else if(effect.type==='stop')media?.stop(effect.name);
          else if(effect.type==='storage')try{localStorage.setItem(`finni-three-rule-${effect.key}`,JSON.stringify(effect.value));}catch{}
        }
        if(!initialized){initialized=true;resolveReady(game);}
      }else if(data.type==='response'){
        const entry=pending.get(data.id);if(!entry)return;pending.delete(data.id);
        if(entry.holdAfterResponse&&!data.error)frameHold={messages:[],responseId:null};
        data.error?entry.reject(Error(data.error)):entry.resolve(data.result);
      }else if(data.type==='fatal')fail(Error(data.message));
    }catch(error){fail(error);}
  }
  worker.onmessage=({data})=>receive(data);
  worker.onerror=event=>fail(Error(event.message||'Simulation worker failed'));
  worker.onmessageerror=()=>fail(Error('Simulation data could not be read'));
  game.start=()=>post({type:'start'});game.input=(action,down)=>post({type:'input',action,down});game.release=()=>{if(!game.error)post({type:'release'});};
  game.setPaused=value=>{if(paused!==value){paused=value;if(!game.error)post({type:'pause',value});}};
  game.flush=()=>request({type:'barrier'});
  game.prepareFrame=()=>request({type:'frame'});
  Object.defineProperty(game,'presentationPaused',{get:()=>paused});
  game.finishSubmissionFrame=()=>{
    const held=frameHold;frameHold=undefined;game.submission=undefined;
    if(held&&!game.error)for(const data of held.messages)receive(data);
  };
  game.prepareSubmissionFrame=async()=>{
    if(closing)throw Error('Simulation is closing');
    if(preparingFrame||frameHold)throw Error('A render frame is already pending');
    preparingFrame=true;
    try{
      const prepared=await request({type:'frame',retainSubmission:true},{holdAfterResponse:true});
      if(closing)throw Error('Simulation is closing');
      frameHold.responseId=next+1;
      const submission=await request({type:'submission',frame:prepared.frame});
      if(closing)throw Error('Simulation is closing');
      game.submission={...submission,bodies:new Map(submission.balls.map(ball=>[ball.id,ball]))};
      return game.submission;
    }catch(error){game.finishSubmissionFrame();throw error;}
    finally{preparingFrame=false;}
  };
  game.nativeBall=body=>({orientation:{rotation:()=>body.rotation()}});
  game.debug=command=>request({type:'debug',...command});
  game.dispose=async()=>{closing=true;game.finishSubmissionFrame();try{await request({type:'dispose'});}finally{worker.terminate();}};
  post({type:'init',...init});return ready;
}
