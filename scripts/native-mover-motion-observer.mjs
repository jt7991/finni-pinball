// Read-only Gate/Spinner resources and live mover fields from the pinned
// original wasm32 module. Names/offsets are discovered from authored object
// names and original virtual getters, never from a simulated trajectory.
export function installNativeMoverMotionObserver(specs){
 const data=window.nativeMoverMotion={errors:[],resources:[],candidates:[],layout:{gate:{vtable:1433936,type:14,getType:1712,velocity:4418,fields:{speed:8,angle:12,damping:16,gravity:20,min:24,max:28},flags:{open:32,forced:33,hitDirection:34}},spinner:{vtable:1433980,type:8,getType:1661,velocity:4422,fields:{speed:8,angle:12,max:16,min:20,damping:28}}}},memories=[],tables=[];let resources;
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){for(const group of Object.values(args[1]??{}))remember(Object.values(group));const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;};}
 data.read=()=>{
  if(data.errors.length)return [];
  try{
   if(memories.length!==1||tables.length!==1)throw Error('Unique original mover memory/table required');
   const view=new DataView(memories[0].buffer),words=new Uint32Array(memories[0].buffer),table=tables[0];
   if(!resources){
    for(const layout of Object.values(data.layout)){const getter=table.get(view.getUint32(layout.vtable+12,true));if(getter.name!==String(layout.getType)||getter(0)!==layout.type)throw Error('Pinned mover GetType ABI changed');layout.getMover=Number(table.get(view.getUint32(layout.vtable+28,true)).name);}
    resources=[];
    for(let i=16384;i<words.length-128;i++){
     const kind=words[i]===data.layout.gate.vtable?'gate':words[i]===data.layout.spinner.vtable?'spinner':null;if(!kind)continue;const layout=data.layout[kind];
     const address=i*4,mover=table.get(view.getUint32(layout.vtable+28,true))(address),candidate={kind,address,mover};data.candidates.push(candidate);if(mover<address||mover>address+512)continue;
     const moverVtable=view.getUint32(mover,true);candidate.moverVtable=moverVtable;if(moverVtable<65536||moverVtable+12>view.byteLength)continue;const slot=view.getUint32(moverVtable+8,true);candidate.velocityFunction=slot<table.length?table.get(slot)?.name:null;if(slot>=table.length||table.get(slot)?.name!==String(layout.velocity))continue;
     const parent=view.getUint32(mover+4,true);candidate.parent=parent;if(parent<65536||parent+1024>view.byteLength)continue;
     const matches=[];
     for(const spec of specs.filter(s=>s.kind.toLowerCase()===kind))for(const width of [1,2,4])for(let offset=0;offset<1024-spec.name.length*width-width;offset+=width){
      const locations=[{at:parent+offset,indirect:false}];if(offset%4===0){const pointer=view.getUint32(parent+offset,true);if(pointer>=65536&&pointer+(spec.name.length+1)*width<view.byteLength)locations.push({at:pointer,indirect:true});}
      for(const location of locations){let match=true;for(let j=0;j<=spec.name.length;j++){const at=location.at+j*width,value=width===1?view.getUint8(at):width===2?view.getUint16(at,true):view.getUint32(at,true);if(value!==(j===spec.name.length?0:spec.name.charCodeAt(j))){match=false;break;}}if(match)matches.push({name:spec.name,nameOffset:offset,nameWidth:width,nameIndirect:location.indirect});}
     }
     candidate.matches=matches;
     matches.sort((a,b)=>a.nameOffset-b.nameOffset);if(!matches.length)continue;resources.push({kind,address,mover,parent,moverOffset:mover-address,...matches[0]});
    }
    if(resources.length!==specs.length||new Set(resources.map(r=>r.name)).size!==specs.length)throw Error('Unique authored gate/spinner resources required: '+JSON.stringify(resources));
    for(const kind of Object.keys(data.layout)){const rows=resources.filter(r=>r.kind===kind);if(new Set(rows.map(r=>r.nameOffset+':'+r.nameWidth+':'+r.nameIndirect+':'+r.moverOffset)).size!==1)throw Error('Authored mover name/getter ABI is inconsistent');}
    resources.sort((a,b)=>a.name.localeCompare(b.name));data.resources=resources;
   }
   return resources.map(({name,kind,mover})=>{const layout=data.layout[kind],row={name,kind};for(const [key,offset]of Object.entries(layout.fields)){const value=view.getFloat32(mover+offset,true);if(!Number.isFinite(value))throw Error('Nonfinite original mover field');row[key]=value;}for(const [key,offset]of Object.entries(layout.flags??{})){const value=view.getUint8(mover+offset);if(value>1)throw Error('Original mover flag ABI changed');row[key]=!!value;}return row;});
  }catch(error){data.errors.push(error.message);return [];}
 };
}
