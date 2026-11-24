// Read-only FlipperMoverObject state from the pinned original wasm32 binary.
export function installNativeFlipperMotionObserver(){
 const data=window.nativeFlipperMotion={errors:[],layout:{vtable:1434840,mover:64,center:136,momentum:160,acceleration:164,speed:168,angle:172,inertia:192}},memories=[],tables=[];let addresses;
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){for(const group of Object.values(args[1]??{}))remember(Object.values(group));const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;};}
 data.read=()=>{
  try{
   if(memories.length!==1||tables.length!==1)throw Error('Unique original memory/table required');
   const view=new DataView(memories[0].buffer),words=new Uint32Array(memories[0].buffer),table=tables[0],vtable=data.layout.vtable;
   if(!addresses){
    const getter=table.get(view.getUint32(vtable+12,true));if(getter.name!=='1983'||getter(0)!==6)throw Error('Pinned HitFlipper GetType ABI changed');
    addresses=[];
    for(let i=0;i<words.length-56;i++)if(words[i]===vtable){const address=i*4,x=view.getFloat32(address+136,true),y=view.getFloat32(address+140,true),radius=view.getFloat32(address+156,true),inertia=view.getFloat32(address+192,true);if(Math.abs(y-1786.8932)>.01||Math.abs(radius-114.7)>.001||Math.abs(inertia-4385.36328125)>.001)continue;if(Math.abs(x-274.4583)<.01)addresses.push({name:'left',address});else if(Math.abs(x-592.20245)<.01)addresses.push({name:'right',address});}
    if(addresses.length!==2)throw Error('Unique authored flipper resources required');addresses.sort((a,b)=>a.name.localeCompare(b.name));data.resources=addresses;
   }
   return addresses.map(({name,address})=>({name,...Object.fromEntries(['angle','momentum','speed','inertia'].map(key=>[key,view.getFloat32(address+data.layout[key],true)]))}));
  }catch(error){data.errors.push(error.message);return [];}
 };
}
