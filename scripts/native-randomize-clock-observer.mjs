// Typed pass-through around the pinned original Global_Randomize callback.
// Records external clocks; never sets native script RNG, clocks or arguments.
export function installNativeRandomizeClockObserver(){
 const data=window.nativeRandomizeClocks={records:[],timerRecords:[],errors:[]},memories=[],tables=[];let active;
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const group of Object.values(args[1]??{})){
   remember(Object.values(group));
   for(const name of ['emscripten_date_now','emscripten_get_now','clock_time_get']){
    const raw=group[name];if(typeof raw!=='function'||raw.nativeRandomizeClockObserver)continue;
    const wrapped=function(...values){const result=raw.apply(this,values);if(active){const row={name,value:typeof result==='bigint'?String(result):result,args:values.map(v=>typeof v==='bigint'?String(v):v)};if(name==='clock_time_get'&&result===0)row.nanoseconds=String(new DataView(memories[0].buffer).getBigUint64(values[2],true));active.clocks.push(row);}return result;};wrapped.nativeRandomizeClockObserver=true;group[name]=wrapped;
   }
  }
  const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;
 };}
 data.install=()=>{
  if(memories.length!==1||tables.length!==1)throw Error('Unique native script memory/table unavailable');
  const table=tables[0],matches=[];for(let i=0;i<table.length;i++)if(table.get(i)?.name==='18195')matches.push(i);if(matches.length!==1)throw Error('Pinned original Randomize callback is not unique');
  const index=matches[0],original=table.get(index);
  const observe=(context,argument,count,result)=>{
   if(data.stopped)return original(context,argument,count,result);
   const row={frameIndex:window.nativeStartup.frameIndex(),ms:window.nativeStartup.read()?.ms,count,clocks:[]};active=row;
   try{return original(context,argument,count,result);}finally{active=undefined;data.records.push(row);}
  };
  const module=new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,9,1,96,4,127,127,127,127,1,127,2,9,1,1,101,3,111,98,115,0,0,3,2,1,0,7,5,1,1,102,0,1,10,14,1,12,0,32,0,32,1,32,2,32,3,16,0,11]));
  table.set(index,new WebAssembly.Instance(module,{e:{obs:observe}}).exports.f);
  const timerMatches=[];for(let i=0;i<table.length;i++)if(table.get(i)?.name==='18219')timerMatches.push(i);if(timerMatches.length!==1)throw Error('Pinned original Timer callback is not unique');
  const timerIndex=timerMatches[0],timer=table.get(timerIndex);
  const observeTimer=(context,argument,count,result)=>{
   if(data.stopped)return timer(context,argument,count,result);
   const row={frameIndex:window.nativeStartup.frameIndex(),ms:window.nativeStartup.read()?.ms,clocks:[]},previous=active;active=row;
   try{return timer(context,argument,count,result);}finally{active=previous;if(result){const view=new DataView(memories[0].buffer);row.type=view.getUint16(result,true);row.seconds=view.getFloat32(result+8,true);if(row.type!==4||!Number.isFinite(row.seconds))throw Error('Original Timer Single ABI failed validation');data.timerRecords.push(row);}}
  };
  table.set(timerIndex,new WebAssembly.Instance(module,{e:{obs:observeTimer}}).exports.f);
  data.layout={functionIndex:18195,tableIndex:index,timerFunctionIndex:18219,timerTableIndex:timerIndex,timerFunctionSHA256:'897063c619a33bc0e076c6d3219c4bf1645dd56b4b9222a2066b366eea83caf5',scope:'Original callbacks and clock returns passed through unchanged. No RNG output is read. Timer records are original external local-time Single returns.'};
 };
}
