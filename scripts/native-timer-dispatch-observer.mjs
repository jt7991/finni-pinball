// Read the original active HitTimer list and pass through its original virtual
// IFireEvents callback. No timer deadlines, flags, clock results or bodies set.
export function installNativeTimerDispatchObserver(){
 const data=window.nativeTimerDispatch={armed:true,events:[],budgetTransitions:[],errors:[],layouts:[],layout:{playerGlobal:9191328,playerTimers:333776,handler:12,interval:16,nextFire:20,event:1300,string:{shortLength:11,longFlag:128,longData:0,longSize:4}}},memories=[],tables=[],handlers=new Map(),wrapped=new Map(),known=new Map();let lastBudget;
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 const module=new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,6,1,96,2,127,127,0,2,9,1,1,101,3,111,98,115,0,0,3,2,1,0,7,5,1,1,102,0,1,10,10,1,8,0,32,0,32,1,16,0,11]));
 function observe(){
  if(!data.armed||data.errors.length)return;
  try{
   const memory=memories.find(memory=>memory.buffer.byteLength>9191332),table=tables[0];if(!memory||!table)return;
   const view=new DataView(memory.buffer),player=view.getUint32(9191328,true);if(player<65536||player+333800>memory.buffer.byteLength)return;
   const begin=view.getUint32(player+333776,true),end=view.getUint32(player+333780,true),capacity=view.getUint32(player+333784,true);
   if(!begin&&!end)return;if(begin<65536||begin>end||end>capacity||capacity>memory.buffer.byteLength||(end-begin)%4||end-begin>1024)throw Error('Pinned active HitTimer vector failed validation');
   const profile=view.getUint32(player+624,true),counter=player+profile*64+1148;
   if(counter<player+333740){const microseconds=view.getUint32(counter,true),mode=view.getUint32(player+333708,true),exceeded=mode!==3&&microseconds>5000;if(exceeded!==lastBudget){data.budgetTransitions.push({ms:view.getUint32(player+40,true),profile,microseconds,mode,exceeded});lastBudget=exceeded;}}
   for(let at=begin;at<end;at+=4){
    const timer=view.getUint32(at,true);if(timer<65536||timer+24>memory.buffer.byteLength)throw Error('Native HitTimer pointer invalid');
    if(known.has(timer))continue;
    const flag=view.getUint8(timer+11),length=flag&128?view.getUint32(timer+4,true):flag,start=flag&128?view.getUint32(timer,true):timer;
    if(length<1||length>100||start<65536||start+length>memory.buffer.byteLength)throw Error('Pinned HitTimer name ABI failed validation');
    const name=new TextDecoder().decode(new Uint8Array(memory.buffer,start,length)),handler=view.getUint32(timer+12,true),interval=view.getInt32(timer+16,true);
    if(!/^[A-Za-z_][\w .]*$/.test(name)||interval< -2||interval>1000000||handler<65536||handler+4>memory.buffer.byteLength)throw Error('Native HitTimer public layout failed validation: '+JSON.stringify({name,interval,handler,timer}));
    const vtable=view.getUint32(handler,true);if(vtable<65536||vtable+4>memory.buffer.byteLength)throw Error('Timer IFireEvents vtable invalid');
    const index=view.getUint32(vtable,true);if(index>=table.length)throw Error('Timer callback table index invalid');
    handlers.set(handler,{name,timer,interval});known.set(timer,{name,handler});
    if(wrapped.has(index))continue;
    const original=table.get(index);if(typeof original!=='function'||original.length!==2)throw Error('Pinned original timer callback signature failed validation');
    const callback=function(pointer,event){
     if(data.armed&&event===1300){const row=handlers.get(pointer);if(!row)throw Error('Native timer callback has no observed HitTimer');const state=new DataView(memory.buffer),owner=state.getUint32(9191328,true);data.events.push({ms:state.getUint32(owner+40,true),name:row.name,interval:state.getInt32(row.timer+16,true),nextFire:state.getUint32(row.timer+20,true)});}
     return original(pointer,event);
    };
    const wrapper=new WebAssembly.Instance(module,{e:{obs:callback}}).exports.f;table.set(index,wrapper);wrapped.set(index,original);data.layouts.push({index,functionIndex:Number(original.name)});
   }
  }catch(error){data.errors.push(error.message);data.armed=false;}
 }
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const group of Object.values(args[1]??{})){remember(Object.values(group));for(const name of ['emscripten_get_now','emscripten_date_now','clock_time_get']){const raw=group[name];if(typeof raw!=='function'||raw.nativeTimerDispatchObserver)continue;const wrapped=function(...values){const result=raw.apply(this,values);observe();return result;};wrapped.nativeTimerDispatchObserver=true;group[name]=wrapped;}}
  const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;
 };}
}
