// Export source pass membership, material constants and sampler state only.
// Native images and camera/body packets remain diagnostic expected outputs.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {nativePrimitiveWorld} from '../three/primitive-transform.js';import {nativeIdentity} from '../three/native-matrix.js';import {nativeShaderArray} from '../three/native-shader-state.js';import {computeNativeCamera} from '../three/native-camera.js';import {nativeReflectionCamera} from '../three/native-reflection.js';
const directory=process.argv[2]??'.work/three-review/native-static-prepass-r7',output=process.argv[3]??'three/public/native-static',capture=JSON.parse(fs.readFileSync(directory+'/capture.json')),draws=JSON.parse(fs.readFileSync(directory+'/draws.json')),table=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')),bounds=JSON.parse(fs.readFileSync('three/public/camera-bounds.json')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.deepEqual(capture.errors,[]);assert.deepEqual(draws.errors,[]);assert.equal(capture.engineSHA256,table.engineSHA256);
fs.mkdirSync(output,{recursive:true});const meshes=draws.meshes.map(mesh=>({vertexSHA:sha(Buffer.from(mesh.vertexBytes,'base64')),indexSHA:sha(Buffer.from(mesh.indexBytes,'base64'))})),worlds=table.parts.map(part=>Array.from(new Uint32Array(nativeShaderArray(part.transform==='identity'?nativeIdentity():nativePrimitiveWorld(part.spec)).buffer))),programs={},passes={},references={};
for(const [index,program]of draws.programs.entries()){
 const vertex=program.shaders.find(shader=>shader.type===35633).source,fragment=program.shaders.find(shader=>shader.type===35632).source,entry=Object.entries(table.programs).find(([,spec])=>spec.vertexSHA256===sha(vertex)&&spec.fragmentSHA256===sha(fragment));assert.ok(entry,'Static program must match a source table shader');programs[index]=entry[0];
}
const camera=computeNativeCamera(bounds,capture.sourceUI.width/capture.sourceUI.height,capture.sourceUI.camera),plane=table.parts.find(part=>part.probe).probe.plane;
for(const [index,average]of capture.averages.slice(-2).entries()){
 const name=index?'reflection':'main',view=index?nativeReflectionCamera(camera,plane):camera,viewBits=Array.from(new Uint32Array(nativeShaderArray(view.view).buffer)),selected=draws.draws.filter(draw=>draw.target===average.target&&viewBits.every((value,i)=>value===draw.matrixBits[16+i]));assert.equal(selected.length,index?563:493);passes[name]=[];references[name]=[];
 for(const draw of selected){
  const mesh=meshes[draw.mesh],matches=table.parts.flatMap((part,index)=>part.sourceVertexSHA256===mesh.vertexSHA&&part.sourceIndexSHA256===mesh.indexSHA&&worlds[index].every((value,i)=>value===draw.matrixBits[i])?[index]:[]);assert.equal(matches.length,1,'Unique source mesh and authored world association');const part=matches[0],record=table.parts[part],uniforms={},samplers={};
  for(const [key,value]of Object.entries(draw.uniforms))if(!['matProj[0]','w_h_height','balls[0]'].includes(key)&&!draw.textures[key])uniforms[key]=value;
  assert.ok((uniforms.mirrorNormal_factor?.[3]??0)===0);assert.ok((uniforms.lightCenter_doShadow?.[3]??0)===0);assert.equal(uniforms.doRefractions,false);
  for(const [key,binding]of Object.entries(draw.textures))samplers[key]=binding.sampler;
  const {scissorEnabled,scissor,...state}=draw.state;
  passes[name].push({part,name:record.spec.name,program:programs[draw.program],uniforms,samplers,state});references[name].push({part,matrixBits:draw.matrixBits});
 }
}
const mirror=capture.programs.find(program=>program.name==='fb_mirror');assert.ok(mirror);for(const [type,file]of [[35633,'mirror.vert.glsl'],[35632,'mirror.frag.glsl']])fs.writeFileSync(path.join(output,file),mirror.shaders.find(shader=>shader.type===type).source);
const materials=JSON.parse(fs.readFileSync('.work/native-render-source/materials.json')),opacity=name=>materials.find(material=>material.name===name)?.opacity_active??false;
// Source Surface::StaticRendering, Ramp/Rubber/Primitive/Light::Render. These
// flags classify the complete source table, including currently hidden parts.
const isStatic=record=>{const spec=record.spec;switch(spec.kind){
 case 'Wall':return !spec.is_droppable&&!(spec.is_side_visible&&opacity(spec.side_material))&&!(spec.is_top_bottom_visible&&opacity(spec.top_material));
 case 'Ramp':return !opacity(spec.material);
 case 'Rubber':case 'Primitive':return !!spec.static_rendering;
 case 'Light':return !record.renderState.blend||!!spec.has_static_bulb_mesh;
 case 'Spinner':return record.role==='bracket';
 case 'Bumper':return ['base','cap'].includes(record.role)&&!opacity(record.role==='base'?spec.base_material:spec.cap_material);
 default:return false;
}};
const staticParts=table.parts.flatMap((record,index)=>isStatic(record)?[index]:[]);for(const pass of Object.values(passes))for(const part of pass)assert.ok(staticParts.includes(part.part),'Captured static membership follows original source classification');
const dynamicPath=process.argv[4];let reflectionOnly;
if(dynamicPath){const dynamic=JSON.parse(fs.readFileSync(dynamicPath));assert.deepEqual(dynamic.errors,[]);assert.deepEqual(dynamic.observationErrors,[]);assert.equal(dynamic.engineSHA256,table.engineSHA256);const program=dynamic.programs.findIndex(program=>program.shaders.some(shader=>shader.type===35632&&shader.source.includes('//ps_main_reflection_only(')));assert.ok(program>=0);const commands=dynamic.draws.filter(draw=>draw.program===program);assert.equal(commands.length,1);const draw=commands[0],mesh=dynamic.meshes[draw.mesh],floor=table.parts.findIndex(part=>part.probe);assert.equal(sha(Buffer.from(mesh.vertexBytes,'base64')),table.parts[floor].sourceVertexSHA256);assert.equal(sha(Buffer.from(mesh.indexBytes,'base64')),table.parts[floor].sourceIndexSHA256);
 for(const [type,file]of [[35633,'reflection-only.vert.glsl'],[35632,'reflection-only.frag.glsl']])fs.writeFileSync(path.join(output,file),dynamic.programs[program].shaders.find(shader=>shader.type===type).source);
 const {scissorEnabled,scissor,...state}=draw.state;reflectionOnly={part:floor,vertex:'reflection-only.vert.glsl',fragment:'reflection-only.frag.glsl',state,sampler:draw.textures.tex_reflection.sampler};
}
const metadata={engineSHA256:capture.engineSHA256,sourceRevision:'195f214dd4849b8ef6113fd377258b78d0dec3bf',tableGeometrySHA256:table.geometry.sha256,mirror:{vertex:'mirror.vert.glsl',fragment:'mirror.frag.glsl'},passes,scope:'Native centered-sample static draw membership, material constants and immutable sampler states, associated by source GPU mesh bytes and authored world transforms. No observed matrices, poses, body state, history or current-frame pixels are runtime assets.'};
Object.assign(metadata,{staticParts,...(reflectionOnly?{reflectionOnly}:{})});fs.writeFileSync(path.join(output,'native-static.json'),JSON.stringify(metadata));fs.writeFileSync(directory+'/static-reference.json',JSON.stringify({references,averages:capture.averages.slice(-2),sourceUI:capture.sourceUI}));console.log(JSON.stringify({main:passes.main.length,reflection:passes.reflection.length,staticParts:staticParts.length,reflectionOnly:!!reflectionOnly,output}));
