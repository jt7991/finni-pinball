// Read-only observer for the pinned wasm32 Plunger/HitPlunger ABI. The mover
// offsets come from the compiled Fire, Collide and UpdateVelocities functions.
// Discover by static dimensions and verify the owner/back-pointer, properties
// and native COM Position; no simulated trajectory participates in discovery.
export function nativePlungerMemoryObserver(memory,spec){
  const f=Math.fround,scratch=new ArrayBuffer(4),floats=new Float32Array(scratch),words=new Uint32Array(scratch),word=value=>{floats[0]=value;return words[0];};
  let mover,part;
  function scan(){
    const view=new DataView(memory.buffer),data=new Uint32Array(memory.buffer),expected=[spec.park_position,spec.center.y,f(f(spec.center.y)-f(spec.stroke)),spec.stroke].map(word),found=[];
    for(let index=192;index<data.length-4;index++){
      if(!expected.every((value,axis)=>data[index+axis]===value))continue;
      const address=index*4-768;if(address+802>memory.buffer.byteLength)continue;
      const owner=view.getUint32(address+4,true);
      if(owner<64||owner+408>=memory.buffer.byteLength||view.getUint32(owner+404,true)!==address-64)continue;
      if(view.getUint32(owner+300,true)!==word(spec.speed_fire)||view.getUint32(owner+304,true)!==word(spec.mech_strength))continue;
      if(view.getUint8(owner+384)!==Number(spec.is_mech_plunger)||view.getUint8(owner+385)!==Number(spec.auto_plunger))continue;
      found.push({mover:address,part:owner});
    }
    if(found.length!==1)throw Error('Native plunger ABI validation failed: '+JSON.stringify(found));
    ({mover,part}=found[0]);return {mover,part,hitObject:mover-64,fields:{pos:728,speed:732,travelLimit:736,pullForce:740,reverseImpulse:744,fireTimer:748,fireSpeed:752,autoFireTimer:756,fireBounce:764,rest:768,start:772,end:776,length:780,scatterVelocity:788}};
  }
  function read(){
    if(mover===undefined)throw Error('Native plunger ABI has not been observed');
    const view=new DataView(memory.buffer),float=offset=>view.getFloat32(mover+offset,true);
    if(view.getUint32(part+404,true)!==mover-64)throw Error('Native plunger identity changed');
    const state=Object.fromEntries(Object.entries({pos:728,speed:732,travelLimit:736,pullForce:740,reverseImpulse:744,fireSpeed:752,fireBounce:764,rest:768,start:772,end:776,length:780,scatterVelocity:788}).map(([key,offset])=>[key,float(offset)]));
    // Fire initializes bounce. Before the first Fire, native allocation bytes
    // can remain in this inactive field; do not reject an otherwise valid rod.
    if(!Object.entries(state).every(([key,value])=>Number.isFinite(value)||key==='fireBounce'&&view.getInt32(mover+748,true)===0))throw Error('Invalid native plunger scalar state');
    state.fireTimer=view.getInt32(mover+748,true);state.autoFireTimer=view.getInt32(mover+756,true);state.addRetractMotion=!!view.getUint8(mover+800);state.retractMotion=!!view.getUint8(mover+801);
    state.position=f(25*Math.max(0,Math.min(1,f(f(state.pos-state.end)/state.length))));return state;
  }
  let packedBuffer,packedView;
  const packedOffsets=[728,732,736,740,744,752,764,768,772,776,780,788];
  function readPacked(target,at){
    if(mover===undefined)throw Error('Native plunger ABI has not been observed');
    if(packedBuffer!==memory.buffer){packedBuffer=memory.buffer;packedView=new DataView(packedBuffer);}
    const view=packedView;
    if(view.getUint32(part+404,true)!==mover-64)throw Error('Native plunger identity changed');
    const start=at,fireTimer=view.getInt32(mover+748,true);
    for(let i=0;i<packedOffsets.length;i++){
      const value=view.getFloat32(mover+packedOffsets[i],true);
      if(!Number.isFinite(value)&&!(i===6&&fireTimer===0))throw Error('Invalid native plunger scalar state');
      target[at++]=value;
    }
    target[at++]=fireTimer;target[at++]=view.getInt32(mover+756,true);target[at++]=Number(!!view.getUint8(mover+800));target[at++]=Number(!!view.getUint8(mover+801));
    target[at++]=f(25*Math.max(0,Math.min(1,f(f(target[start]-target[start+9])/target[start+10]))));
    return at;
  }
  function unpackPacked(source,at){
    const names=['pos','speed','travelLimit','pullForce','reverseImpulse','fireSpeed','fireBounce','rest','start','end','length','scatterVelocity','fireTimer','autoFireTimer','addRetractMotion','retractMotion','position'],state={};
    for(let i=0;i<names.length;i++)state[names[i]]=i===14||i===15?!!source[at++]:source[at++];
    return {state,end:at};
  }
  return {scan,read,readPacked,unpackPacked};
}
