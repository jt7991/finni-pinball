// Associate source upload bytes by exact native geometry and authored placement.
// Image buffers are assets, not rendered reference pixels or simulation state.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [capturePath,staging,imageAuditPath]=process.argv.slice(2),root='three/public/native-table/';
const capture=JSON.parse(fs.readFileSync(capturePath)),file=root+'native-table.json',table=JSON.parse(fs.readFileSync(file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(capture.engineSHA256,table.engineSHA256);assert.equal(capture.reference.sourceSha256,table.sourceTableSHA256);
assert.equal(capture.reference.controlledSha256,table.sourceTableSHA256);assert.deepEqual(capture.reference.controlledOverrides,{});
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);fs.mkdirSync(staging,{recursive:true});
const meshes=capture.meshes.map(mesh=>sha(Buffer.from(mesh.vertexBytes,'base64'))+':'+sha(Buffer.from(mesh.indexBytes,'base64'))),groups=new Map();
for(const draw of capture.draws){const key=meshes[draw.mesh];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(draw);}
const images=new Map(),updates=new Map(),pending=[],associations=[];
function image(id){
  if(images.has(id))return images.get(id);
  const texture=capture.textures[id];if(!texture?.pixelBytes)return null;
  assert.equal(texture.pixelFormat,6408);assert.equal(texture.pixelType,5121);
  const bytes=Buffer.from(texture.pixelBytes,'base64');assert.equal(bytes.length,texture.width*texture.height*4);
  const descriptor={width:texture.width,height:texture.height,format:texture.format,pixelFormat:texture.pixelFormat,pixelType:texture.pixelType,generatedMipmaps:!!texture.generatedMipmaps,encoding:'webp-lossless',levels:[{level:0,width:texture.width,height:texture.height,sourceBytes:bytes.length,sourceSHA256:sha(bytes)}]};
  const value={id,bytes,descriptor};images.set(id,value);return value;
}
function identity(descriptor){return[descriptor.width,descriptor.height,descriptor.format,descriptor.levels[0].sourceSHA256].join(':');}
const existing=new Map();for(const spec of Object.values(table.textures))for(const candidate of [spec,...Object.values(spec.variants??{})])existing.set(identity(candidate),candidate);
for(const [partIndex,part]of table.parts.entries()){
  let id=part.textures.tex_base_color?.id;if(id===undefined)continue;
  const geometry=part.sourceVertexSHA256+':'+part.sourceIndexSHA256;
  let draws=groups.get(geometry)??[];
  // Targets already bake their authored placement into the vertex buffer.
  // Only local-space primitives carry that placement in their model matrix.
  if(part.spec.position&&part.transform!=='identity'){const p=part.spec.position;draws=draws.filter(draw=>['x','y','z'].every((axis,i)=>Math.abs(draw.matrices[12+i]-p[axis])<.01));}
  const candidates=new Map();for(const draw of draws){const value=image(draw.textures.tex_base_color?.id);if(value)candidates.set(identity(value.descriptor),value);}
  if(candidates.size!==1)continue;
  const observed=[...candidates.values()][0],native=observed.descriptor;
  associations.push({partIndex,name:part.spec.name,role:part.role,id,nativeTexture:observed.id,geometry,width:native.width,height:native.height,format:native.format,sourceSHA256:native.levels[0].sourceSHA256});
  if(identity(table.textures[id].variants?.detailed??table.textures[id])===identity(native))continue;
  // Performance can share a native cache resource across differently named
  // authored images. Detailed may resolve those names to separate resources.
  // Split that material binding before adding its quality-specific upload.
  const sourceName=part.spec.image?.toLowerCase(),consumers=table.parts.filter(p=>p.textures.tex_base_color?.id===id);
  if(sourceName&&consumers.some(p=>p.spec.image?.toLowerCase()!==sourceName)){
    const previous=id;id=String(Object.keys(table.textures).length);
    const {variants,...base}=table.textures[previous];table.textures[id]=structuredClone(base);
    for(const consumer of consumers.filter(p=>p.spec.image?.toLowerCase()===sourceName))consumer.textures.tex_base_color.id=id;
    associations.at(-1).id=id;
  }
  if(updates.has(id)){assert.equal(identity(updates.get(id)),identity(native),'Shared material has consistent native Detailed bindings');continue;}
  let descriptor;
  if(existing.has(identity(native))){const {variants,...stored}=existing.get(identity(native));descriptor=structuredClone(stored);}
  else{
    const raw=`texture-${id}-detailed.rgba`,encoded=`texture-${id}-detailed.webp`;
    fs.writeFileSync(path.join(staging,raw),observed.bytes);descriptor=structuredClone(native);descriptor.levels[0].file=encoded;
    pending.push({id,raw,file:encoded,width:native.width,height:native.height,sourceSHA256:native.levels[0].sourceSHA256});
  }
  (table.textures[id].variants??={}).detailed=descriptor;updates.set(id,descriptor);
}
if(imageAuditPath){
  const sourceImages=Object.values(JSON.parse(fs.readFileSync(imageAuditPath)).new);
  const sourceName=descriptor=>{const matches=sourceImages.filter(image=>image.width===descriptor.width&&image.height===descriptor.height&&image.rgbaSHA256===descriptor.levels[0].sourceSHA256);return matches.length===1?matches[0].name.toLowerCase():undefined;};
  for(const spec of Object.values(table.textures))for(const variant of Object.values(spec.variants??{})){
    const original=sourceName(spec),observed=sourceName(variant);
    if(original&&observed&&original!==observed){spec.sourceImage=original;variant.sourceImage=observed;}
  }
}
fs.writeFileSync(file,JSON.stringify(table));fs.writeFileSync(path.join(staging,'textures.json'),JSON.stringify(pending));
fs.writeFileSync(path.join(staging,'bindings.json'),JSON.stringify({engineSHA256:capture.engineSHA256,sourceTableSHA256:table.sourceTableSHA256,captureSHA256:sha(fs.readFileSync(capturePath)),associations,updated:[...updates.keys()],newImages:pending.length}));
console.log(JSON.stringify({associations:associations.length,updated:[...updates.keys()],newImages:pending.length}));
