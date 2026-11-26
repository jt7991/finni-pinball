// Read-only pinned wasm32 Player/HitBall observations during original clock
// imports. No instruction, clock result, table callback or state is replaced.
export function installNativeStartupObserver(throughMilliseconds=1,{ballRadii=[25],maximumBalls=100,retainedBallIds=[]}={}){
 if(!Array.isArray(ballRadii)||!ballRadii.length||ballRadii.some(r=>!Number.isFinite(r)||r<=0)||!Number.isInteger(maximumBalls)||maximumBalls<1||maximumBalls>4096)throw Error('Invalid declared native ball observation bounds');
 if(!Array.isArray(retainedBallIds)||retainedBallIds.some(id=>!Number.isInteger(id)||id<0))throw Error('Invalid declared retained ball identities');
 const retainedIds=new Set(retainedBallIds),retainedOwners=new Map();
 const data=window.nativeStartup={records:[],boundaries:[],errors:[],imports:[],throughMilliseconds,done:false,clocks:0,notReady:0,memoryCount:0},memories=[];
 const remember=values=>{for(const value of values)if(value instanceof WebAssembly.Memory&&!memories.includes(value)){memories.push(value);data.memoryCount=memories.length;}};
 let previous;
 function snapshot(){
  const memory=memories.find(memory=>memory.buffer.byteLength>9191332);if(!memory)return null;
  const view=new DataView(memory.buffer),size=memory.buffer.byteLength,valid=(address,bytes)=>address>=65536&&address+bytes<=size,player=view.getUint32(9191328,true);
  if(!valid(player,333756))return null;
  const ms=view.getUint32(player+40,true),seconds=view.getFloat64(player+32,true),start=view.getUint32(player+333744,true),end=view.getUint32(player+333748,true);
  if(start>end||(end-start)%4||end-start>maximumBalls*4||start!==end&&!valid(start,end-start))return null;
  const vector=address=>[0,4,8].map(offset=>view.getFloat32(address+offset,true)),balls=[];
  const readBall=owner=>{
   const body=owner+288;if(!valid(owner,680)||view.getUint32(body+64,true)!==owner||view.getUint32(body+72,true)!==body||view.getUint32(body+124,true)!==body||!ballRadii.includes(view.getFloat32(body+152,true)))return null;
   const id=view.getUint32(owner+668,true),orientation=Array.from({length:9},(_,i)=>view.getFloat32(body+208+i*4,true));
   const row={id,owner,address:body,position:vector(body+128),velocity:vector(body+140),momentum:vector(body+196),orientation,locked:!!view.getUint8(body+164)};
   if(![...row.position,...row.velocity,...row.momentum,...orientation].every(Number.isFinite))return null;
   if(retainedIds.has(id))row.float32Words=Object.fromEntries([['position',128,3],['velocity',140,3],['momentum',196,3],['orientation',208,9]].map(([key,offset,count])=>[key,Array.from({length:count},(_,i)=>view.getUint32(body+offset+i*4,true))]));
   return row;
  };
  for(let at=start;at<end;at+=4){
   const row=readBall(view.getUint32(at,true));if(!row||balls.some(ball=>ball.id===row.id))return null;
   balls.push(row);if(retainedIds.has(row.id))retainedOwners.set(row.id,row.owner);
  }
  const retiredBalls=[];for(const [id,owner]of retainedOwners)if(!balls.some(ball=>ball.id===id)){const row=readBall(owner);if(!row||row.id!==id)throw Error('Retained native Ball storage no longer validates');retiredBalls.push(row);}
  const physics=view.getUint32(player+333740,true),physicsClock=valid(physics,128)?{gravity:vector(physics+68),start:String(view.getBigUint64(physics+104,true)),current:String(view.getBigUint64(physics+112,true)),next:String(view.getBigUint64(physics+120,true))}:null;
  return {ms,seconds,player,lastAnimationMilliseconds:view.getUint32(player+44,true),physicsClock,random:[view.getUint32(7661264,true),view.getUint32(7661268,true)],balls,...(retainedIds.size?{retiredBalls}:{}),...(balls.length>=3&&window.nativeFlipperMotion?{flippers:window.nativeFlipperMotion.read()}:{} ),...(balls.length>=3&&window.nativeMoverMotion?{movers:window.nativeMoverMotion.read()}:{} )};
 }
 const observe=importName=>{
  if(data.done)return;data.clocks++;
  try{
   if(data.firstPositive){const memory=memories[0],view=new DataView(memory.buffer),player=view.getUint32(9191328,true);if(view.getUint32(player+40,true)===data.boundaries.at(-1).ms)return;}
   const row=snapshot();if(!row){data.notReady++;return;}
   if(row.ms>0){const boundary={importName,...row};if(!data.firstPositive){boundary.stack=Error().stack;data.firstPositive=boundary;}data.boundaries.push(boundary);if(row.ms>=throughMilliseconds)data.done=true;return;}
   row.importName=importName;data.lastZero=row;
   if(row.balls.length===3&&!data.firstThreeBalls)data.firstThreeBalls=row;
   const key=JSON.stringify({random:row.random,balls:row.balls});if(key!==previous){if(data.records.length<512)data.records.push(row);else data.truncated=true;previous=key;}
  }catch(error){data.errors.push(error.message);data.done=true;}
 };
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const group of Object.values(args[1]??{})){
   remember(Object.values(group));
   for(const name of ['emscripten_get_now','emscripten_date_now','clock_time_get','emscripten_set_main_loop']){
    const raw=group[name];if(typeof raw!=='function'||raw.nativeStartupObserver)continue;data.imports.push(name);
    const wrapped=function(...values){const result=raw.apply(this,values);observe(name);return result;};wrapped.nativeStartupObserver=true;group[name]=wrapped;
   }
  }
  const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;
 };}
 data.read=snapshot;
 // Pinned original ScriptGlobalTable::get_FrameIndex function1347 reads
 // Player+334768. Verified independently by nativeFrameClockLayout.
 data.frameIndex=()=>{const memory=memories.find(memory=>memory.buffer.byteLength>9191332);if(!memory)return null;const view=new DataView(memory.buffer),player=view.getUint32(9191328,true);return player>=65536&&player+334772<=memory.buffer.byteLength?view.getUint32(player+334768,true):null;};
}
