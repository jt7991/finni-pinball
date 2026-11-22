import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// The oracle is the fragment compiled by the original WASM engine, captured
// before any ported code ran. Only the unused matrix UBO declaration is changed.
const fixture=JSON.parse(gunzipSync(fs.readFileSync('three/tests/fixtures/vpx-classic-shader-native.json.gz')));
assert.equal(createHash('sha256').update(fixture.fragment).digest('hex'),fixture.sourceSHA256);
const nativeFragment=fixture.fragment.replace(/^#version[^\n]*\n/,'').replace(/^#extension[^\n]*\n/gm,'').replace(/layout\(std140\) uniform basicMatrixBlock\s*\{([\s\S]*?)\};/,(_,members)=>members.replace(/\b(mat4|mat3x4|vec4)\b/g,'uniform $1'));
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown'||d.method==='Log.entryAdded'&&d.params.entry.level==='error'&&!d.params.entry.url?.endsWith('/favicon.ico'))errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Log.enable');await call('Page.navigate',{url:base});for(let i=0;i<400;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(r=>setTimeout(r,50));}
 const result=await evaluate(`(async()=>{
  const {game,view}=finniThree;game.setPaused(true);await game.flush();
  const sceneModule=await(await fetch('/three/scene.js')).text(),threeURL=sceneModule.match(/import \\* as THREE from "([^"]+)"/)[1];
  const THREE=await import(threeURL),{createClassicLights,loadNativeLighting,colorVector}=await import('/three/classic-render.js');
  const renderer=view.renderer,compileErrors=[];renderer.debug.onShaderError=(gl,p,v,f)=>compileErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});const scene=new THREE.Scene(),reference=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,10);camera.position.z=3;
  const lighting=await loadNativeLighting('/three/'),floor=view.classicLights.meshes[0].material.uniforms.tex_light_color.value;
  const state={visible:true,color:0x302010,colorfull:0xff4080,inplayintensity:4},spec={kind:'Light',name:'Sample',image:'different',center:{x:476,y:1057.5},falloff_radius:120,falloff_power:3,surface_height:0,drag_points:[{x:376,y:957.5},{x:576,y:957.5},{x:576,y:1157.5},{x:376,y:1157.5}]};
  const lights=createClassicLights({specs:{objects:[spec]},rules:{objects:new Map([['sample',state]])}},scene,floor,lighting),mesh=lights.meshes[0];scene.position.set(-4.76,-10.575,0);reference.position.copy(scene.position);
  const uniforms={...mesh.material.uniforms,lightColor_intensity:{value:colorVector(state.color)},lightColor2_falloff_power:{value:colorVector(state.colorfull)},lightCenter_maxRange:{value:new THREE.Vector4()}};
  const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms,vertexShader:'precision highp float;in vec3 position;in vec3 nativePosition;in vec2 uv;uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;uniform mat4 matView[1];out vec2 tex0;out vec3 tablePos;out vec3 worldPos;out vec3 normal;out float eye;void main(){tex0=uv;tablePos=nativePosition;worldPos=(matView[0]*vec4(nativePosition,1.)).xyz;normal=(matView[0]*vec4(0.,0.,1.,0.)).xyz;eye=0.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:${JSON.stringify(nativeFragment)},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor});reference.add(new THREE.Mesh(mesh.geometry.clone(),material));
  const target=new THREE.WebGLRenderTarget(17,17,{type:THREE.HalfFloatType}),buffer=new Uint16Array(17*17*4),expected=new Uint16Array(buffer.length),clear=new Uint16Array(buffer.length),saved=renderer.getClearColor(new THREE.Color()),savedAlpha=renderer.getClearAlpha();
  renderer.setClearColor(new THREE.Color().setRGB(.13,.27,.08),1);renderer.setRenderTarget(target);renderer.render(new THREE.Scene(),camera);renderer.readRenderTargetPixels(target,0,0,17,17,clear);
  let cases=0,samples=0,different=0,maxULP=0,changedFromClear=0;const examples=[],drawErrors=[],masks=[];
  try{for(const intensity of [0,.125,3.2,60,150])for(const power of [1,3])for(const mode of ['playfield','apron','image','glossy']){
   state.inplayintensity=intensity;spec.falloff_power=power;lights.update(camera);lights.view.fromArray(${JSON.stringify(fixture.view)});
   const u=mesh.material.uniforms;u.lightingOff.value=mode==='image';u.cBase_Alpha.value.copy(colorVector(mode==='apron'?0xffffff:0x606060,1));u.Roughness_WrapL_Edge_Thickness.value.x=mode==='apron'?32:16;u.cGlossy_ImageLerp.value.copy(colorVector(mode==='glossy'?0x203040:0,1));u.cClearcoat_EdgeAlpha.value.copy(colorVector(mode==='glossy'?0x402020:0,0));
   uniforms.lightColor_intensity.value.copy(colorVector(state.color,intensity));uniforms.lightColor2_falloff_power.value.copy(colorVector(state.colorfull,power));uniforms.lightCenter_maxRange.value.fromArray(lights.texture.image.data,8);
   renderer.setClearColor(new THREE.Color().setRGB(.13,.27,.08),1);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,17,17,buffer);const portError=renderer.getContext().getError();renderer.render(reference,camera);renderer.readRenderTargetPixels(target,0,0,17,17,expected);const referenceError=renderer.getContext().getError();if(portError||referenceError)drawErrors.push({intensity,mode,portError,referenceError});cases++;
   for(let p=0;p<buffer.length;p++)if(p%4!==3){samples++;if(expected[p]!==clear[p])changedFromClear++;const error=Math.abs(buffer[p]-expected[p]);maxULP=Math.max(maxULP,error);if(error){different++;if(examples.length<8)examples.push({intensity,power,mode,p,actual:buffer[p],expected:expected[p]});}}
  }
  for(const mask of ['hidden','off','black']){state.visible=mask!=='hidden';state.inplayintensity=mask==='off'?0:30;state.color=state.colorfull=mask==='black'?0:0xabcdef;lights.lamps[0].skipOff=true;lights.update(camera);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,17,17,buffer);masks.push({mask,different:Array.from(buffer).filter((v,i)=>i%4!==3&&v!==clear[i]).length});}
  }finally{renderer.setRenderTarget(null);renderer.setClearColor(saved,savedAlpha);}
  const elevatedSpec={...spec,name:'Elevated',surface:'apron',surface_height:.6},elevated=createClassicLights({specs:{objects:[elevatedSpec]},rules:{objects:new Map([['elevated',state]])}},new THREE.Scene(),floor,lighting);elevated.update(camera);
  const surface={height:elevated.meshes[0].geometry.attributes.nativePosition.getZ(0),center:elevated.texture.image.data[10],base:elevated.meshes[0].material.uniforms.cBase_Alpha.value.toArray(),skipOff:elevated.lamps[0].skipOff};
  const authored={skipOff:view.classicLights.lamps.every(l=>l.skipOff),height:[...new Set(Array.from(view.classicLights.meshes[0].geometry.attributes.nativePosition.array).filter((v,i)=>i%3===2))]};
  const gl=renderer.getContext(),programs=renderer.info.programs.map(p=>{gl.validateProgram(p.program);return{log:gl.getProgramInfoLog(p.program),valid:gl.getProgramParameter(p.program,gl.VALIDATE_STATUS)};});
  const result={cases,samples,different,maxULP,changedFromClear,examples,masks,surface,authored,drawErrors,programs,compileErrors,authoredClassicLights:view.classicLights.lamps.length,authoredMeshes:view.classicLights.meshes.length,shaderErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).map(p=>p.diagnostics),glError:gl.getError()};
  target.dispose();material.dispose();mesh.material.dispose();mesh.geometry.dispose();lights.texture.dispose();for(const texture of Object.values(lighting.textures))texture.dispose();for(const mesh of elevated.meshes){mesh.geometry.dispose();mesh.material.dispose();}elevated.texture.dispose();return result;
 })()`);
 result.referenceSHA256=fixture.sourceSHA256;result.engineSHA256=fixture.engineSHA256;result.scope='Same-GPU HDR RGB using original compiled native fragment and controlled valid lamp inputs; not whole-table or native-camera pixel equivalence.';
 fs.writeFileSync(output+'/classic-gpu-conformance.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));assert.deepEqual(result.shaderErrors,[]);assert.deepEqual(result.compileErrors,[]);assert.deepEqual(result.drawErrors,[]);assert.ok(result.programs.every(p=>p.valid));assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.cases,40);assert.equal(result.samples,34680);assert.ok(result.changedFromClear>30000);assert.equal(result.different,0);assert.equal(result.authoredClassicLights,25);assert.equal(result.authoredMeshes,1);assert.ok(result.masks.every(m=>m.different===0));assert.deepEqual(result.surface,{height:Math.fround(60.1),center:60,base:[1,1,1,1],skipOff:false});assert.deepEqual(result.authored,{skipOff:true,height:[Math.fround(.1)]});
}finally{socket.close();}
