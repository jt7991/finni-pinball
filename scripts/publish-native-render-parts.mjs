// Publish selected verified render parts without observation poses, camera
// packets, reference pixels, or unrelated source textures.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
import {gzipSync} from 'node:zlib';
import {encodeNativeGeometry,decodeNativeGeometry} from '../three/native-geometry-codec.js';
const {values}=parseArgs({options:{source:{type:'string'},output:{type:'string'},names:{type:'string'},metadata:{type:'string',default:'native-primitives.json'},'output-metadata':{type:'string',default:'native-parts.json'}}});
for(const key of ['source','output','names'])assert.ok(values[key],'Required --'+key);
const source=path.resolve(values.source),output=path.resolve(values.output);assert.notEqual(source,output);
const original=JSON.parse(fs.readFileSync(path.join(source,values.metadata))),wanted=new Set(values.names.split(',')),selected=original.parts.filter(p=>wanted.has(p.spec.name)),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(selected.length,wanted.size,'Every selected source part exists exactly once');
const bytes=fs.readFileSync(path.join(source,original.geometry.file));assert.equal(sha(bytes),original.geometry.sha256);
const chunks=[],parts=[],programIDs=new Set(),textureIDs=new Set();let offset=0;
for(const part of selected){
  const vertex=bytes.subarray(part.vertexByteOffset,part.vertexByteOffset+part.vertices*32),indices=bytes.subarray(part.indexByteOffset,part.indexByteOffset+part.indices*4);
  assert.equal(vertex.length,part.vertices*32);assert.equal(indices.length,part.indices*4);
  const uniforms={...part.uniforms};for(const key of ['matProj[0]','w_h_height','balls[0]'])delete uniforms[key];
  parts.push({...part,uniforms,vertexByteOffset:offset,indexByteOffset:offset+vertex.length});chunks.push(vertex,indices);offset+=vertex.length+indices.length;
  programIDs.add(String(part.program));if(part.textures.tex_base_color)textureIDs.add(String(part.textures.tex_base_color.id));
}
fs.mkdirSync(output,{recursive:true});const geometry=Buffer.concat(chunks),encoded=encodeNativeGeometry(geometry,parts),geometryFile='part-meshes.delta.bin';
assert.ok(Buffer.from(decodeNativeGeometry(encoded,parts)).equals(geometry),'Exact native mesh round trip');
assert.ok(gzipSync(encoded).length<gzipSync(geometry).length,'Prediction must reduce the transferred bytes');
fs.writeFileSync(path.join(output,geometryFile),encoded);
const programs=Object.fromEntries([...programIDs].map(id=>[id,original.programs[id]])),textures=Object.fromEntries([...textureIDs].map(id=>[id,original.textures[id]]));
for(const program of Object.values(programs))for(const file of [program.vertex,program.fragment])fs.copyFileSync(path.join(source,file),path.join(output,file));
for(const texture of Object.values(textures))for(const level of texture.levels){const data=fs.readFileSync(path.join(source,level.file));assert.equal(sha(data),level.sha256);fs.copyFileSync(path.join(source,level.file),path.join(output,level.file));}
const metadata={engineSHA256:original.engineSHA256,sourceTableSHA256:original.sourceTableSHA256,geometry:{file:geometryFile,bytes:geometry.length,sha256:sha(geometry),encoding:'delta-byteplanes-v1',encodedSHA256:sha(encoded)},programs,textures,parts};
fs.writeFileSync(path.join(output,values['output-metadata']),JSON.stringify(metadata));
console.log(JSON.stringify({parts:parts.map(p=>p.spec.name),geometryBytes:geometry.length,gzipBefore:gzipSync(geometry).length,gzipAfter:gzipSync(encoded).length,textures:[...textureIDs],output}));
