import fs from 'node:fs';import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';
import {nativeBallMemoryObserver} from '../../scripts/native-ball-memory-observer.mjs';
import {nativePlungerMemoryObserver} from '../../scripts/native-plunger-memory-observer.mjs';
import {nativePackedCapture} from '../../scripts/native-packed-capture.mjs';
import {nativePackedFrameDecoder,expandNativePackedFrames,NATIVE_PACKED_FRAME_FORMAT} from '../../scripts/native-packed-frames.mjs';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

// Relocate independently captured native values into a small synthetic ABI
// image. The original object reader is the oracle, not the packed decoder.
function setup(){
 const fixture=readReferenceFixture(new URL('fixtures/vpx-main-99eff88-qualified-mission7-30000-native.json.gz',import.meta.url));
 const initial=fixture.cases[0].initialNativeInternals,layout=fixture.nativeMemoryLayout.layout;
 const spec=JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))).items.find(item=>item.kind==='Plunger');
 const memory={buffer:new ArrayBuffer(10*1024*1024)};let view=new DataView(memory.buffer);
 const gravity=4096,player=131072,list=36864,mover=98304,part=102400,addresses=new Map();
 const vector=(at,values)=>values.forEach((value,i)=>view.setFloat32(at+i*4,value,true));
 vector(gravity,initial.gravity);view.setUint32(gravity+12,fixture.nativePhysicsMaxLoops,true);
 for(const at of [20,24,28])view.setUint32(gravity+at,6144,true);
 view.setUint32(9191328,player,true);view.setUint32(player+333740,gravity-68,true);
 view.setUint32(player+333744,list,true);view.setUint32(player+333752,list+400,true);
 function body(state,slot){
  const address=8192+slot*1024,owner=address-288;addresses.set(state.id,address);
  view.setUint32(address+64,owner,true);view.setUint32(owner+668,state.id,true);
  view.setUint32(address+layout.collisionBall,address,true);view.setUint32(address+layout.moverSelf,address,true);
  vector(address+layout.ballState,state.position);vector(address+layout.ballState+12,state.velocity);
  view.setFloat32(address+layout.ballState+24,25,true);view.setFloat32(address+layout.ballState+28,1,true);
  vector(address+layout.momentum,state.momentum);vector(address+layout.orientation,state.orientation);
  view.setFloat32(address+layout.collisionGap,state.collisionGap,true);view.setUint8(address+layout.locked,Number(state.locked));
  vector(address+layout.lastEventPosition,state.eventPosition);view.setFloat32(address+layout.eventDistance,state.eventDistance,true);
 }
 function roster(ids){ids.forEach((id,i)=>view.setUint32(list+i*4,addresses.get(id)-288,true));view.setUint32(player+333748,list+ids.length*4,true);}
 initial.balls.forEach(body);roster(initial.balls.map(body=>body.id));
 view.setUint32(mover+4,part,true);view.setUint32(part+404,mover-64,true);
 view.setFloat32(part+300,spec.speed_fire,true);view.setFloat32(part+304,spec.mech_strength,true);
 view.setUint8(part+384,Number(spec.is_mech_plunger));view.setUint8(part+385,Number(spec.auto_plunger));
 const rodFields=fixture.nativePlungerMemory.layout.fields;
 for(const [key,offset]of Object.entries(rodFields)){
  if(key==='fireTimer'||key==='autoFireTimer')view.setInt32(mover+offset,initial.plunger[key],true);
  else view.setFloat32(mover+offset,initial.plunger[key],true);
 }
 // Native setup can change ParkPosition later; discover with the authored
 // dimensions, then restore the actual captured runtime rest value.
 view.setFloat32(mover+768,spec.park_position,true);
 const balls=nativeBallMemoryObserver(memory,initial.gravity,fixture.nativePhysicsMaxLoops,false,true);
 const found=balls.scan(fixture.cases[0].initialBallStates);assert.deepEqual(found.layout,layout);
 const plunger=nativePlungerMemoryObserver(memory,spec);plunger.scan();
 view.setFloat32(mover+768,initial.plunger.rest,true);
 const original=balls.read;balls.read=()=>({...original(),plunger:plunger.read()});
 const packed=nativePackedCapture(balls,plunger);
 return {memory,balls,plunger,packed,initial,body,roster,addresses,layout,gravity,mover,
  view:()=>view,grow(){memory.buffer=memory.buffer.slice(0);view=new DataView(memory.buffer);}};
}

