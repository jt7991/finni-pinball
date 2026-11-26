import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const usual='842d30140550db5f37befddd3b3a265c3ec5fd0312363e7da9c40e229815b3aa';
const alternate='e8ab64ad3d6ad26053b07fd2f04b6e30ecba235023530b9a81fb50314ba1e163';

test('original VPX bloom controls retain context, program and dither observations without replacing a historical expectation',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-bloom-context-controls-native.json.gz',import.meta.url));
 assert.equal(sha(bytes),'e47c2581b9bf0be5ba36eff6200bbce1268dfa3f49b74cccc8838499f2c16988');
 const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-bloom-context-controls-v1');assert.equal(packet.reports.length,3);
 const parentBytes=fs.readFileSync(new URL('fixtures/vpx-native-bloom-component-hard-round.json.gz',import.meta.url));assert.equal(sha(parentBytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
 const parent=JSON.parse(gunzipSync(parentBytes)),program=parent.programs.find(p=>p.name==='fb_blur_horiz39x39'),shaderHashes=program.shaders.map(s=>({type:s.type,sha256:sha(s.source)}));
 const expected=[
  {kind:'separate-context',bytes:51865938,sha:'56a8e06b0e4dc025ac6bfbbb78242d67a8ac67b1f7ccb48e44ffd3f19664ca7a',witnessAlternate:1,controlAlternate:0,witnessPairs:1,controlPairs:0},
  {kind:'cloned-program',bytes:102562080,sha:'8a46dece361cfb1b716d204fc3f6ab46670a48b5a7cefe022bdc5e34f26d51bd',witnessAlternate:5,controlAlternate:2,witnessPairs:3,controlPairs:0},
  {kind:'undithered',bytes:102560755,sha:'cab55bba9be5cdfdda704ffeb1c31938ce7b4365ab3bad79d57f2dfe22b4371b',witnessAlternate:4,controlAlternate:0,witnessPairs:4,controlPairs:0}
 ];
 function checkRows(rows,alternates,pairs,recordedState){
  assert.equal(rows.length,1200);let alternateCount=0,pairCount=0;
  for(const [index,row]of rows.entries()){
   assert.equal(row.sample,index+1);assert.equal(row.inputSHA256,parent.frame.images.bloomCut.sha256);assert.equal(row.sha256,row.repeatSHA256);
   for(const hash of [row.sha256,row.pairedSHA256]){assert.ok([usual,alternate].includes(hash));if(hash===alternate)alternateCount++;}
   if(row.sha256!==row.pairedSHA256)pairCount++;
   if(recordedState){assert.deepEqual(row.stateBefore,row.statePaired);assert.equal(row.stateSHA256,sha(JSON.stringify(row.stateBefore)));assert.equal(row.stateSHA256,row.pairedStateSHA256);}
  }
  assert.equal(alternateCount,alternates);assert.equal(pairCount,pairs);
 }
 for(const [i,entry]of packet.reports.entries()){
  const e=expected[i],gzip=Buffer.from(entry.gzipBase64,'base64');assert.equal(entry.kind,e.kind);assert.equal(gzip.length,entry.gzipBytes);assert.equal(sha(gzip),entry.gzipSHA256);
  const source=gunzipSync(gzip);assert.equal(source.length,entry.sourceBytes);assert.equal(source.length,e.bytes);assert.equal(sha(source),entry.sourceSHA256);assert.equal(sha(source),e.sha);
  const r=JSON.parse(source);assert.equal(r.playerRuntime,'vpx');assert.equal(r.engineSHA256,parent.engineSHA256);assert.deepEqual(r.source,parent.source);assert.equal(r.fixtureSHA256,sha(parentBytes));assert.equal(r.nativeExpectedSHA256,alternate);
  assert.equal(r.referenceMetadata.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(r.referenceMetadata.controlledSha256,r.referenceMetadata.sourceSha256);assert.deepEqual(r.referenceMetadata.controlledOverrides,{});
  assert.equal(sha(Buffer.from(r.instrumentation.sourceBase64,'base64')),r.instrumentation.sourceSHA256);
  for(const key of ['observeDrawState','pairedDraws','verifyInput','repeatReadback'])assert.equal(r.diagnostics[key],true);
  assert.deepEqual(r.state.shaderSourceHashes,shaderHashes);assert.equal(r.state.graphicsProfile,'detailed');assert.deepEqual(r.state.encoding,{reads:9600,deferred:9600,encodes:0,queued:9600,completed:9600});
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.state.errors,[]);assert.deepEqual(r.state.restoreErrors,[]);assert.ok(r.state.priorErrors.every(row=>row.error===1280),'Existing native GL errors remain recorded separately');
  assert.equal(r.state.rows,1200);for(let j=1;j<1200;j++)assert.ok(r.rows[j].tonemap>r.rows[j-1].tonemap);
  checkRows(r.rows,e.witnessAlternate,e.witnessPairs,true);
  if(e.kind==='separate-context'){
   assert.equal(r.separateContext,true);assert.equal(r.state.independentContext.sharesPlayerContext,false);assert.deepEqual(r.state.independentContext.renderer,r.state.renderer);assert.deepEqual(r.state.independentContext.context,r.state.context);assert.deepEqual(r.state.independentContext.shaderSourceHashes,shaderHashes);
   checkRows(r.independentRows,e.controlAlternate,e.controlPairs,false);
  }else{
   const control=e.kind==='cloned-program'?r.clonedRows:r.unditheredRows;
   assert.equal(r.state.clonedProgram.sharesPlayerContext,true);assert.deepEqual(r.state.clonedProgram.shaderSourceHashes,shaderHashes);checkRows(control,e.controlAlternate,e.controlPairs,true);
   for(let j=0;j<1200;j++){
    const a=r.rows[j].stateBefore,b=control[j].stateBefore;
    if(e.kind==='cloned-program'){
     const {program:original,...left}=a,{program:clone,...right}=b;assert.notEqual(original,clone);assert.deepEqual(left,right);
    }else{assert.equal(r.state.clonedProgram.sharesPlayerProgram,true);assert.equal(a.caps.DITHER,true);assert.equal(b.caps.DITHER,false);assert.deepEqual({...a,caps:{...a.caps,DITHER:false}},b);}
   }
  }
 }
 // These are complete diagnostic records, not an output envelope for rendering.
 // They neither identify the backend cause nor make a historical frame pass.
});
