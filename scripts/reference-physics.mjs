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
