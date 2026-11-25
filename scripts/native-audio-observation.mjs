// Read-only production observation. Fault inputs are explicit QA parameters.
export function installNativeAudioObservation({files={},specs={},delayMilliseconds=0,holdPreparation=false,holdFiles=[],forceFallback=false,failFirst=false}={}){
 const held=[],s=window.nativeAudioQA={contexts:[],requests:[],bankRequests:[],musicRequests:[],fallbackRequests:[],decodes:[],registrations:[],plays:[],effects:[],inputs:[],callbacks:[],applied:[],presented:[],ended:[],warnings:[],fatal:[],hashMismatches:[],underruns:0,packetQueue:[],nodes:0,audioElements:0,pending:new Map(),id:9000000,releasePreparation(){for(const resolve of held)resolve();}},NativeContext=window.AudioContext,NativeOffline=window.OfflineAudioContext,NativeWorker=window.Worker,NativeAudio=window.Audio,originalFetch=window.fetch,originalWarn=console.warn,arrayRequests=new WeakMap(),buffers=new WeakMap();let bufferID=0,upRequests=0;
 window.Audio=class extends NativeAudio{constructor(...args){super(...args);s.audioElements++;}};
 const hash=pcm=>{const bits=new Uint32Array(pcm.buffer,pcm.byteOffset,pcm.length);let h=2166136261;for(const value of bits)h=Math.imul(h^value,16777619);return h>>>0;};
 const observeAudio=(transport,data)=>{
  s.worker=transport;
  if(data.type!=='response'&&data.type!=='audio-render')return;
  if(s.pending.has(data.id)){const p=s.pending.get(data.id);s.pending.delete(data.id);data.status==='error'?p.reject(Error(data.error)):p.resolve(data);return;}
  const request=transport.audioRequests?.get(data.id)??{type:data.requestType,name:data.name};transport.audioRequests?.delete(data.id);
  if(data.status==='registered')s.registrations.push({at:performance.now(),key:data.key,sourceID:data.sourceID,name:request.name,encoding:data.encoding});
  if(data.status==='queued'&&request.type==='play-effect')s.plays.push({at:performance.now(),name:request.name,key:data.key,sourceID:data.sourceID});
  if(data.status==='pcm'){s.packetQueue.push({hash:hash(data.pcm),at:performance.now(),applied:data.applied,active:data.active});for(const event of data.ended??[])s.ended.push({...event,at:performance.now()});}
 };
 const dispatch=EventTarget.prototype.dispatchEvent;
 EventTarget.prototype.dispatchEvent=function(event){if(this.nativeAudioTransport&&event.type==='message')observeAudio(this,event.data);return dispatch.call(this,event);};
 const label=(buffer,request,source)=>{const record={file:request.file,bufferID:++bufferID,frames:buffer.length,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,source,at:performance.now()};buffers.set(buffer,record);s.decodes.push(record);return buffer;};
 console.warn=(...args)=>{s.warnings.push(args.map(String).join(' '));return originalWarn(...args);};
 window.fetch=async(...args)=>{
  const path=new URL(args[0]?.url??String(args[0]),location.href).pathname,file=path.split('/').at(-1),primary=Object.values(files).includes(file)||holdFiles.includes(file);if(path.includes('/native-audio/music/'))s.musicRequests.push(path);if(Object.values(specs).some(entry=>entry.fallbackFile===file))s.fallbackRequests.push(file);if(path.includes('/native-audio/effects')){const row={path,at:performance.now()};s.bankRequests.push(row);const response=await originalFetch(...args),read=response.arrayBuffer.bind(response);row.status=response.status;response.arrayBuffer=async()=>{const bytes=await read();row.bodyAt=performance.now();row.bytes=bytes.byteLength;return bytes;};return response;}if(!primary)return originalFetch(...args);
  const request={file,at:performance.now()};s.requests.push(request);if(file===files.up&&failFirst&&++upRequests===1){request.failure=503;return new Response('',{status:503});}
  if(holdPreparation||holdFiles.includes(file)){request.heldAt=performance.now();await new Promise(resolve=>held.push(resolve));request.releasedAt=performance.now();}if(delayMilliseconds)await new Promise(resolve=>setTimeout(resolve,delayMilliseconds));const response=await originalFetch(...args),read=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{const data=await read();request.bodyAt=performance.now();request.bytes=data.byteLength;arrayRequests.set(data,request);return data;};return response;
 };
 window.AudioContext=class extends NativeContext{
  constructor(...args){super(...args);const context=this,record={initialState:this.state,at:performance.now(),resumes:[],readState:()=>context.state},resume=this.resume.bind(this),create=this.createScriptProcessor.bind(this);s.contexts.push(record);this.resume=(...args)=>{record.resumes.push({at:performance.now(),gesture:navigator.userActivation.isActive});return resume(...args);};
   this.createScriptProcessor=(...args)=>{const node=create(...args),number=++s.nodes,descriptor=Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype,'onaudioprocess');let callbacks=0;Object.defineProperty(node,'onaudioprocess',{set(value){descriptor.set.call(node,value?function(event){let packet=s.packetQueue.shift();const started=performance.now();value(event);if(!packet&&callbacks===0)packet=s.packetQueue.shift();const renderMS=performance.now()-started;callbacks++;const pcm=new Float32Array(event.outputBuffer.length*2);for(let c=0;c<2;c++){const channel=event.outputBuffer.getChannelData(c);for(let i=0;i<channel.length;i++)pcm[i*2+c]=channel[i];}const actualHash=hash(pcm),at=performance.now();if(packet&&packet.hash!==actualHash)s.hashMismatches.push({at,expected:packet.hash,actual:actualHash});if(!packet&&callbacks>1)s.underruns++;
    const peak=pcm.reduce((n,x)=>Math.max(n,Math.abs(x)),0),callback={at,playbackTime:event.playbackTime,node:number,hash:actualHash,hasPacket:!!packet,active:packet?.active,renderMS,peak};if(s.callbacks.length<6000)s.callbacks.push(callback);for(const command of packet?.applied??[]){const record={...command,at,packetAt:packet.at,callback:callbacks};s.applied.push(record);if(command.type==='play')s.presented.push(record);}
   }:null);}});return node;};
  }
  createBuffer(...args){const buffer=super.createBuffer(...args);if(forceFallback){const entry=Object.entries(specs).find(([,e])=>e.channels===args[0]&&e.frames===args[1]&&e.sampleRate===args[2]);if(entry)label(buffer,{file:files[entry[0]]},'original-wav-fallback');}return buffer;}
 };
 window.OfflineAudioContext=class extends NativeOffline{constructor(...args){if(forceFallback)throw new DOMException('Declared unsupported FLAC','NotSupportedError');super(...args);const decode=this.decodeAudioData.bind(this);this.decodeAudioData=bytes=>decode(bytes).then(buffer=>{const request=arrayRequests.get(bytes);return request?label(buffer,request,'lossless-flac'):buffer;});}};
 s.stats=()=>new Promise((resolve,reject)=>{const id=++s.id;s.pending.set(id,{resolve,reject});s.worker.postMessage({type:'stats',id});});
 window.Worker=class extends NativeWorker{
  constructor(...args){super(...args);this.audioWorker=String(args[0]).includes('audio-worker');if(this.audioWorker){s.worker=this;this.audioRequests=new Map();}
   this.addEventListener('message',({data})=>{
    if(data.type==='fatal')s.fatal.push(data.message);if(data.type==='snapshot')for(const effect of data.effects??[])if(effect.type==='play')s.effects.push({name:effect.name.toLowerCase(),at:performance.now()});
    if(this.audioWorker)observeAudio(this,data);
   });
  }
  postMessage(message,...args){if(this.audioWorker)this.audioRequests.set(message.id,{type:message.type,name:message.name});if(message.type==='input')s.inputs.push({action:message.action,down:message.down,at:performance.now()});return super.postMessage(message,...args);}
 };
}
