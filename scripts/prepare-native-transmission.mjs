// Export the actual bulb meshes and shader programs, keeping observed light
// states and rendered pixels in separate test references.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{
  capture:{type:'string',default:'.work/three-review/native-transmission-blur-programs.json'},
  source:{type:'string',default:'.work/native-render-source/gameitems'},
  output:{type:'string',default:'.work/native-transmission-renderer'},
}});
const capture=JSON.parse(fs.readFileSync(values.capture)),sha=b=>createHash('sha256').update(b).digest('hex'),f=Math.fround;
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);
assert.match(capture.transmission.stage,/^before native basic draw /);
const objects=fs.readdirSync(values.source).filter(n=>n.endsWith('.json')).map(file=>{
  const [kind,spec]=Object.entries(JSON.parse(fs.readFileSync(path.join(values.source,file))))[0];return{kind,spec};
}),lights=objects.filter(o=>o.kind==='Light'&&o.spec.is_bulb_light&&o.spec.transmission_scale>0&&!o.spec.is_backglass),
draws=capture.draws.filter(d=>d.matrixKind==='light'&&d.targetTexture===capture.transmission.id);
assert.equal(lights.length,8);assert.equal(draws.length,8);
fs.mkdirSync(values.output,{recursive:true});
const write=(file,bytes)=>{fs.writeFileSync(path.join(values.output,file),bytes);return{file,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)};};
const chunks=[],parts=[],references=[];let offset=0;
for(const draw of draws){
  const center=draw.uniforms.lightCenter_maxRange,matches=lights.filter(o=>f(o.spec.center.x)===center[0]&&f(o.spec.center.y)===center[1]);
  assert.equal(matches.length,1,'Unique authored transmitting light');
  const spec=matches[0].spec,surface=spec.surface?objects.find(o=>o.kind==='Wall'&&o.spec.name.toLowerCase()===spec.surface.toLowerCase()):null;
  assert.ok(!spec.surface||surface,'Known authored light surface');
  const surfaceHeight=f(surface?.spec.height_top??0);
  assert.equal(f(surfaceHeight+f(spec.height)),center[2],'Source light height');
  const mesh=capture.meshes[draw.mesh],vertexBytes=Buffer.from(mesh.vertexBytes,'base64'),indices=Buffer.from(mesh.indexBytes,'base64');
  assert.equal(vertexBytes.length,mesh.vertices*32);assert.equal(indices.length,draw.count*4);
  parts.push({spec:{...spec,surface_height:surfaceHeight},vertices:mesh.vertices,indices:draw.count,vertexByteOffset:offset,indexByteOffset:offset+vertexBytes.length,
    sourceVertexSHA256:sha(vertexBytes),sourceIndexSHA256:sha(indices)});
  chunks.push(vertexBytes,indices);offset+=vertexBytes.length+indices.length;
  references.push({name:spec.name,uniforms:draw.uniforms,matrixBits:draw.matrixBits,state:draw.state});
  assert.equal(draw.program,draws[0].program,'Same native bulb shader');
}
const programs={},exportProgram=(name,program)=>{
  const vertex=program.shaders.find(s=>s.type===35633).source,fragment=program.shaders.find(s=>s.type===35632).source;
  return{vertex:write(name+'.vert.glsl',vertex),fragment:write(name+'.frag.glsl',fragment)};
};
programs.bulb=exportProgram('bulb',capture.programs[draws[0].program]);
assert.equal(capture.blurPrograms.length,2);
for(const program of capture.blurPrograms){
  const fragment=program.shaders.find(s=>s.type===35632).source;
  const axis=fragment.includes('//ps_main_fb_blur_horiz19x19()')?'horizontal':'vertical';
  assert.ok(!programs[axis],'Unique native blur axis');programs[axis]=exportProgram('blur-'+axis,program);
}
assert.ok(programs.horizontal&&programs.vertical);
const geometry=write('transmission-meshes.bin',Buffer.concat(chunks)),metadata={engineSHA256:capture.engineSHA256,
  sourceTableSHA256:capture.reference.controlledSha256,programs,geometry,parts};
write('native-transmission.json',JSON.stringify(metadata));
// These are independent observations, never loaded by the production renderer.
const pixels=write('reference.rgba32f.bin',Buffer.from(capture.transmission.pixelBytes,'base64'));
const stages=capture.blurStages?.map(stage=>({axis:stage.axis,scissor:stage.scissor,scissorEnabled:stage.scissorEnabled,
  priorTarget:write('reference-'+stage.axis+'-prior.rgba32f.bin',Buffer.from(stage.priorTarget.pixelBytes,'base64')),
  input:write('reference-'+stage.axis+'-input.rgba32f.bin',Buffer.from(stage.input.pixelBytes,'base64')),
  output:write('reference-'+stage.axis+'-output.rgba32f.bin',Buffer.from(stage.output.pixelBytes,'base64')),
}));
write('reference.json',JSON.stringify({viewport:capture.viewport,texture:{width:capture.transmission.width,height:capture.transmission.height,...pixels},references,stages,
  priorNativeGLErrors:capture.priorDrawErrors,stage:capture.transmission.stage,scope:'Exact native light transmission texture before material sampling, not the later bloom result.'}));
console.log(JSON.stringify({parts:parts.length,geometryBytes:geometry.bytes,programs:Object.keys(programs),output:values.output}));
