import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {readReferenceFixture,readReferenceAssets,readOriginalRenderAsset} from '../../scripts/reference-physics.mjs';import {computeNativeCamera} from '../native-camera.js';import {nativeReflectionCamera} from '../native-reflection.js';import {nativeBallMatrices,nativeBallLightState,nativeBallOrientation} from '../native-ball-render-state.js';
import {createFullGame} from '../full-game.js';
const read=readOriginalRenderAsset,fixture=readReferenceFixture(new URL('fixtures/vpx-ball-render-native.json.gz',import.meta.url));
test('ball cameras and nearest-light uniforms match all eight original native main/reflection draws',async()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.references.length,8);
 const metadata=read('native-ball/native-ball.json'),lighting=read('native-lighting.json'),camera=computeNativeCamera(read('camera-bounds.json'),fixture.viewport.width/fixture.viewport.height);let matrixFields=0,lightFields=0;
 // Table1_Init executes ChangeGi white. Resolve those colors through the real
 // authored rules, rather than mistaking post-init colors for editor defaults.
 const game=await createFullGame(...(({layout,objects,source})=>[layout,objects,source])(readReferenceAssets({sourceSha256:'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a'})),()=>{},null,{storage:{load:()=>'',save:()=>{}}});
 try{
 for(const ref of fixture.references){
  const native=new Float32Array(new Uint32Array(ref.matrixBits).buffer),view=native[10]<0?nativeReflectionCamera(camera,[0,0,1,0]):camera,matrices=nativeBallMatrices(view);assert.deepEqual(Array.from(new Uint32Array(matrices.buffer)),ref.matrixBits);matrixFields+=64;
  const position=ref.uniforms.orientation.slice(12,15),light=nativeBallLightState(metadata,lighting,{x:position[0],y:position[1],z:position[2]},name=>({color:game.rules.objects.get(name.toLowerCase()).color}));for(const [key,name]of [['positions','ballLightPos[0]'],['emissions','ballLightEmission[0]'],['roughness','Roughness_WrapL_Edge_Thickness']]){assert.deepEqual(Array.from(light[key]),ref.uniforms[name]);lightFields+=light[key].length;}
 }
 assert.equal(matrixFields,512);assert.equal(lightFields,672);
 }finally{game.dispose();}
});
test('source ball mesh remains byte identical to the native VBO and every original triangle',()=>{
 const metadata=read('native-ball/native-ball.json'),bytes=fs.readFileSync(new URL('../public/native-ball/'+metadata.geometry.file,import.meta.url)),part=metadata.parts[0],sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(part.vertices,181);assert.equal(part.indices,960);assert.equal(sha(bytes.subarray(0,part.indexByteOffset)),'07b42e808e0e8891ab695dc63c5ff128e4fac23ac140207ea6cbdbd75589b2c2');assert.equal(sha(bytes),metadata.geometry.sha256);
});
test('source ball orientation preserves native transpose, scale and position',()=>{
 const matrix=nativeBallOrientation({x:40,y:80,z:25},[0,-1,0,1,0,0,0,0,1]);assert.deepEqual(Array.from(matrix),[0,25,0,0,-25,0,0,0,0,0,25,0,40,80,25,1]);
});
