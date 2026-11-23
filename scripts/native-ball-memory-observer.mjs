// Read-only observer for the pinned wasm32 VPX binary. Offsets derive from
// HitObject, CollisionEvent and HitBall in the pinned C++ headers, not from
// trajectory fitting. Self pointers and all public float state validate them.
export function nativeBallMemoryObserver(memory,gravity,expectedMaxLoops,recordContactSlots=false,liveBodies=false){
  const scratch=new ArrayBuffer(4),number=new Float32Array(scratch),bits=new Uint32Array(scratch),word=value=>{number[0]=value;return bits[0];};
  let layout,bodies,gravityAddress;
  function scan(rows){
    const words=new Uint32Array(memory.buffer),floats=new Float32Array(memory.buffer),view=new DataView(memory.buffer),starts=rows.map(row=>word(row[0])),matches=rows.map(()=>[]),gravities=[],gravityCandidates=[],gravityX=word(gravity[0]);
    for(let index=0;index<words.length-9;index++){
      const first=words[index];
      if(first===gravityX&&Math.abs(floats[index+1]-gravity[1])<2e-6&&Math.abs(floats[index+2]-gravity[2])<2e-6){
        const address=index*4,begin=view.getUint32(address+20,true),end=view.getUint32(address+24,true),capacity=view.getUint32(address+28,true);
        gravityCandidates.push({address,nextWords:Array.from(words.slice(index+3,index+13))});
        if(view.getUint32(address+12,true)===expectedMaxLoops&&view.getUint8(address+16)<=1&&view.getUint8(address+17)<=1&&begin>0&&begin<=end&&end<=capacity&&capacity<memory.buffer.byteLength&&(capacity-begin)%48===0)gravities.push(address);
      }
      for(let ball=0;ball<starts.length;ball++)if(first===starts[ball]){
        const row=rows[ball],stateAddress=index*4;if(stateAddress<4)continue;const address=view.getUint32(stateAddress-4,true),stateOffset=stateAddress-address;
        if(address<0||stateOffset<96||stateOffset>192||stateOffset%4!==0||stateAddress+80>memory.buffer.byteLength)continue;
        if(words[index+1]!==word(row[1])||words[index+2]!==word(row[2])||words[index+6]!==word(row[10])||words[index+7]!==word(row[9]))continue;
        // VBScript formats both signed zero encodings as "0".
        const same=(address,value)=>view.getUint32(address,true)===word(value)||value===0&&view.getFloat32(address,true)===0;
        if(![0,1,2].every(axis=>same(stateAddress+12+axis*4,row[3+axis])&&same(stateAddress+68+axis*4,row[6+axis])))continue;
        // HitBall has two self references before BallS: CollisionEvent.m_ball
        // and BallMoverObject.m_pHitBall. The latter immediately precedes BallS.
        // Derive ABI padding from those pointers, then verify the same layout
        // against every body; no simulated outcome participates in discovery.
        const self=[];for(let offset=0;offset<stateOffset;offset+=4)if(view.getUint32(address+offset,true)===address)self.push(offset);
        if(self.length!==2||self[1]!==stateOffset-4||self[1]-self[0]<48)continue;
        matches[ball].push({address,ballState:stateOffset,collisionBall:self[0]});
      }
    }
    if(matches.some(found=>found.length!==1))throw Error('Native HitBall layout validation failed: '+JSON.stringify(matches));
    if(gravities.length!==1)throw Error('Native physics gravity/contacts layout validation failed: '+JSON.stringify({gravities,gravityCandidates,bodyLayouts:matches}));
    const first=matches[0][0],offset=first.ballState;
    layout={ballState:offset,collisionBall:first.collisionBall,collisionGap:first.collisionBall+12,moverSelf:offset-4,locked:offset+36,lastEventPosition:offset+52,eventDistance:offset+64,momentum:offset+68,orientation:offset+80};
    if(matches.some(([body])=>body.ballState!==layout.ballState||body.collisionBall!==layout.collisionBall))throw Error('Native HitBall ABI differs between bodies');
    bodies=matches.map(([body],index)=>({id:rows[index][11],address:body.address}));gravityAddress=gravities[0];
    if(liveBodies){
      const active=readLiveBodies(view);if(active.length!==bodies.length||active.some((body,i)=>body.id!==bodies[i].id||body.address!==bodies[i].address))throw Error('Native live ball vector disagrees with the public GetBalls scan');
    }
    return {layout,bodies,gravityAddress,swapAddress:gravityAddress+16,...(liveBodies?{liveABI:{playerGlobal:9191328,playerPhysics:333740,playerBalls:333744,hitBall:288,ballID:668,source:'Pinned Ball::get_ID function2486 loads668; compiled player ball iteration functions3221/4365 load333744/333748; native render function2531 reads position416=288+128. Every initial identity/address checked against public GetBalls and both HitBall self pointers.'}}:{})};
  }
  function readLiveBodies(view){
    const player=view.getUint32(9191328,true),begin=view.getUint32(player+333744,true),end=view.getUint32(player+333748,true),capacity=view.getUint32(player+333752,true);
    if(view.getUint32(player+333740,true)+68!==gravityAddress||begin>end||end>capacity||capacity>memory.buffer.byteLength||(end-begin)%4||(end-begin)/4>100)throw Error('Pinned live Player ball vector ABI validation failed');
    const active=[];for(let cursor=begin;cursor<end;cursor+=4){
      const ball=view.getUint32(cursor,true),address=ball+288,id=view.getUint32(ball+668,true);
      if(view.getUint32(address+layout.collisionBall,true)!==address||view.getUint32(address+layout.moverSelf,true)!==address||view.getUint32(address+64,true)!==ball||view.getFloat32(address+layout.ballState+24,true)!==25||active.some(b=>b.id===id))throw Error('Pinned live HitBall identity ABI validation failed: '+JSON.stringify({ball,address,id,self:view.getUint32(address+layout.collisionBall,true),mover:view.getUint32(address+layout.moverSelf,true),owner:view.getUint32(address+64,true),radius:view.getFloat32(address+layout.ballState+24,true)}));
      active.push({id,address});
    }
    return active;
  }
  function read(rows){
    if(!bodies)throw Error('Native body addresses have not been observed');
    const view=new DataView(memory.buffer),vector=address=>[0,4,8].map(offset=>view.getFloat32(address+offset,true));
    if(liveBodies)bodies=readLiveBodies(view);
    for(let index=0;index<(rows?.length??0);index++){
      const row=rows[index],body=bodies[index];
      if(body.id!==row[11]||![0,1,2].every(axis=>view.getUint32(body.address+layout.ballState+axis*4,true)===word(row[axis])))throw Error('Native body identity/position changed during snapshot');
    }
    let contactStorage;
    if(recordContactSlots){
      // PhysicsEngine clears size after a pass but retains vector capacity.
      // These are raw retained slots, potentially stale beyond the last pass;
      // they are diagnostics, never represented as the active contact list.
      const begin=view.getUint32(gravityAddress+20,true),end=view.getUint32(gravityAddress+24,true),capacity=view.getUint32(gravityAddress+28,true),byAddress=new Map(bodies.map(body=>[body.address,body.id]));
      if(begin>end||end>capacity||capacity>memory.buffer.byteLength||(capacity-begin)%48)throw Error('Native contact vector ABI changed');
      const retained=[];
      for(let address=begin;address<capacity;address+=48){
        const ball=view.getUint32(address,true),object=view.getUint32(address+4,true);if(!byAddress.has(ball)||object<64||object+144>memory.buffer.byteLength)continue;
        retained.push({slot:(address-begin)/48,ballID:byAddress.get(ball),object,time:view.getFloat32(address+8,true),gap:view.getFloat32(address+12,true),normal:vector(address+16),normalVelocity:view.getFloat32(address+40,true),isContact:!!view.getUint8(address+46),friction:view.getFloat32(object+52,true),bounds:Array.from({length:6},(_,i)=>view.getFloat32(object+20+i*4,true)),shapeWords:Array.from({length:20},(_,i)=>view.getUint32(object+64+i*4,true))});
      }
      contactStorage={size:(end-begin)/48,capacity:(capacity-begin)/48,retained};
    }
    return {gravityAddress,gravity:vector(gravityAddress),swapBallCollisions:!!view.getUint8(gravityAddress+16),...(contactStorage?{contactStorage}:{}),balls:bodies.map(({id,address})=>{
      const orientation=Array.from({length:9},(_,index)=>view.getFloat32(address+layout.orientation+index*4,true));
      const [a,b,c,d,e,f,g,h,i]=orientation,determinant=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
      if(!orientation.every(Number.isFinite)||Math.abs(determinant-1)>.00001)throw Error('Native orientation ABI validation failed');
      return {id,address,orientation,position:vector(address+layout.ballState),velocity:vector(address+layout.ballState+12),momentum:vector(address+layout.momentum),collisionGap:view.getFloat32(address+layout.collisionGap,true),eventPosition:vector(address+layout.lastEventPosition),eventDistance:view.getFloat32(address+layout.eventDistance,true),locked:!!view.getUint8(address+layout.locked)};
    })};
  }
  return {scan,read};
}
