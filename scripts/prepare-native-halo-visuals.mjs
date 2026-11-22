// Original authored lightmap geometry, independently owned by source position
// and native Visible toggles for coincident lights. No captured live state in
// runtime metadata; ordinary uniform packets stay in the comparison fixture.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';import {createFullGame} from '../three/full-game.js';import {readReferenceFixture} from './reference-physics.mjs';
const read=file=>JSON.parse(fs.readFileSync(file)),capture=read('.work/three-review/native-alpha-owner-frame.json'),owners=read('.work/three-review/native-map-Light-124-126-revealed.json'),order=readReferenceFixture('three/tests/fixtures/vpx-alpha-order-native.json.gz'),objects=read('three/public/objects.json'),output=process.argv[2]??'three/public/native-halos',sha=b=>createHash('sha256').update(b).digest('hex'),parts=[],references=[],chunks=[],f=Math.fround;let offset=0;
assert.equal(capture.engineSHA256,order.engineSHA256);assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);assert.equal(owners.capture,'native-alpha-owner-frame.json');fs.mkdirSync(output,{recursive:true});
const game=await createFullGame(read('three/public/layout.json'),objects,fs.readFileSync('three/public/rules.vbs','utf8'),()=>{},null,{storage:{load:()=>'',save:()=>{}}});
try{
 for(const row of order.rows.filter(r=>r.role==='halo')){
  const draw=capture.draws[row.index],mesh=capture.meshes[draw.mesh],source=objects.objects.find(s=>s.name===row.name),original=read('.work/native-render-source/gameitems/Light.'+source.name+'.json').Light,spec={...source,surface_height:f(game.surface(source)*100),shadows:original.shadows},vertices=Buffer.from(mesh.vertexBytes,'base64'),rawIndex=Buffer.from(mesh.indexBytes,'base64'),indices=rawIndex;
  assert.equal(draw.matrixKind,'light');assert.ok(['none','raytraced_ball_shadows'].includes(original.shadows));assert.equal(original.fader,'linear');assert.equal(draw.program,original.shadows==='none'?0:6);assert.equal(mesh.vertices*32,vertices.length);assert.equal(indices.length,draw.count*4);
  const center=draw.uniforms.lightCenter_maxRange;assert.deepEqual(center.slice(0,3),[f(spec.center.x),f(spec.center.y),f(spec.surface_height+f(spec.height))]);
  const values=new Float32Array(vertices.buffer,vertices.byteOffset,vertices.length/4);for(let i=0;i<values.length;i+=8){assert.equal(values[i+2],f(f(spec.surface_height+f(spec.bulb_halo_height))+f(.1)));assert.deepEqual(Array.from(values.slice(i+3,i+6)),[0,0,1]);}
  parts.push({spec,program:original.shadows==='none'?'bulb':'shadow',vertices:mesh.vertices,indices:draw.count,vertexByteOffset:offset,indexByteOffset:offset+vertices.length,sourceVertexSHA256:sha(vertices),sourceIndexSHA256:sha(rawIndex)});chunks.push(vertices,indices);offset+=vertices.length+indices.length;
  // Current attract-mode colors are explicit shared component inputs. Decode
  // exact COLORREF channels from the original Float32 uniform conversion;
  // never substitute these captured colors for authored/runtime rules state.
  const decodeColor=values=>values.slice(0,3).reduce((color,value,index)=>{const mask=[255,65280,16711680][index],channel=Array.from({length:256},(_,n)=>n).find(n=>f((n*2**(8*index))*f(1/mask))===value);assert.notEqual(channel,undefined,'Native COLORREF channel is exact');return color+channel*2**(8*index);},0);
  references.push({name:spec.name,input:{visible:true,inplayintensity:draw.uniforms.lightColor_intensity[3],color:decodeColor(draw.uniforms.lightColor_intensity),colorfull:decodeColor(draw.uniforms.lightColor2_falloff_power)},matrixBits:draw.matrixBits,uniforms:draw.uniforms,state:draw.state,sourceVertexSHA256:sha(vertices),sourceIndexSHA256:sha(rawIndex)});
 }
 assert.equal(parts.length,133);assert.equal(new Set(parts.map(p=>p.spec.name)).size,133);
 const write=(file,bytes)=>{fs.writeFileSync(path.join(output,file),bytes);return{file,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)};},geometry=write('halo-meshes.bin',Buffer.concat(chunks)),program={},shadow={};
 for(const [name,type]of [['vertex',35633],['fragment',35632]]){const source=capture.programs[0].shaders.find(s=>s.type===type).source,existing=fs.readFileSync('three/public/native-transmission/bulb.'+(name==='vertex'?'vert':'frag')+'.glsl','utf8');assert.equal(source,existing,'Same original LightShader already used by transmission');program[name]={file:'../native-transmission/bulb.'+(name==='vertex'?'vert':'frag')+'.glsl',sha256:sha(source)};}
 for(const [name,type]of [['vertex',35633],['fragment',35632]])shadow[name]=write('bulb-shadow.'+(name==='vertex'?'vert':'frag')+'.glsl',capture.programs[6].shaders.find(s=>s.type===type).source);
 write('native-halos.json',JSON.stringify({engineSHA256:capture.engineSHA256,sourceRevision:order.sourceRevision??'195f214dd4849b8ef6113fd377258b78d0dec3bf',sourceTableSHA256:order.sourceTableSHA256,geometry,programs:{bulb:program,shadow},parts}));
 fs.writeFileSync('three/tests/fixtures/vpx-halo-render-native.json.gz',gzipSync(Buffer.from(JSON.stringify({engineSHA256:capture.engineSHA256,viewport:capture.viewport,references,scope:'Original133source lightmap GPU buffers and independently observed uniforms. Fully-on capture is a component input; captured live colors/intensities/camera never enter runtime assets.'}))));
 console.log(JSON.stringify({parts:parts.length,bytes:offset,program:'Existing original transmission LightShader',output}));
}finally{game.dispose();}
