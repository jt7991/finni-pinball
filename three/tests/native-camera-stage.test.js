import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';import{createHash}from 'node:crypto';
import{computeNativeCamera,nativeCameraPresets}from '../native-camera.js';
import{stageNativeCamera,nativeCameraForPart,nativeCameraAfterProbe}from '../native-camera-stage.js';
import{nativePrimitiveWorld,nativeModelMatrices}from '../primitive-transform.js';
import{nativeShaderArray}from '../native-shader-state.js';import{nativeBallMatrices}from '../native-ball-render-state.js';import{nativeReflectionCamera}from '../native-reflection.js';
import{readNativeFrameHistory}from '../../scripts/native-frame-history-package.mjs';
const json=file=>JSON.parse(fs.readFileSync(new URL('../public/'+file,import.meta.url)));
test('native camera transition retains the entry view after its first source reflection probe',()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/vpx-main-camera-stage-native.json.gz',import.meta.url)))),bytes=Buffer.from(packet.bytes,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sourceSHA256);const source=JSON.parse(bytes);assert.equal(source.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(source.errors,[]);
 const table=json('native-table/native-table.json'),bounds=json('camera-bounds.json'),probe=table.parts.find(part=>part.probe),frames=source.frames,frame=frames[2];nativeCameraPresets.authoredStartup=[48,48,5,50,-200,1];
 const entry=computeNativeCamera(bounds,frame.canvas.width/frame.canvas.height,'authoredStartup'),current=computeNativeCamera(bounds,frame.canvas.width/frame.canvas.height,'balanced'),stage=stageNativeCamera(current,entry,probe.spec.native_source_order);
 const candidates=table.parts.filter(part=>part.transform!=='identity').map(part=>({part,world:nativePrimitiveWorld(part.spec)})),key=values=>JSON.stringify(Array.from(values));let before=0,after=0,fields=0;
 for(const row of frame.draws.filter(row=>row.target===frame.images.hdr.id&&row.matrixKind==='basic')){
  const matches=candidates.filter(candidate=>key(nativeShaderArray(candidate.world))===key(row.matrices.slice(0,16)));if(!matches.length)continue;
  const cameras=matches.map(({part})=>nativeCameraForPart(stage,part.spec));if(cameras.some(camera=>camera!==cameras[0]))continue;
  const camera=cameras[0],expected=nativeModelMatrices(matches[0].world,camera);
  // JSON native observations do not retain the sign of zero. Every other
  // Float32 field must agree exactly; no numeric tolerance is applied.
  assert.ok(Array.from(expected).every((value,j)=>value===row.matrices[j]),matches[0].part.spec.name+' source camera packet');fields+=expected.length;if(camera===stage)before++;else after++;
 }
 assert.ok(before>20);assert.ok(after>2);assert.ok(fields>2000);
 const mainBalls=frame.draws.filter(row=>row.target===frame.images.hdr.id&&row.matrixKind==='ball');assert.equal(mainBalls.length,3);for(const row of mainBalls)assert.ok(Array.from(nativeBallMatrices(current)).every((value,j)=>value===row.matrices[j]),'native shared ball shader restores its pre-probe camera packet');
 const reflectedBalls=frame.draws.filter(row=>row.target===frame.images.reflection.id&&row.matrixKind==='ball');assert.equal(reflectedBalls.length,3);for(const row of reflectedBalls)assert.ok(Array.from(nativeBallMatrices(nativeReflectionCamera(nativeCameraAfterProbe(stage),probe.probe.plane))).every((value,j)=>value===row.matrices[j]),'reflected native ball camera packet');
 assert.equal(stageNativeCamera(current,current,probe.spec.native_source_order),current,'entry/current views agree again on the next frame');
});
test('both complete native histories retain preparation cursors, UI inputs and every presentation clock',()=>{
 for(const name of ['first','independent']){
  const {capture}=readNativeFrameHistory(new URL('./fixtures/vpx-main-startup-whole-history-'+name+'-native.json.gz',import.meta.url));assert.deepEqual(capture.presentation.errors,[]);
  const prepared=capture.clock.preparedFrames.slice(0,6);assert.deepEqual(prepared.map(row=>row.frameIndex),[1,2,3,4,5,6]);assert.equal(prepared[2].physicsClock.current,prepared[2].physicsClock.start,'first prepared live frame precedes physical interval0');
  assert.ok(capture.playerInputs.some(row=>row.script.includes('Table1.Inclination=30:')));assert.ok(capture.playerInputs.some(row=>row.script==='DisableStaticPrerendering=False'));
  const submissions=capture.presentation.records.filter(row=>row.frameIndex<=6);assert.equal(submissions.length,36);assert.ok(submissions.slice(0,12).every(row=>row.clocks.length===0));assert.ok(submissions.slice(12).every(row=>row.clocks.length===2&&row.clocks.every(clock=>clock.name==='emscripten_date_now')));
 }
});
