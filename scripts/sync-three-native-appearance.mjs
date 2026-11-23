// Integrate audited authored property/mesh changes and real native texture uploads.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {decodeNativeGeometry,encodeNativeGeometry} from '../three/native-geometry-codec.js';
const [updatePath,capturePath,staging]=process.argv.slice(2),root='three/public',update=JSON.parse(fs.readFileSync(updatePath)),capture=JSON.parse(fs.readFileSync(capturePath)),file=root+'/native-table/native-table.json',table=JSON.parse(fs.readFileSync(file));
const sha=b=>createHash('sha256').update(b).digest('hex');assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);assert.equal(capture.reference.sourceSha256,update.sourceSha256);assert.equal(capture.engineSHA256,table.engineSHA256);fs.mkdirSync(staging,{recursive:true});
const original=Buffer.from(decodeNativeGeometry(fs.readFileSync(root+'/native-table/'+table.geometry.file),table.parts));assert.equal(sha(original),table.geometry.sha256);
const key=(v,i)=>v+':'+i,draws=new Map(),textureIds=new Map(),pendingTextures=[];
for(const draw of capture.draws){const mesh=capture.meshes[draw.mesh],k=key(sha(Buffer.from(mesh.vertexBytes,'base64')),sha(Buffer.from(mesh.indexBytes,'base64')));if(!draws.has(k))draws.set(k,[]);draws.get(k).push(draw);}
for(const [id,t]of Object.entries(table.textures))textureIds.set(t.width+':'+t.height+':'+t.levels[0].sourceSHA256,id);
function texture(id){
  const source=capture.textures[id];assert.equal(source.pixelFormat,6408);assert.equal(source.pixelType,5121);assert.ok(source.pixelBytes);const bytes=Buffer.from(source.pixelBytes,'base64'),hash=sha(bytes),k=source.width+':'+source.height+':'+hash;
  if(textureIds.has(k))return textureIds.get(k);
  const target=String(Object.keys(table.textures).length),raw='texture-'+target+'.rgba',encoded='texture-'+target+'.webp';fs.writeFileSync(path.join(staging,raw),bytes);
  table.textures[target]={width:source.width,height:source.height,format:source.format,pixelFormat:source.pixelFormat,pixelType:source.pixelType,generatedMipmaps:source.generatedMipmaps??false,encoding:'webp-lossless',levels:[{level:0,width:source.width,height:source.height,file:encoded,sourceBytes:bytes.length,sourceSHA256:hash}]};textureIds.set(k,target);pendingTextures.push({id:target,raw,file:encoded,width:source.width,height:source.height,sourceSHA256:hash});return target;
}
function deduplicate(mesh){
  const raw=Buffer.from(mesh.vertices,'base64'),indices=Buffer.from(mesh.indices,'base64'),lookup=new Map(),chunks=[],remap=[];
  for(let i=0;i<raw.length;i+=32){const vertex=raw.subarray(i,i+32),k=vertex.toString('base64');let index=lookup.get(k);if(index===undefined){index=lookup.size;lookup.set(k,index);chunks.push(vertex);}remap.push(index);}
  const mapped=Buffer.alloc(indices.length);for(let i=0;i<indices.length;i+=4)mapped.writeUInt32LE(remap[indices.readUInt32LE(i)],i);return {vertex:Buffer.concat(chunks),index:mapped};
}
const chunks=[];let offset=0,matched=0;const meshChanges=[];
for(const part of table.parts){
  const name=part.spec.name,change=update.meshes[name];let vertex=original.subarray(part.vertexByteOffset,part.vertexByteOffset+part.vertices*32),index=original.subarray(part.indexByteOffset,part.indexByteOffset+part.indices*4);
  if(change){const old=deduplicate(change.old),next=deduplicate(change.new);assert.ok([sha(old.vertex),sha(next.vertex)].includes(part.vertexSHA256),name+' recognized vertex identity');assert.ok([sha(old.index),sha(next.index)].includes(part.indexSHA256),name+' recognized index identity');vertex=next.vertex;index=next.index;part.sourceVertexSHA256=change.new.vertexSHA256;part.sourceIndexSHA256=change.new.indexSHA256;part.sourceVertices=Buffer.from(change.new.vertices,'base64').length/32;meshChanges.push({name,vertices:vertex.length/32,indices:index.length/4});}
  part.spec={...part.spec,...update.changes[name]};
  if(part.spec.kind==='Light'&&!draws.has(key(part.sourceVertexSHA256,part.sourceIndexSHA256))){
    // Native procedural bulb meshes bake the authored radius into world-space
    // vertices. Associate identical topology by its authored center, then use
    // the actual current GPU bytes; never scale or approximate an old mesh.
    const center=part.spec.center,matches=[];
    for(const mesh of capture.meshes){const indices=Buffer.from(mesh.indexBytes,'base64');if(sha(indices)!==part.sourceIndexSHA256)continue;const raw=Buffer.from(mesh.vertexBytes,'base64');let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let i=0;i<raw.length;i+=32){const x=raw.readFloatLE(i),y=raw.readFloatLE(i+4);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(Math.hypot((minX+maxX)/2-center.x,(minY+maxY)/2-center.y)<.001)matches.push({vertices:mesh.vertexBytes,indices:mesh.indexBytes,vertexSHA256:sha(raw),indexSHA256:sha(indices)});}
    assert.equal(matches.length,1,'Unique current native bulb mesh at authored center '+name);const current=matches[0],next=deduplicate(current);vertex=next.vertex;index=next.index;part.sourceVertexSHA256=current.vertexSHA256;part.sourceIndexSHA256=current.indexSHA256;part.sourceVertices=Buffer.from(current.vertices,'base64').length/32;meshChanges.push({name,role:part.role,vertices:vertex.length/32,indices:index.length/4});
  }
  const candidates=draws.get(key(part.sourceVertexSHA256,part.sourceIndexSHA256))??[],position=part.spec.position;
  const filtered=position?candidates.filter(d=>['x','y','z'].every((axis,i)=>Math.abs(d.matrices[12+i]-position[axis])<.01)):candidates;
  const draw=filtered.length===1?filtered[0]:candidates.length===1?candidates[0]:undefined;
  if(draw){matched++;for(const k of Object.keys(part.uniforms))if(k in draw.uniforms&&!['matProj[0]','w_h_height','balls[0]'].includes(k))part.uniforms[k]=draw.uniforms[k];if(part.textures.tex_base_color&&draw.textures.tex_base_color)part.textures.tex_base_color={...part.textures.tex_base_color,id:texture(draw.textures.tex_base_color.id)};}
  if(change)assert.ok(draw,'Changed mesh has an independent current native draw: '+name);
  part.vertices=vertex.length/32;part.indices=index.length/4;part.vertexByteOffset=offset;part.indexByteOffset=offset+vertex.length;part.vertexSHA256=sha(vertex);part.indexSHA256=sha(index);chunks.push(vertex,index);offset+=vertex.length+index.length;
}
const geometry=Buffer.concat(chunks),encoded=encodeNativeGeometry(geometry,table.parts);assert.ok(Buffer.from(decodeNativeGeometry(encoded,table.parts)).equals(geometry));fs.writeFileSync(root+'/native-table/'+table.geometry.file,encoded);Object.assign(table.geometry,{bytes:geometry.length,sha256:sha(geometry),encodedSHA256:sha(encoded)});table.sourceTableSHA256=update.sourceSha256;
// All other render packs use the same audited authored appearance properties.
function patchSpecs(value){if(!value||typeof value!=='object')return;if(value.spec?.name&&update.changes[value.spec.name])Object.assign(value.spec,update.changes[value.spec.name]);for(const child of Object.values(value))if(child&&typeof child==='object')patchSpecs(child);}
for(const entry of fs.readdirSync(root,{withFileTypes:true})){if(!entry.isDirectory()||!entry.name.startsWith('native-')||entry.name==='native-table')continue;for(const name of fs.readdirSync(root+'/'+entry.name)){if(!name.endsWith('.json'))continue;const target=root+'/'+entry.name+'/'+name,metadata=JSON.parse(fs.readFileSync(target));patchSpecs(metadata);fs.writeFileSync(target,JSON.stringify(metadata));}}
const lightingPath=root+'/native-lighting.json',lighting=JSON.parse(fs.readFileSync(lightingPath)),globals=capture.draws.find(d=>d.uniforms.fenvEmissionScale_TexWidth)?.uniforms;assert.ok(globals);lighting.globals.envScaleWidth=globals.fenvEmissionScale_TexWidth;lighting.globals.ambientRange=globals.cAmbient_LightRange;lighting.globals.positions=globals['basicLightPos[0]']??lighting.globals.positions;lighting.globals.emissions=globals['basicLightEmission[0]']??lighting.globals.emissions;lighting.provenance={...lighting.provenance,mergedSourceTableSHA256:update.sourceSha256};fs.writeFileSync(lightingPath,JSON.stringify(lighting));
fs.writeFileSync(file,JSON.stringify(table));fs.writeFileSync(path.join(staging,'textures.json'),JSON.stringify(pendingTextures));fs.writeFileSync(path.join(staging,'appearance-report.json'),JSON.stringify({sourceTableSHA256:update.sourceSha256,matchedDraws:matched,parts:table.parts.length,meshChanges,newTextures:pendingTextures.length,geometryBytes:geometry.length}));console.log(JSON.stringify({matchedDraws:matched,meshChanges,newTextures:pendingTextures.length}));
