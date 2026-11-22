// Independent diagnostic clocks at explicitly different phase boundaries.
// No measured phase, lag or body state is applied to either game.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const options=name=>process.argv.filter(arg=>arg.startsWith(`--${name}=`)).map(arg=>arg.slice(name.length+3)),nativeFiles=options('native'),portFiles=options('port'),output=options('output')[0];
assert.ok(nativeFiles.length&&portFiles.length&&output,'Supply --native=CAPTURE --port=TRACE --output=REPORT');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),load=file=>{const bytes=fs.readFileSync(file);return {file,sha256:sha(bytes),data:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''))};},summary=values=>{values.sort((a,b)=>a-b);return {samples:values.length,min:values[0],p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};};
const native=[];
for(const file of nativeFiles){
 const input=load(file),capture=input.data;assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(capture.scenario,'ordinary-start-physics-clocks');assert.deepEqual(capture.errors,[]);
 const records=capture.records.map(row=>{
  assert.ok(row.physicsClock);assert.equal(row.clockSource.frequency,'1000000');assert.equal(row.clockSource.monotonicRaw,false);assert.ok(row.clocks.length>=2);assert.equal(row.clocks[0].name,'emscripten_date_now');
  const clock=row.physicsClock,now=BigInt(row.clocks[0].value)*1000n-BigInt(row.clockSource.startCounter),start=BigInt(clock.startUsec),current=BigInt(clock.currentUsec),next=BigInt(clock.nextUsec),boundaryMs=Number(current-start)/1000;
  assert.equal(next-current,1000n);assert.ok(start<=current);assert.ok(row.clocks.every(clock=>Number.isInteger(clock.value)));
  return {physicsBoundaryAgeMs:Number(now-current)/1000,lastPhysicalTimestampAgeMs:Number(now-BigInt(row.lastPhysicsUsec))/1000,preparedFrameAgeMs:Number(now-BigInt(clock.startFrameUsec))/1000,scheduledBallAgeMs:Number(now-BigInt(row.scheduledUsec))/1000,gameTimeSecondsVsBoundaryMs:clock.gameTimeSeconds*1000-boundaryMs,gameTimeMillisecondsVsBoundaryMs:row.frameTimeMilliseconds-boundaryMs};
 });
 for(const draw of capture.draws)assert.ok(capture.records.some(row=>row.orientationBits.every((value,index)=>value===draw.orientationBits[index])),'original callback/GPU upload linkage retained');
 native.push({file,sha256:input.sha256,cpuRate:capture.cpuRate,records:records.length,actualGPUUploads:capture.draws.length,preparedFrames:new Set(capture.records.map(row=>row.physicsClock.startFrameUsec)).size,scope:'Actual original Ball::Render submission callback. Clock-only ordinary Start; no poses, clocks, RNG, uniforms or commands replaced.',clocks:Object.fromEntries(Object.keys(records[0]).map(key=>[key,summary(records.map(row=>row[key]))]))});
}
const port=[];
for(const file of portFiles){
 const input=load(file);for(const run of input.data.inputTraces){
  assert.ok(run.trace.length>20);assert.ok(run.frameTrace?.length>100);
  for(const row of run.trace){assert.ok(Number.isFinite(row.sent)&&Number.isFinite(row.arrived)&&Number.isFinite(row.published)&&Number.isFinite(row.observed));assert.equal(row.workerHandlingMs,row.published-row.arrived);}
  port.push({file,sha256:input.sha256,name:run.name,url:run.url,cpuRate:run.cpuRate,scope:'Read-only production worker response, before the main thread submits GPU draws. Frame response includes preparation and publication cost. This is earlier than the native callback boundary.',inputs:run.trace.length,inputStages:Object.fromEntries(['deliveryToWorkerMs','workerHandlingMs','returnToMainMs'].map(key=>[key,summary(run.trace.map(row=>row[key]))])),frames:['frame','submission'].map(type=>{const frames=run.frameTrace.filter(frame=>frame.type===type),bounded=frames.filter(frame=>frame.overdueTicksLowerBound!==undefined);return {type,lastPhysicalTimestampAgeMs:summary(frames.map(frame=>frame.physicsStepAgeMs)),precedingPumpReportedLagMs:summary(frames.map(frame=>frame.lagMs)),...(bounded.length?{overdueTicksLowerBound:summary(bounded.map(frame=>frame.overdueTicksLowerBound)),framesWithOverdueTicks:bounded.filter(frame=>frame.overdueTicksLowerBound>0).length}:{})};})});
 }
}
const report={scope:'Unmodified source and production games at different explicitly observed phase boundaries. Independent real clocks/RNG and ordinary Start. These observations do not establish input-latency or whole-game parity, or justify adding fitted lag, phase offsets or forced ticks. Cross-context delivery samples retain clock precision artifacts without clamping.',native,port};fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
