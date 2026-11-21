// Measurement overrides are applied only by comparison tools, never gameplay.
export function applyReferencePhysics(layout,objects,fixture){
  Object.assign(layout.physics,fixture.controlledOverrides);
  if(fixture.allScatterZero)for(const item of [...layout.items,...objects.objects]){
    if('scatter' in item)item.scatter=0;
    if(item.contact_physics)item.contact_physics.scatter=0;
  }
}
// The native capture does not expose its random generator state. Use a fixed
// independent seed for repeatable diagnostic replays, never a seed fitted to a
// measured trajectory. This leaves native contact-order variation visible.
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
  const records=[...game.toyRecords,...game.records],columns=fixture.initialBallStateColumns;
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
  return measured;
}
