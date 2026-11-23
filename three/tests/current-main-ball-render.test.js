import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {computeNativeCamera} from '../native-camera.js';
import {nativeReflectionCamera} from '../native-reflection.js';
import {nativeBallMatrices,nativeBallLightState} from '../native-ball-render-state.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const fixture=readReferenceFixture(new URL('fixtures/vpx-main-99eff88-ball-render-native.json.gz',import.meta.url));
const metadata=read('native-ball/native-ball.json'),lighting=read('native-lighting.json');

test('current native ball packets retain exact camera, lighting, global settings and decal uploads',()=>{
  assert.equal(fixture.sourceSha256,read('source-table.json').sourceTableSHA256);
  assert.equal(fixture.engineSHA256,metadata.engineSHA256);assert.equal(fixture.references.length,8);
  const camera=computeNativeCamera(read('camera-bounds.json'),fixture.viewport.width/fixture.viewport.height);
  let matrixFields=0,lightFields=0,empty=0;
  for(const ref of fixture.references){
    const native=new Float32Array(new Uint32Array(ref.matrixBits).buffer);
    const view=native[10]<0?nativeReflectionCamera(camera,[0,0,1,0]):camera;
    assert.deepEqual([...new Uint32Array(nativeBallMatrices(view).buffer)],ref.matrixBits);
    matrixFields+=64;
    const lights=nativeBallLightState(metadata,lighting,ref.ball.position,name=>fixture.lightStates[name.toLowerCase()]);
    for(const [key,name]of [['positions','ballLightPos[0]'],['emissions','ballLightEmission[0]'],['roughness','Roughness_WrapL_Edge_Thickness']]){
      assert.deepEqual([...lights[key]],ref.uniforms[name]);lightFields+=lights[key].length;
    }
    for(const [name,value]of Object.entries(metadata.globals))assert.deepEqual(value,ref.uniforms[name]);
    assert.equal(Number(metadata.renderSettings.disableLighting),ref.uniforms.w_h_disableLighting[2]);
    if(ref.decalEmpty)empty++;
    for(const [name,source]of Object.entries(ref.sourceTextures)){
      const binding=name==='tex_ball_decal'&&ref.decalEmpty?metadata.decalTextures.empty:metadata.parts[0].textures[name];
      const texture=metadata.textures[binding.id];
      assert.equal(texture.levels[0].sourceSHA256,source.sha256);
      assert.equal(texture.format,source.format);assert.equal(texture.width,source.width);assert.equal(texture.height,source.height);
      assert.deepEqual(binding.sampler,source.sampler);
    }
  }
  assert.equal(matrixFields,512);assert.equal(lightFields,672);assert.equal(empty,4);
  const texture=metadata.textures[metadata.decalTextures.empty.id],bytes=fs.readFileSync(new URL('../public/native-ball/'+texture.levels[0].file,import.meta.url));
  assert.deepEqual([...bytes],[0,0,0,0]);assert.equal(createHash('sha256').update(bytes).digest('hex'),texture.levels[0].sourceSHA256);
});
