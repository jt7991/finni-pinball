import assert from 'node:assert/strict';
// External wall-clock inputs only. Never consume native RNG state or outputs.
export function nativeScriptClockInputs(observation,{lastFrame=Infinity,lastMilliseconds=Infinity}={}){
 assert.deepEqual(observation.errors,[]);assert.equal(observation.layout.functionIndex,18195);assert.equal(observation.layout.timerFunctionIndex,18219);
 // Observation continues while CDP retrieves the completed image capture.
 // Those later external events belong to the next frame/physical interval.
 const inside=row=>row.frameIndex<=lastFrame&&row.ms<=lastMilliseconds;
 const randomize=observation.records.filter(row=>row.count===0&&inside(row)).map(row=>{
  assert.equal(row.clocks.length,1);const clock=row.clocks[0];assert.equal(clock.name,'clock_time_get');assert.equal(clock.value,0);assert.equal(clock.args[0],0);
  // The Emscripten shim computes Date.now()*1e6 as a Double, then stores an
  // integer. Reverse that scale with rounding, preserving its original ms.
  const milliseconds=Math.round(Number(BigInt(clock.nanoseconds))/1e6);assert.ok(Number.isSafeInteger(milliseconds));return milliseconds;
 });
 assert.ok(randomize.length);const timer=observation.timerRecords.filter(inside).map(row=>{assert.equal(row.type,4);assert.ok(Number.isFinite(row.seconds)&&Math.fround(row.seconds)===row.seconds);return row.seconds;});
 return {observedRandomizeClocks:randomize,observedTimerSeconds:timer};
}