function transfer(packed){return{format:NATIVE_PACKED_FRAME_FORMAT,pageLength:65536,pages:Array.from({length:packed.summary().pages},(_,index)=>{const data=packed.exportPage(index);return{data,sha256:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')};})};}

test('packed capture preserves independent object reads across pages without writing source memory',()=>{
 const s=setup(),before=new Uint8Array(s.memory.buffer).slice(),expected=s.balls.read();
 const first=s.packed.capture(undefined);assert.deepEqual(s.packed.unpack(first),expected);
 for(let i=0;i<600;i++){
  const index=s.packed.capture(i);if(i%49===0)assert.deepEqual(s.packed.unpack(index),{...s.balls.read(),scriptRandom:i});
 }
 assert.equal(s.packed.summary().pages,2);assert.ok(s.packed.summary().samples>=33);
 assert.deepEqual(new Uint8Array(s.memory.buffer),before,'all source bytes remain unchanged');
 const hydrated=s.packed.hydrate({kind:'RNG_FRAME',ms:1,low:3,high:4,packed:first});
 assert.deepEqual(hydrated,{kind:'RNG_FRAME',ms:1,low:3,high:4,internals:expected});
 const storage=transfer(s.packed),decode=nativePackedFrameDecoder(storage);assert.deepEqual(decode(first),expected);
 const fixture={nativePackedFrameStorage:storage,cases:[{nativeRandomFrames:[[1,3,4,first]],initialNativeRandom:{low:3,high:4,packed:first}}]};
 expandNativePackedFrames(fixture);assert.deepEqual(fixture.cases[0].nativeRandomFrames[0][3],expected);assert.deepEqual(fixture.cases[0].initialNativeRandom.internals,expected);assert.equal(fixture.nativePackedFrameStorage,undefined);
 assert.deepEqual(new Uint8Array(s.memory.buffer),before,'transport and offline decoding also leave original memory unchanged');
});

test('packed capture retains roster changes, source-buffer replacement, signed zero and inactive NaN',()=>{
 const s=setup(),old=s.packed.capture(123),oldState=s.packed.unpack(old);
 const born={...s.initial.balls[3],id:44,position:[999,1700,60],velocity:[-0,-2,.5],locked:true};
 s.body(born,4);s.roster([0,44,2]);s.view().setUint8(s.gravity+16,1);
 s.view().setFloat32(s.mover+732,-0,true);s.view().setFloat32(s.mover+764,NaN,true);
 s.grow();
 s.view().setFloat32(s.addresses.get(44)+s.layout.ballState+4,1600,true);
 s.view().setFloat32(s.mover+740,.75,true);
 const current=s.packed.capture(456),state=s.packed.unpack(current);
 assert.deepEqual(state,{...s.balls.read(),scriptRandom:456});assert.deepEqual(state.balls.map(body=>body.id),[0,44,2]);
 assert.equal(Object.is(state.balls[1].velocity[0],-0),true);assert.equal(Object.is(state.plunger.speed,-0),true);assert.ok(Number.isNaN(state.plunger.fireBounce));
 assert.equal(state.balls[1].position[1],1600);assert.equal(state.plunger.pullForce,.75);
 assert.deepEqual(s.packed.unpack(old),oldState,'earlier observations cannot change with the live heap');
 const decode=nativePackedFrameDecoder(transfer(s.packed));assert.deepEqual(decode(old),oldState);assert.deepEqual(decode(current),state);
 assert.equal(Object.is(decode(current).balls[1].velocity[0],-0),true);assert.ok(Number.isNaN(decode(current).plunger.fireBounce));
});
