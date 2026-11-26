// Repeat an unchanged original shader/input in a fresh WebGL context. Neither
// player, engine, observer nor scene is loaded. This diagnoses a retained strict
// mismatch; no result is substituted into production or a reference image.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {installNativePostprocessObserver} from './native-postprocess-observer.mjs';

const [debug,,output]=process.argv.slice(2);
const count=Number(process.argv.find(a=>a.startsWith('--fixed-frames='))?.slice(15)??1200);
const observerReadback=process.argv.includes('--observer-readback');
assert.ok(Number.isInteger(count)&&count>=128&&count<=2048);
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixtureFile='three/tests/fixtures/vpx-native-bloom-component-hard-round.json.gz';
const bytes=fs.readFileSync(fixtureFile);
assert.equal(sha(bytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
const fixture=JSON.parse(gunzipSync(bytes));
const draw=fixture.frame.draws.find(d=>d.name==='fb_blur_horiz39x39');
const program=fixture.programs.find(p=>p.name===draw.name),image=fixture.frame.images.bloomCut;
assert.equal(sha(Buffer.from(image.bytes,'base64')),image.sha256);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{
 const data=JSON.parse(event.data);
 if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}
 if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');
 await call('Page.navigate',{url:'about:blank'});
 for(let i=0;i<100;i++){if(await evaluate('location.href==="about:blank"&&document.readyState==="complete"'))break;await new Promise(resolve=>setTimeout(resolve,20));}
 const input={draw,program,width:image.width,height:image.height,bytes:image.bytes,count,observerReadback};
 const installation=(observerReadback?'('+installNativePostprocessObserver.toString()+')({deferImageEncoding:true,asyncReadback:true});':'')+`(async()=>{
  const input=${JSON.stringify(input)},canvas=document.createElement('canvas');canvas.width=230;canvas.height=424;document.body.append(canvas);
  const gl=canvas.getContext('webgl2',{antialias:false});if(!gl)throw Error('WebGL2 unavailable');
  if(!gl.getExtension('EXT_color_buffer_float')||!gl.getExtension('OES_texture_float_linear'))throw Error('Required float texture extensions unavailable');
  const pr=gl.createProgram();for(const spec of input.program.shaders){const shader=gl.createShader(spec.type);gl.shaderSource(shader,spec.source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(pr,shader);gl.deleteShader(shader);}gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
  const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(input.draw.bloomState.vertices),gl.STATIC_DRAW);
  for(const [name,spec]of Object.entries(input.draw.bloomState.attributes)){const index=gl.getAttribLocation(pr,name);if(index!==spec.index)throw Error('Original attribute location changed');gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,spec.size,spec.type,spec.normalized,spec.stride,spec.pointer);}
  const decode=s=>new Float32Array(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer),expected=decode(input.bytes),expectedWords=new Uint32Array(expected.buffer),unit=input.draw.bloomState.unit;
  gl.activeTexture(gl.TEXTURE0+unit);
  const createTexture=data=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_BASE_LEVEL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,0);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,input.width,input.height,0,gl.RGBA,gl.FLOAT,data);return t;};
  const source=createTexture(expected),target=createTexture(null),framebuffer=gl.createFramebuffer(),inputFramebuffer=gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,inputFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,source,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Input framebuffer incomplete');
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Output framebuffer incomplete');
  gl.bindTexture(gl.TEXTURE_2D,source);gl.uniform4fv(gl.getUniformLocation(pr,'w_h_height'),input.draw.uniforms.w_h_height);gl.uniform1i(gl.getUniformLocation(pr,'layer'),0);gl.uniform1i(gl.getUniformLocation(pr,'tex_fb_filtered'),unit);
  gl.viewport(...input.draw.viewport);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.DITHER);gl.colorMask(true,true,true,true);
  const extension=gl.getExtension('WEBGL_debug_renderer_info');
  const state=window.isolatedBloom={groups:[],rows:[],inputReads:0,outputReads:0,context:gl.getContextAttributes(),renderer:extension?{vendor:gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)}:{renderer:gl.getParameter(gl.RENDERER)},shaderSources:gl.getAttachedShaders(pr).map(s=>({type:gl.getShaderParameter(s,gl.SHADER_TYPE),source:gl.getShaderSource(s)}))};
  const samples=[new Float32Array(expected.length),new Float32Array(expected.length),new Float32Array(expected.length)],words=samples.map(p=>new Uint32Array(p.buffer));
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const remember=words=>{let index=state.groups.findIndex(group=>equal(group,words));if(index<0){index=state.groups.length;state.groups.push(words.slice());}return index;};
  const queued=[],io=input.observerReadback?nativePostprocess.io:null,started=performance.now();
  for(let i=0;i<input.count;i++){
   await new Promise(requestAnimationFrame);
   if(io){
    gl.drawArrays(...input.draw.args);const first=io.readColor(gl,io.textureId(target)),repeat=io.readColor(gl,io.textureId(target));
    gl.drawArrays(...input.draw.args);queued.push({sample:i+1,first,repeat,second:io.readColor(gl,io.textureId(target)),input:io.readColor(gl,io.textureId(source))});
    if(gl.getError()!==gl.NO_ERROR)throw Error('Unexpected observed WebGL error at sample '+(i+1));continue;
   }
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,inputFramebuffer);gl.readPixels(0,0,input.width,input.height,gl.RGBA,gl.FLOAT,samples[0]);state.inputReads++;if(!equal(words[0],expectedWords))throw Error('Fixed GPU input changed at sample '+(i+1));
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.drawArrays(...input.draw.args);gl.readPixels(0,0,input.width,input.height,gl.RGBA,gl.FLOAT,samples[0]);gl.readPixels(0,0,input.width,input.height,gl.RGBA,gl.FLOAT,samples[1]);state.outputReads+=2;
   if(!equal(words[0],words[1]))throw Error('Readback changed without a draw at sample '+(i+1));const first=remember(words[0]);
   gl.drawArrays(...input.draw.args);gl.readPixels(0,0,input.width,input.height,gl.RGBA,gl.FLOAT,samples[2]);state.outputReads++;
   state.rows.push({sample:i+1,first,second:remember(words[2])});
   if(gl.getError()!==gl.NO_ERROR)throw Error('Unexpected WebGL error at sample '+(i+1));
  }
  state.elapsedMilliseconds=performance.now()-started;
  if(io){
   await io.finishReadbacks();
   const wordImage=image=>{const values=decode(image.bytes);return new Uint32Array(values.buffer);};
   for(let i=0;i<queued.length;i++){
    const row=queued[i],first=wordImage(row.first),repeat=wordImage(row.repeat),second=wordImage(row.second),actualInput=wordImage(row.input);
    if(!equal(actualInput,expectedWords))throw Error('Queued fixed GPU input changed at sample '+row.sample);
    if(!equal(first,repeat))throw Error('Queued readback changed without a draw at sample '+row.sample);
    state.rows.push({sample:row.sample,first:remember(first),second:remember(second)});state.inputReads++;state.outputReads+=3;queued[i]=null;
   }
   state.imageEncoding={...nativePostprocess.imageEncoding};
   if(nativePostprocess.priorErrors.length||nativePostprocess.errors.length)throw Error('Observer errors '+JSON.stringify({prior:nativePostprocess.priorErrors,errors:nativePostprocess.errors}));
  }
  state.encode=index=>{const bytes=new Uint8Array(state.groups[index].buffer);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
  return{rows:state.rows,inputReads:state.inputReads,outputReads:state.outputReads,groups:state.groups.length,elapsedMilliseconds:state.elapsedMilliseconds,context:state.context,renderer:state.renderer,shaderSources:state.shaderSources,imageEncoding:state.imageEncoding,loadedResources:performance.getEntriesByType('resource').map(e=>e.name),hasPlayer:!!(window.finni||window.finniThree)};
 })()`;
 const state=await evaluate(installation);assert.equal(state.rows.length,count);assert.equal(state.inputReads,count);assert.equal(state.outputReads,count*3);assert.equal(state.hasPlayer,false);assert.deepEqual(state.loadedResources,[]);assert.deepEqual(errors,[]);
 if(observerReadback){assert.equal(state.imageEncoding.queued,count*4);assert.equal(state.imageEncoding.completed,count*4);assert.equal(state.imageEncoding.encodes,count*4);}
 assert.deepEqual(state.shaderSources,program.shaders,'Original linked shader source and ordering');
 const groups=[];for(let i=0;i<state.groups;i++){const data=Buffer.from(await evaluate('isolatedBloom.encode('+i+')'),'base64');assert.equal(data.length,image.width*image.height*16);groups.push({index:i,sha256:sha(data),bytes:data.toString('base64'),first:state.rows.filter(r=>r.first===i).length,second:state.rows.filter(r=>r.second===i).length});}
 state.shaderSourceHashes=state.shaderSources.map(s=>({type:s.type,sha256:sha(s.source)}));delete state.shaderSources;
 const report={scope:'Fresh about:blank page and owned WebGL2 context without VPX, Three.js, scene draws or resource loads. Original recorded shader sources, quad, uniforms, sampler and cutoff texture are explicit component inputs. Each animation frame performs two draws, reads the first output twice before drawing the second, and verifies every fixed input word. Default mode uses direct synchronous readPixels. Optional observer mode uses the unchanged native observation helper with deferred/fenced readbacks, completed after the draw window. Every output is compared word-for-word with a losslessly retained group representative before deduplication. This diagnoses context/history and observation effects; no result replaces a strict historical expectation or production pixels.',observerReadback,fixtureSHA256:sha(bytes),source:fixture.source,instrumentation:{file:'scripts/probe-isolated-bloom-repeat.mjs',sourceSHA256:sha(installation),sourceBase64:Buffer.from(installation).toString('base64')},inputSHA256:image.sha256,nativeExpectedSHA256:fixture.frame.images.bloomHorizontal.sha256,state,groups,errors};
 fs.writeFileSync(path.join(output,'isolated-bloom-repeat.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({samples:count,renderer:state.renderer,groups:groups.map(({bytes,...r})=>r),pairedDifferences:state.rows.filter(r=>r.first!==r.second).length,elapsedMilliseconds:state.elapsedMilliseconds,errors}));
}finally{socket.close();}
