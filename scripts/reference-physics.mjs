import {nativeRandom} from '../three/native-random.js';
// Measurement overrides are applied only by comparison tools, never gameplay.
export function applyReferencePhysics(layout,objects,fixture){
  Object.assign(layout.physics,fixture.controlledOverrides);
  if(fixture.allScatterZero)for(const item of [...layout.items,...objects.objects]){
    if('scatter' in item)item.scatter=0;
    if(item.contact_physics)item.contact_physics.scatter=0;
  }
}
// Older native captures omit the generator state. Use a fixed independent seed
// for their repeatable replays, never a seed fitted to a measured trajectory.
// New complete-state captures restore the observed state separately below.
export function referenceRandom(){
  let state=12345;
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

// Seed the measured Float32 table position before publishing it to Rapier.
// Writing scaled world coordinates into Rapier first loses table-space ULPs,
// particularly after reflecting Y around the 2115-VPU playfield height.
export function placeReferenceBall(game,record,scenario){
  const body=game.nativePositionUnits?game.nativeBall(record.body).body:record.body;
  body.setTranslation({x:scenario.x*.01,y:(2115-scenario.y)*.01,z:(scenario.z??25)*.01},true);
  record.body.setLinvel({x:scenario.vx??0,y:-(scenario.vy??0),z:scenario.vz??0},true);
  record.body.setAngvel({x:0,y:0,z:0},true);
}

// Optional diagnostic captures include all bodies at the measured reset clock.
// Animation balls must participate with their observed state: their impacts
// split time for every mover even when they are outside the visible playfield.
export function restoreReferenceBalls(game,fixture,scenario,fallback){
  if(!scenario.initialBallStates)return fallback;
  const records=game.physicalRecords,columns=fixture.initialBallStateColumns;
  if(records.length!==scenario.initialBallStates.length)throw Error('native capture/replay body count differs');
  let measured;
  scenario.initialBallStates.forEach((row,index)=>{
    const values=Object.fromEntries(columns.map((key,i)=>[key.toLowerCase(),row[i]])),record=records[index];
    if(values.mass!==record.body.mass()||values.radius!==25)throw Error('unsupported native reference ball dimensions');
    placeReferenceBall(game,record,{...values,vx:values.velx,vy:values.vely,vz:values.velz});
    for(const axis of ['x','y','z'])game.nativeBall(record.body).setAngularMomentum(axis,values['angmom'+axis]);
    if(values.id===scenario.initialMeasuredBallID)measured=record;
  });
  if(!measured)throw Error('native measured ball missing from initial snapshot');
  if(scenario.initialNativeInternals){
    const internals=scenario.initialNativeInternals,idColumn=columns.indexOf('ID');
    game.ballCollisionSwap=internals.swapBallCollisions;
    for(const body of internals.balls){
      const index=scenario.initialBallStates.findIndex(row=>row[idColumn]===body.id),record=records[index];if(!record)throw Error('native internal state refers to a missing body');
      if(!!record.held!==body.locked)throw Error('native internal frozen state differs from replay');
      // Native CStr(CDbl(tinyValue)) can omit its exponent in this WASM build.
      // The validated memory snapshot retains all Float32 bits, including the
      // nearly stationary animation balls, rather than reconstructing text.
      if(body.position&&body.velocity&&body.momentum){
        placeReferenceBall(game,record,{x:body.position[0],y:body.position[1],z:body.position[2],vx:body.velocity[0],vy:body.velocity[1],vz:body.velocity[2]});
        for(const [axis,key]of ['x','y','z'].entries())game.nativeBall(record.body).setAngularMomentum(key,body.momentum[axis]);
      }
      const native=game.nativeBall(record.body);native.order=body.address;native.collisionGap=body.collisionGap;
      native.eventPosition=Object.fromEntries(['x','y','z'].map((key,index)=>[key,body.eventPosition[index]]));native.eventDistance=body.eventDistance;
      game.ballSpin.state(native.body).gap=body.collisionGap*.01;
    }
  }
  if(scenario.initialBallTrails){
    const idColumn=columns.indexOf('ID'),byId=new Map(scenario.initialBallStates.map((row,index)=>[row[idColumn],records[index]]));
    for(const record of records)game.ballSpin.state(game.nativeBall(record.body).body).positions=Array(10);
    for(const {slot,balls}of scenario.initialBallTrails)for(const [id,x,y,z]of balls){
      const record=byId.get(id);if(!record)throw Error('native trail refers to a missing initial body');
      game.ballSpin.state(game.nativeBall(record.body).body).positions[slot]={x:x*.01,y:(2115-y)*.01,z:z*.01};
    }
    const offset=scenario.initial[0]-Math.round(game.time*1000);
    for(const method of ['apply','record']){const original=game.ballSpin[method].bind(game.ballSpin);game.ballSpin[method]=(body,ms)=>original(body,ms+offset);}
  }
  if(scenario.nativeRandomFrames){
    if(fixture.nativeRandom.requireContinuity){
      const through=Math.min(fixture.nativeRandom.continuityThroughMilliseconds??Infinity,Math.max(...scenario.samples.map(row=>row[0])));
      for(let index=0;index<through;index++)if(scenario.nativeRandomFrames[index]?.[0]!==index+1)throw Error('Native reference omitted a physics-frame marker');
    }
    const initial=scenario.initialNativeRandom,frames=new Map(scenario.nativeRandomFrames.map(([ms,low,high])=>[ms,[low,high]])),bodyFrames=new Map(scenario.nativeRandomFrames.filter(row=>row[3]).map(row=>[row[0],row[3]])),first=frames.get(1)??[initial.low,initial.high],random=nativeRandom(...first);
    game.random=random;game.nativeRandomAudit=[];game.nativeBodyAudit=[];const step=game.step.bind(game),origin=Math.round(game.time*1000);
    game.step=()=>{
      const ms=Math.round(game.time*1000)-origin+1,expected=frames.get(ms),actual=random.getState();
      const agrees=!expected||actual.every((word,i)=>word===expected[i]);
      const observed=bodyFrames.get(ms);
      if(observed){
        const bodies=records.map((record,index)=>{
          const native=game.nativeBall(record.body),state=native.snapshot(),reference=observed.balls[index],error=(a,b)=>Math.hypot(...['x','y','z'].map((key,i)=>a[key]-b[i]));
          return {id:reference.id,positionError:error(state.p,reference.position),velocityError:error(state.v,reference.velocity),momentumError:error(state.m,reference.momentum),actual:state,expected:reference};
        });
        game.nativeBodyAudit.push({ms,swap:game.ballCollisionSwap,expectedSwap:observed.swapBallCollisions,bodies});
      }
      if(fixture.nativeRandom.requireContinuity&&ms<=(fixture.nativeRandom.continuityThroughMilliseconds??Infinity)&&!agrees)throw Error(`Native random-state progression differs before physics frame ${ms}`);
      const before=random.calls;step();game.nativeRandomAudit.push({ms,agrees,draws:random.calls-before,state:random.getState(),nextNativeState:frames.get(ms+1)});
    };
  }
  return measured;
}
