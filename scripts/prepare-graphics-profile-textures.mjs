// Associate immutable native image uploads by the same authored mesh in two
// independent profile captures. No image resemblance or output fitting.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const root='three/public/native-table/',sha=b=>createHash('sha256').update(b).digest('hex'),read=file=>JSON.parse(fs.readFileSync(file));
const table=read(root+'native-table.json'),performance=read('.work/three-review/current-main-performance-full-materials.json'),detailed=read('.work/three-review/current-main-detailed-full-materials.json'),staging='.work/graphics-profile-textures';
for(const capture of [performance,detailed]){assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);assert.equal(capture.engineSHA256,table.engineSHA256);assert.equal(capture.reference.sourceSha256,table.sourceTableSHA256);}
const key=(capture,draw)=>{const mesh=capture.meshes[draw.mesh];return sha(Buffer.from(mesh.vertexBytes,'base64'))+':'+sha(Buffer.from(mesh.indexBytes,'base64'));};
const groups=new Map();for(const draw of performance.draws){const k=key(performance,draw);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(draw);}
const performanceHashes=performance.textures.map(t=>t.pixelBytes?sha(Buffer.from(t.pixelBytes,'base64')):null),variants=[];
fs.mkdirSync(staging,{recursive:true});
for(const id of ['25','26','27','28']){
 const spec=table.textures[id],smallIds=new Set(performanceHashes.flatMap((hash,index)=>hash===spec.levels[0].sourceSHA256?[index]:[]));assert.equal(smallIds.size,1,'Unique current native performance image '+id);
 const bigIds=new Set(),associations=[];
 for(const draw of detailed.draws)for(const other of groups.get(key(detailed,draw))??[]){
  if(!smallIds.has(other.textures.tex_base_color?.id)||!draw.textures.tex_base_color)continue;
  const bigId=draw.textures.tex_base_color.id;bigIds.add(bigId);associations.push({detailedMesh:draw.mesh,performanceMesh:other.mesh,meshSHA256:key(detailed,draw)});
 }
 assert.equal(bigIds.size,1,'Unique detailed upload on identical authored meshes '+id);assert.ok(associations.length);
 const nativeId=[...bigIds][0],texture=detailed.textures[nativeId],pixels=Buffer.from(texture.pixelBytes,'base64');assert.equal(texture.width,2048);assert.equal(texture.height,4550);assert.equal(pixels.length,texture.width*texture.height*4);
 const file='texture-'+id+'-detailed.webp',raw='texture-'+id+'-detailed.rgba',descriptor={width:texture.width,height:texture.height,format:texture.format,pixelFormat:texture.pixelFormat,pixelType:texture.pixelType,generatedMipmaps:!!texture.generatedMipmaps,encoding:'webp-lossless',levels:[{level:0,width:texture.width,height:texture.height,file,sourceBytes:pixels.length,sourceSHA256:sha(pixels)}]};
 assert.equal(descriptor.format,spec.format);assert.equal(descriptor.pixelFormat,6408);assert.equal(descriptor.pixelType,5121);fs.writeFileSync(staging+'/'+raw,pixels);
 table.textures[id].variants={detailed:descriptor};
 variants.push({id,raw,file,width:texture.width,height:texture.height,sourceSHA256:sha(pixels),performance:{width:spec.width,height:spec.height,sha256:spec.levels[0].sourceSHA256,nativeId:[...smallIds][0]},detailed:{width:texture.width,height:texture.height,sha256:sha(pixels),nativeId},associations});
}
// Native wall bottoms and tops use the same authored image property. The
// previous merge refreshed visible tops only; bind hidden bottoms to that same
// current image too, while retaining old files for the original reference.
for(const part of table.parts)for(const [oldId,currentId]of [['1','25'],['2','26'],['9','27']])if(String(part.textures.tex_base_color?.id)===oldId){
 const peers=table.parts.filter(p=>String(p.textures.tex_base_color?.id)===currentId);assert.ok(peers.some(p=>p.spec.name===part.spec.name&&p.spec.image===part.spec.image));part.textures.tex_base_color.id=currentId;
}
fs.writeFileSync(root+'native-table.json',JSON.stringify(table));fs.writeFileSync(staging+'/textures.json',JSON.stringify(variants));
const classicPath='three/public/native-classic/native-classic.json',classic=read(classicPath);
for(const part of classic.parts){assert.equal(part.spec.image,'pf');assert.ok(['9','27'].includes(String(part.image.id)));part.image.id='27';}
fs.writeFileSync(classicPath,JSON.stringify(classic));
fs.writeFileSync('three/tests/fixtures/vpx-main-profile-textures-native.json.gz',gzipSync(Buffer.from(JSON.stringify({engineSHA256:table.engineSHA256,sourceSha256:table.sourceTableSHA256,variants,scope:'Actual native immutable image upload bytes and exact geometry-hash associations between Performance and Detailed native sessions. No resized approximation or frame output.'})),{level:9}));
console.log(JSON.stringify(variants.map(({id,performance,detailed,associations})=>({id,performance,detailed,matchingMeshes:associations.length}))));
