// SPDX-License-Identifier: GPL-3.0-or-later
// Original compiled native ball shaders and lossless source geometry/textures.
import * as THREE from 'three';
import {nativeBallSubmission} from './ball-presentation.js';
import {NativeMatrixStream,createNativeBaseTexture} from './native-basic-render.js';
import {nativeShaderArray,nativeShaderFloat} from './native-shader-state.js';
import {nativeBallMatrices,nativeBallOrientation,nativeBallRotationScale,nativeBallLightState} from './native-ball-render-state.js';
export const nativeBallVisible=(ball,reflection)=>!!ball&&ball.visible!==false&&(!reflection||ball.reflectionEnabled!==false&&(ball.forceReflection||!ball.locked&&ball.position.z<=ball.radius+3&&ball.position.z>=ball.radius-.1));
export function createNativeBallVisuals(renderer,scene,assets,lighting,{previousFrame,stateFor=()=>null,submissionClock,submissionBodyFor=ball=>ball}={}){
 if(!previousFrame)throw Error('Native balls require a previous-frame reflection texture');
 const record=assets.metadata.parts[0],vertices=new THREE.InterleavedBuffer(new Float32Array(assets.geometry,record.vertexByteOffset,record.vertices*8),8),geometry=new THREE.BufferGeometry(),position=new THREE.InterleavedBufferAttribute(vertices,3,0);geometry.setAttribute('position',position);geometry.setAttribute('vPosition',position);geometry.setAttribute('vNormal',new THREE.InterleavedBufferAttribute(vertices,3,3));geometry.setAttribute('tex0',new THREE.InterleavedBufferAttribute(vertices,2,6));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(assets.geometry,record.indexByteOffset,record.indices),1));
 const stream=new NativeMatrixStream(renderer,{block:'ballMatrixBlock',floats:64}),parts=[],textures={};for(const [name,binding]of Object.entries(record.textures))textures[name]=createNativeBaseTexture(assets,binding.id,binding.sampler);
 const table=assets.metadata.table,program=assets.programs.ball;let material,frameSubmissions;
 const decalTextures=new Map(),decalFor=name=>{
  const bindings=assets.metadata.decalTextures;
  if(name===undefined||!bindings||String(name).toLowerCase()===bindings.defaultName.toLowerCase())return textures.tex_ball_decal;
  const binding=bindings.empty,key=JSON.stringify(binding);
  if(!decalTextures.has(key))decalTextures.set(key,createNativeBaseTexture(assets,binding.id,binding.sampler));
  return decalTextures.get(key);
 };
 const bindUniforms=part=>{for(const [name,u]of Object.entries(part.uniforms)){
  const target=material.uniforms[name];
  if(ArrayBuffer.isView(u.value)&&target.value!==u.value)target.value.set(u.value);
  else if(u.value?.isTexture)target.value=u.value;
 }};

 function submit(ball,reflection=false){const body=submissionBodyFor(ball),rotScale=nativeBallRotationScale(ball.orientation,ball.radius),input=submissionClock({ballId:ball.id,scriptId:ball.scriptId,reflection,body,rotScale});return{input,body,result:nativeBallSubmission(rotScale,body,input)};}
 function add(){
  const uniforms={};for(const [name,value]of Object.entries(assets.metadata.globals))uniforms[name]={value:Float32Array.from(value)};
  for(const [name,texture]of Object.entries(textures))uniforms[name]={value:texture};Object.assign(uniforms,{tex_ball_playfield:{value:previousFrame},orientation:{value:new Float32Array(16)},matProj:{value:new Float32Array(16)},layer:{value:0},ballLightPos:{value:new Float32Array(40)},ballLightEmission:{value:new Float32Array(40)},cBase_Alpha:{value:new Float32Array([1,1,1,1])},Roughness_WrapL_Edge_Thickness:{value:new Float32Array(4)},invTableRes_reflection:{value:nativeShaderArray([1/table.width,1/table.height,Math.max(0,Math.min(1,table.ball_playfield_reflection_strength)),0])},w_h_disableLighting:{value:new Float32Array(4)}});
  if(!material){const state=record.renderState,shared=Object.fromEntries(Object.entries(uniforms).map(([name,u])=>[name,{value:ArrayBuffer.isView(u.value)?u.value.slice():u.value}]));material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:program.vertex,fragmentShader:program.fragment,uniforms:shared,depthWrite:true,depthFunc:THREE.LessEqualDepth,side:state.cullFace===1028?THREE.BackSide:THREE.FrontSide,blending:THREE.NoBlending});material.onBeforeRender=(_renderer,_scene,_camera,_geometry,object)=>{const part=object.userData.nativeBallPart;if(submissionClock){const submission=part.preparedSubmission??submit(part.ball,!!_camera.userData.nativeCamera?.reflection);part.submissionInput=submission.input;part.submissionBody=submission.body;part.submission=submission.result;part.uniforms.orientation.value.set(part.submission.orientation);}bindUniforms(part);material.uniformsNeedUpdate=true;stream.upload(material,part.matrices);};}
  const mesh=new THREE.Mesh(geometry,material),part={mesh,material,uniforms,matrices:new Float32Array(64),baseSide:record.renderState.cullFace===1028?THREE.BackSide:THREE.FrontSide};mesh.userData.nativeBallPart=part;mesh.name='NativeBall';mesh.frustumCulled=false;mesh.renderOrder=1000000;parts.push(part);scene.add(mesh);return part;
 }
 add();
 return{parts,geometry,stream,add,
 beginSubmission(balls,{reflections=true}={}){
  if(!submissionClock)return;frameSubmissions=new Map(balls.map(ball=>[ball,[]]));
  // RenderFrame::Execute runs every begin-of-frame callback before any GPU
  // pass. Preserve separate reflected/main commands and their clock reads.
  for(const reflection of (reflections?[true,false]:[false]))for(const ball of balls)if(nativeBallVisible(ball,reflection))frameSubmissions.get(ball)[Number(reflection)]=submit(ball,reflection);
 },
 endSubmission(){frameSubmissions=undefined;},
 update(camera,balls,{width,height}={}){
  const native=camera.userData.nativeCamera;if(!native)throw Error('Native balls require the authored camera');const size=renderer.getDrawingBufferSize(new THREE.Vector2());width??=size.x;height??=size.y;while(parts.length<balls.length)add();const matrices=nativeBallMatrices(native),projection=nativeShaderArray(native.projection);
  for(let i=0;i<parts.length;i++){
   const part=parts[i],ball=balls[i];part.mesh.visible=nativeBallVisible(ball,native.reflection);if(!ball)continue;part.ball=ball;part.preparedSubmission=frameSubmissions?.get(ball)?.[Number(!!native.reflection)];part.rotScale=nativeBallRotationScale(ball.orientation,ball.radius);
   part.uniforms.tex_ball_decal.value=decalFor(ball.frontdecal);
   const {uniforms}=part,lights=nativeBallLightState(assets.metadata,lighting.metadata,ball.position,stateFor,ball.bulbScale),position=ball.locked?{...ball.position,z:Math.fround(ball.position.z-ball.radius)}:ball.position;part.matrices.set(matrices);uniforms.matProj.value.set(projection);uniforms.orientation.value.set(nativeBallOrientation(position,ball.orientation,ball.radius));uniforms.w_h_disableLighting.value.set(nativeShaderArray([1.5/width,1.5/height,Number(!!assets.metadata.renderSettings?.disableLighting),0]));uniforms.ballLightPos.value.set(lights.positions);uniforms.ballLightEmission.value.set(lights.emissions);uniforms.Roughness_WrapL_Edge_Thickness.value.set(lights.roughness);uniforms.cBase_Alpha.value.set(ball.color??[1,1,1,1]);uniforms.invTableRes_reflection.value[2]=nativeShaderFloat(Math.max(0,Math.min(1,Math.fround(Math.fround(table.ball_playfield_reflection_strength)*Math.fround(ball.reflectionStrength??1)))));part.material.side=native.reflection&&!native.reverseCullingByRenderer?(part.baseSide===THREE.BackSide?THREE.FrontSide:THREE.BackSide):part.baseSide;
  }
  if(balls[0])bindUniforms(parts[0]);
 },dispose(){for(const p of parts)scene.remove(p.mesh);material.dispose();geometry.dispose();for(const texture of new Set([...Object.values(textures),...decalTextures.values()]))texture.dispose();stream.dispose();}};
}
