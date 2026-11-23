import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),capture=JSON.parse(bytes);
const metadata=JSON.parse(fs.readFileSync('three/public/native-ball/native-ball.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(fs.existsSync(output),false,'Preserve existing native recordings');
assert.equal(capture.reference.sourceSha256,metadata.sourceTableSHA256);
assert.equal(capture.engineSHA256,metadata.engineSHA256);
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);
const lightStates={},balls=[];
for(const line of capture.poseLog.split('\n')){
  let match=line.match(/BALL_LIGHT\|([^|]+)\|([^|]+)\|([^']+)/);
  if(match)lightStates[match[1].toLowerCase()]={color:Number(match[2]),inplayintensity:Number(match[3])};
  match=line.match(/BALL_MATERIAL\|([^']*)/);
  if(match){const [index,id,x,y,z,radius,color,frontdecal]=match[1].split('|');balls.push({index:Number(index),id:Number(id),position:{x:Number(x),y:Number(y),z:Number(z)},radius:Number(radius),color:Number(color),frontdecal,locked:true,forceReflection:true});}
}
assert.equal(balls.length,4);assert.equal(Object.keys(lightStates).length,metadata.lights.length);
for(const ball of balls){const declared=capture.ballMaterialCases.cases[ball.index];assert.deepEqual(ball.position,{x:declared.x,y:declared.y,z:declared.z});assert.equal(ball.frontdecal,declared.decal);assert.equal(ball.color,declared.color);}
const draws=capture.draws.filter(draw=>draw.matrixKind==='ball');assert.equal(draws.length,8);
assert.equal(draws.filter(draw=>draw.matrices[10]<0).length,4);
const references=draws.map(draw=>{
  const position=draw.uniforms.orientation.slice(12,15),ball=balls.find(ball=>ball.position.x===position[0]&&ball.position.y===position[1]);
  assert.ok(ball,'Unique observed stationary ball');assert.equal(position[2],ball.position.z-ball.radius);
  const mesh=capture.meshes[draw.mesh],part=metadata.parts[0];
  assert.equal(sha(Buffer.from(mesh.vertexBytes,'base64')),part.sourceVertexSHA256);
  assert.equal(sha(Buffer.from(mesh.indexBytes,'base64')),part.sourceIndexSHA256);
  const sourceTextures={};
  for(const name of ['tex_ball_color','tex_ball_decal','tex_diffuse_env']){
    const binding=name==='tex_ball_decal'&&!ball.frontdecal?metadata.decalTextures.empty:part.textures[name];
    const texture=capture.textures[draw.textures[name].id];
    assert.equal(sha(Buffer.from(texture.pixelBytes,'base64')),metadata.textures[binding.id].levels[0].sourceSHA256,name+' source pixels');
    assert.deepEqual(draw.textures[name].sampler,binding.sampler,name+' source sampler');
    sourceTextures[name]={sha256:sha(Buffer.from(texture.pixelBytes,'base64')),width:texture.width,height:texture.height,format:texture.format,sampler:draw.textures[name].sampler};
  }
  assert.equal(draw.matrixBits.length,64,'Retain native UBO bits, including signed zero');
  return {ball,uniforms:draw.uniforms,matrixBits:draw.matrixBits,state:draw.state,decalEmpty:!ball.frontdecal,sourceTextures};
});
const fixture={engineSHA256:capture.engineSHA256,sourceSha256:capture.reference.sourceSha256,captureSHA256:sha(bytes),viewport:capture.viewport,lightStates,references,scope:capture.ballMaterialCases.scope+' Captured orientations are explicit shared GPU component inputs only; they are never gameplay assets. Native globals, source textures, camera and computed light packets retain their original exact comparisons.'};
fs.writeFileSync(output,gzipSync(JSON.stringify(fixture),{level:9,mtime:0}));
console.log(JSON.stringify({output,cases:references.length,lights:Object.keys(lightStates).length,captureSHA256:fixture.captureSHA256}));
