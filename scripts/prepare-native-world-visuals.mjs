// Export source-owned wall/ramp/rubber draws with bit-exact vertex deduplication.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{
  capture:{type:'string',default:'.work/three-review/native-materials-map-walls-0-80.json'},
  owners:{type:'string',default:'.work/three-review/native-draw-owners.json'},
  source:{type:'string',default:'.work/native-render-source/gameitems'},
  output:{type:'string',default:'.work/native-world-renderer'},
}});
const capture=JSON.parse(fs.readFileSync(values.capture)),owners=JSON.parse(fs.readFileSync(values.owners)),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(capture.engineSHA256,owners.engineSHA256);assert.equal(capture.reference.controlledSha256,owners.sourceTableSHA256);assert.deepEqual(capture.errors,[]);
const wanted=owners.parts.filter(p=>['Wall','Ramp','Rubber'].includes(p.kind)),lookup=new Map();
for(const owner of wanted)for(const geometry of owner.geometry){const key=geometry.vertexSHA256+':'+geometry.indexSHA256;assert.ok(!lookup.has(key));lookup.set(key,owner);}
const source=new Map(fs.readdirSync(values.source).filter(file=>file.endsWith('.json')).map(file=>{
  const [kind,spec]=Object.entries(JSON.parse(fs.readFileSync(path.join(values.source,file))))[0];return[kind+':'+spec.name,{...spec,kind}];
})),parts=[],references=[],chunks=[],usedTextures=new Set(),usedPrograms=new Set(),found=new Set();let offset=0,reconstructed=0;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
for(const [drawOrder,draw]of capture.draws.entries()){
  const mesh=capture.meshes[draw.mesh],vertexBytes=Buffer.from(mesh.vertexBytes,'base64'),indexBytes=Buffer.from(mesh.indexBytes,'base64'),key=sha(vertexBytes)+':'+sha(indexBytes),owner=lookup.get(key);if(!owner)continue;
  assert.ok(!found.has(key),'One native draw per owned geometry');found.add(key);
  assert.deepEqual(draw.matrices.slice(0,16),identity,'World-space native geometry');
  const spec=source.get(owner.kind+':'+owner.name);assert.ok(spec);assert.ok(!spec.is_droppable,'Droppable walls need a dynamic mesh path');
  const rawIndices=new Uint32Array(indexBytes.buffer,indexBytes.byteOffset,indexBytes.length/4),rawVertices=new Float32Array(vertexBytes.buffer,vertexBytes.byteOffset,vertexBytes.length/4),vertexMap=new Map(),vertices=[],indices=new Uint32Array(rawIndices.length),normalKinds=new Set();
  for(let i=0;i<rawIndices.length;i++){
    const original=rawIndices[i],bytes=vertexBytes.subarray(original*32,original*32+32);assert.equal(bytes.length,32);const signature=bytes.toString('hex');let index=vertexMap.get(signature);
    if(index===undefined){index=vertices.length;vertexMap.set(signature,index);vertices.push(bytes);}indices[i]=index;
    assert.ok(vertices[index].equals(bytes),'Every referenced native vertex byte survives');reconstructed++;
    if(owner.kind==='Wall')normalKinds.add(rawVertices[original*8+5]===0?'side':rawVertices[original*8+3]===0&&rawVertices[original*8+4]===0&&rawVertices[original*8+5]===1?'top':'unknown');
  }
  let role='body';if(owner.kind==='Wall'){assert.equal(normalKinds.size,1,'Separate native wall top/side draws');role=[...normalKinds][0];assert.notEqual(role,'unknown','Known native wall normal');}
  const packedVertices=Buffer.concat(vertices),packedIndices=Buffer.from(indices.buffer),name=owner.name+':'+role;
  parts.push({spec,name,transform:'identity',role,visibilityField:role==='side'?'sidevisible':'visible',defaultVisible:role==='side'?spec.is_side_visible:role==='top'?spec.is_top_bottom_visible:spec.is_visible,
    vertices:vertices.length,indices:indices.length,vertexByteOffset:offset,indexByteOffset:offset+packedVertices.length,sourceVertexSHA256:sha(vertexBytes),sourceIndexSHA256:sha(indexBytes),
    program:draw.program,uniforms:draw.uniforms,textures:draw.textures,renderState:draw.state,drawOrder});
  references.push({name,matrixBits:draw.matrixBits,drawIndex:drawOrder,pose:null});chunks.push(packedVertices,packedIndices);offset+=packedVertices.length+packedIndices.length;usedPrograms.add(draw.program);if(draw.textures.tex_base_color)usedTextures.add(draw.textures.tex_base_color.id);
}
assert.equal(found.size,lookup.size,'All mapped world geometry exists in the export capture');
fs.mkdirSync(values.output,{recursive:true});const write=(file,bytes)=>{fs.writeFileSync(path.join(values.output,file),bytes);return{file,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)};},programs={},textures={};
for(const id of usedPrograms){const program=capture.programs[id],vertex=program.shaders.find(s=>s.type===35633).source,fragment=program.shaders.find(s=>s.type===35632).source;const v=write('basic-'+id+'.vert.glsl',vertex),f=write('basic-'+id+'.frag.glsl',fragment);programs[id]={vertex:v.file,fragment:f.file,vertexSHA256:v.sha256,fragmentSHA256:f.sha256};}
for(const id of usedTextures){const t=capture.textures[id],levels=[{level:0,...t},...Object.entries(t.mips??{}).map(([level,s])=>({level:Number(level),...s}))].sort((a,b)=>a.level-b.level);textures[id]={width:t.width,height:t.height,format:t.format,pixelFormat:t.pixelFormat,pixelType:t.pixelType,generatedMipmaps:t.generatedMipmaps??false,levels:[]};
  for(const level of levels){assert.ok(level.pixelBytes);const record=write('texture-'+id+'-'+level.level+'.bin',Buffer.from(level.pixelBytes,'base64'));textures[id].levels.push({level:level.level,width:level.width,height:level.height,...record});}
  assert.ok(textures[id].generatedMipmaps||levels.length===(t.levels??1),'Native mip generation observed');
}
const geometry=write('world-meshes.bin',Buffer.concat(chunks)),metadata={engineSHA256:capture.engineSHA256,sourceTableSHA256:capture.reference.controlledSha256,geometry,programs,textures,parts};
write('native-world.json',JSON.stringify(metadata));write('reference.json',JSON.stringify({engineSHA256:capture.engineSHA256,viewport:capture.viewport,references,scope:'Source-owned, world-space native wall/ramp/rubber draws. Animated mechanisms and hidden rubber variants are separate work.'}));
console.log(JSON.stringify({parts:parts.length,authoredObjects:wanted.length,geometryBytes:geometry.bytes,referencedVerticesVerified:reconstructed,programs:[...usedPrograms],textures:[...usedTextures],output:values.output}));
