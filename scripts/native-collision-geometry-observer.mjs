// Read-only original HitTriangle resources, using the pinned wasm32 ABI.
export function installNativeCollisionGeometryObserver(){
 const data=window.nativeCollisionGeometry={errors:[],triangles:[],layout:{vtable:1434068,vertices:64,normal:100}},memories=[],tables=[];
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){for(const group of Object.values(args[1]??{}))remember(Object.values(group));const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;};}
 data.read=()=>{
  try{
   if(memories.length!==1||tables.length!==1)throw Error('Unique original memory/table required');
   const view=new DataView(memories[0].buffer),words=new Uint32Array(memories[0].buffer),table=tables[0],vtable=data.layout.vtable;
   const getter=table.get(view.getUint32(vtable+12,true));if(getter.name!=='1891'||getter(0)!==11)throw Error('Pinned HitTriangle GetType ABI changed');
   const vector=address=>[0,4,8].map(offset=>view.getFloat32(address+offset,true));
   for(let i=0;i<words.length-28;i++)if(words[i]===vtable){
    const address=i*4,points=[64,76,88].map(offset=>vector(address+offset)),normal=vector(address+100);
    if([...points.flat(),...normal].some(value=>!Number.isFinite(value)))continue;
    // The authored floor has tiny nonzero vertex heights. Preserve them and
    // their native normals, rather than replacing the floor with a plane.
    if(!points.every(p=>p[0]>=-.01&&p[0]<=952.01&&p[1]>=-.01&&p[1]<=2115.01&&Math.abs(p[2])<=.001))continue;
    data.triangles.push({address,editable:words[i+1],points,normal});
   }
   if(!data.triangles.length)throw Error('Original floor triangles unavailable');
  }catch(error){data.errors.push(error.message);}
  return data;
 };
}
