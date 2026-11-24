// Observe the original RAF callback and its first native draw. Callbacks,
// timestamps, draw arguments and return values are passed through unchanged.
export function installNativeSceneClockObserver({maxFrames=1000}={}){
 const data=window.nativeSceneClock={frames:[],animationFrames:[],preparedFrames:[],armed:true,errors:[],layout:{playerGlobal:9191328,currentMilliseconds:40,lastAnimationMilliseconds:44,source:'Player::m_time_msec followed by uint32_t m_last_frame_time_msec; Player::PrepareFrame assigns the latter immediately before UpdateAnimation.'}},memories=[];let active,lastAnimation=0,lastFrameIndex=0;
 const remember=values=>{for(const value of values)if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);};
 const observe=()=>{
  if(!data.armed)return;
  const memory=memories.find(memory=>memory.buffer.byteLength>9191332);if(!memory)return;
  const view=new DataView(memory.buffer),player=view.getUint32(9191328,true);if(player<65536||player+333756>memory.buffer.byteLength)return;
  const now=view.getUint32(player+40,true),animation=view.getUint32(player+44,true);
  const frameIndex=window.nativeStartup?.frameIndex();if(frameIndex>lastFrameIndex){const snapshot=window.nativeStartup.read();if(snapshot)data.preparedFrames.push({frameIndex,...snapshot});lastFrameIndex=frameIndex;}
  if(animation===lastAnimation)return;
  if(animation<lastAnimation||animation>now){data.errors.push('Native frame clock layout did not validate');data.armed=false;return;}
  const snapshot=window.nativeStartup?.read();if(!snapshot)return;
  data.animationFrames.push({ms:animation,observedAtMilliseconds:now,physicsClock:snapshot.physicsClock});lastAnimation=animation;
 };
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const group of Object.values(args[1]??{})){
   remember(Object.values(group));
   for(const name of ['emscripten_get_now','emscripten_date_now','clock_time_get']){
    const raw=group[name];if(typeof raw!=='function'||raw.nativeSceneClockObserver)continue;
    const wrapped=function(...values){const result=raw.apply(this,values);observe();return result;};wrapped.nativeSceneClockObserver=true;group[name]=wrapped;
   }
  }
  const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;
 };}
 data.noteTonemap=frameIndex=>{if(active)(active.tonemapFrames??=[]).push(frameIndex);};
 const read=()=>window.nativeStartup?.read();
 for(const Context of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays']){
  const original=Context.prototype[name];Context.prototype[name]=function(...args){
   if(active&&data.armed&&this.canvas.id==='canvas'){
    active.draws++;if(active.firstDrawMilliseconds===undefined){const row=read();if(row){active.firstDrawMilliseconds=row.ms;active.firstDrawAnimationMilliseconds=row.lastAnimationMilliseconds;}}
   }
   return original.apply(this,args);
  };
 }
 const request=window.requestAnimationFrame;
 window.requestAnimationFrame=function(callback){return request.call(this,function(timestamp){
  if(!data.armed)return callback.call(this,timestamp);
  const parent=active,row=active={timestamp,draws:0,beforeMilliseconds:read()?.ms};
  try{return callback.call(this,timestamp);}finally{
   const after=read();row.afterMilliseconds=after?.ms;row.afterPhysicsClock=after?.physicsClock;active=parent;
   if(row.draws){if(data.frames.length<maxFrames)data.frames.push(row);else data.errors.push('Frame capture overflow');}
  }
 });};
}
