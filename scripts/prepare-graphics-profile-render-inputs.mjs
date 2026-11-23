// Explicit shared HDR/depth/history/clock inputs for isolated GPU comparisons.
// No measured frame state is copied into production assets.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const root='three/public/native-postprocess/',metadata=JSON.parse(fs.readFileSync(root+'native-postprocess.json')),sha=b=>createHash('sha256').update(b).digest('hex');
for(const [name,file]of [['performance','current-main-performance-postprocess.json'],['performance-nudged','current-main-performance-nudged-postprocess-r2.json'],['detailed','current-main-detailed-postprocess.json']]){
 const bytes=fs.readFileSync('.work/three-review/'+file),capture=JSON.parse(bytes),directory='.work/native-main-'+name+'-postprocess-renderer';
 assert.deepEqual(capture.errors,[]);assert.equal(capture.engineSHA256,metadata.engineSHA256);assert.equal(capture.reference.sourceSha256,metadata.sourceSha256);fs.mkdirSync(directory,{recursive:true});
 for(const spec of Object.values(metadata.programs))for(const descriptor of [spec.vertex,spec.fragment])fs.copyFileSync(root+descriptor.file,directory+'/'+descriptor.file);
 for(const spec of Object.values(metadata.textures))fs.copyFileSync(root+spec.file,directory+'/'+spec.file);
 fs.writeFileSync(directory+'/native-postprocess.json',JSON.stringify(metadata));
 for(const stage of capture.stages.slice(2)){
  const program=metadata.programs[stage.name];assert.ok(program,stage.name);
  for(const [key,type]of [['vertex',35633],['fragment',35632]])assert.equal(sha(Buffer.from(capture.programs[stage.program].shaders.find(s=>s.type===type).source)),program[key].sha256,stage.name+' '+key);
 }
 const image=(value,file)=>{if(!value)return;const bytes=Buffer.from(value.bytes,'base64');fs.writeFileSync(directory+'/'+file,bytes);const {bytes:ignored,...rest}=value;return{...rest,file,byteLength:bytes.length,sha256:sha(bytes)};};
 const stages=capture.stages.map((stage,index)=>({...stage,inputImages:Object.fromEntries(Object.entries(stage.inputImages).map(([key,value])=>[key,image(value,index+'-'+key+'.bin')])),priorTarget:image(stage.priorTarget,index+'-prior.bin'),output:image(stage.output,index+'-output.bin')}));
 fs.writeFileSync(directory+'/reference.json',JSON.stringify({engineSHA256:capture.engineSHA256,sourceSha256:metadata.sourceSha256,captureSHA256:sha(bytes),quality:capture.quality,nudgeInput:capture.nudgeInput,stages,clockSamples:capture.clockSamples,priorErrors:capture.priorErrors,scope:'Original native frame buffers as explicit shared postprocess component inputs. Current outputs are comparisons only. Nudge uses source KeyZ and observed native cabinet elapsed counter; no fitted offset.'}));
 console.log(JSON.stringify({directory,stages:stages.slice(2).map(s=>s.name)}));
}
