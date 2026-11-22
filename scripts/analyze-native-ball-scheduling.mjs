// Read-only diagnostic for the independently captured native submission phase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {nativeBallRotationScale} from '../three/native-ball-render-state.js';
import {nativeBallSubmission,nativeWebGLUsec} from '../three/ball-presentation.js';

const file=process.argv[2]??'.work/three-review/native-ball-scheduled-rotation.json';
const capture=JSON.parse(fs.readFileSync(file));
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
assert.deepEqual(capture.errors,[]);
assert.ok(capture.records.length>0);
const vector=values=>Object.fromEntries(['x','y','z'].map((axis,index)=>[axis,values[index]]));
const rows=capture.records.map(row=>{
  const current=nativeBallRotationScale(row.currentOrientation,row.radius);
  const currentBits=new Uint32Array(current.buffer);
  const scheduledBits=new Uint32Array(Float32Array.from(row.rotScale).buffer);
  const changedFields=Array.from(currentBits).filter((value,index)=>value!==scheduledBits[index]).length;
  const epoch=Number(BigInt(row.clockSource.startCounter)/1000n);
  const nowUsec=nativeWebGLUsec(row.clocks[0].value,epoch);
  const input={playing:true,nowUsec,predictionNowUsec:nativeWebGLUsec(row.clocks[1].value,epoch),lastPhysicsUsec:BigInt(row.lastPhysicsUsec)};
  const body={position:vector(row.position),velocity:vector(row.velocity),locked:row.locked,radius:row.radius};
  const submission=nativeBallSubmission(row.rotScale,body,input);
  assert.deepEqual(Array.from(new Uint32Array(submission.orientation.buffer)),row.orientationBits);
  return{ball:row.ball,scheduledUsec:row.scheduledUsec,lastPhysicsUsec:row.lastPhysicsUsec,changedFields,elapsedToSubmissionUsec:Number(nowUsec-BigInt(row.scheduledUsec))};
});
console.log(JSON.stringify({source:file,records:rows.length,scheduledRotationDiffersFromLatest:rows.filter(row=>row.changedFields).length,rotationFieldsDifferent:rows.reduce((sum,row)=>sum+row.changedFields,0),submissionMatrixFields:rows.length*16,submissionDifferences:0,scope:'Original captured rotation/scale versus latest physical orientation at native submission. No runtime writes, phase search or claim of complete frame equivalence.'}));
