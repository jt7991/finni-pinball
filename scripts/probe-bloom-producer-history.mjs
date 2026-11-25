// Replay the complete retained image window with a persistent GPU cutoff
// producer. HDR pixels are declared component inputs; expected images stay
// immutable. This does not recreate the preceding whole-table renderer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {installNativePostprocessObserver} from './native-postprocess-observer.mjs';

const [debug,,output]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const observeReadbacks=process.argv.includes('--observe-native-readbacks');
const fixtureBytes=fs.readFileSync('three/tests/fixtures/vpx-native-bloom-component-hard-round.json.gz');
assert.equal(sha(fixtureBytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
const fixture=JSON.parse(gunzipSync(fixtureBytes));
const directory='.work/three-review/native-harder-round-render-r1/native-frame-history-main-6f8116d-harder-round-r1';
const source=fs.readFileSync(path.join(directory,'capture.json'));
assert.equal(sha(source),fixture.source.captureSHA256);
const capture=JSON.parse(source),frames=capture.frames.filter(row=>row.images.bloomHorizontal);
assert.equal(frames.length,128);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')errors.push(message.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};

try{
  await call('Runtime.enable');
  if(observeReadbacks)await evaluate('('+installNativePostprocessObserver.toString()+')({deferImageEncoding:true,asyncReadback:true})');
  const setup=await evaluate(`(()=>{
    const specs=${JSON.stringify(fixture.programs.filter(p=>['fb_bloom','fb_blur_horiz39x39'].includes(p.name)))},canvas=document.createElement('canvas');canvas.width=57;canvas.height=106;
    const gl=canvas.getContext('webgl2',{antialias:false});if(!gl)throw Error('WebGL2 unavailable');gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
    const programs=new Map();for(const spec of specs){const program=gl.createProgram();for(const code of spec.shaders){const shader=gl.createShader(code.type);gl.shaderSource(shader,code.source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));programs.set(spec.name,program);}
    const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,80,gl.DYNAMIC_DRAW);
    const texture=(width,height)=>{const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_BASE_LEVEL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,0);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);return texture;};
    const hdr=texture(230,424),cut=texture(57,106),horizontal=texture(57,106),fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,57,106);for(const key of [gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST])gl.disable(key);gl.enable(gl.DITHER);gl.colorMask(true,true,true,true);
    const samplers=new Map(),decode=s=>new Float32Array(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer),encode=values=>{const bytes=new Uint8Array(values.buffer);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
    const nativeIO=${observeReadbacks}?nativePostprocess.io:null,savedFrames=[];
    function draw(spec,input,target){const program=programs.get(spec.name),unit=spec.bloomState.unit;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,input);let sampler=samplers.get(spec.name);if(!sampler){sampler=gl.createSampler();samplers.set(spec.name,sampler);for(const [key,value]of Object.entries(spec.bloomState.parameters)){const parameter=Number(key);if(parameter===34046){const extension=gl.getExtension('EXT_texture_filter_anisotropic');if(extension)gl.samplerParameterf(sampler,parameter,value);}else if([gl.TEXTURE_MIN_LOD,gl.TEXTURE_MAX_LOD].includes(parameter))gl.samplerParameterf(sampler,parameter,value);else gl.samplerParameteri(sampler,parameter,value);}}gl.bindSampler(unit,sampler);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete component framebuffer');gl.useProgram(program);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(spec.bloomState.vertices));for(const [name,attribute]of Object.entries(spec.bloomState.attributes)){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,attribute.size,attribute.type,attribute.normalized,attribute.stride,attribute.pointer);}for(const [name,value]of Object.entries(spec.bloomState.uniforms)){const at=gl.getUniformLocation(program,name);if(Array.isArray(value))gl.uniform4fv(at,value);else gl.uniform1i(at,value);}
      let before;if(nativeIO){const vertices=new Float32Array(20);gl.getBufferSubData(gl.ARRAY_BUFFER,0,vertices);if(vertices.some((v,i)=>!Object.is(v,spec.bloomState.vertices[i])))throw Error('Observed cutoff/blur vertices changed');before=nativeIO.readColor(gl,nativeIO.textureId(input));}gl.drawArrays(...spec.args);return nativeIO?{input:before,output:nativeIO.readColor(gl,nativeIO.textureId(target))}:null;}
    function read(texture){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);const values=new Float32Array(57*106*4);gl.readPixels(0,0,57,106,gl.RGBA,gl.FLOAT,values);return encode(values);}
    const history={frames:0,hdrUpdates:0,cutoffDraws:0,horizontalDraws:0,cutoffCPUUploads:0};
    window.producerHistory={run(input){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hdr);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,230,424,gl.RGBA,gl.FLOAT,decode(input.hdr));history.hdrUpdates++;const generated=draw(input.cutoff,hdr,cut);history.cutoffDraws++;const blurred=draw(input.horizontal,cut,horizontal);history.horizontalDraws++;let result;if(nativeIO){savedFrames.push({hdr:generated.input,cut:generated.output,horizontalInput:blurred.input,horizontal:blurred.output});result={pending:true,glError:gl.getError()};}else result={horizontal:read(horizontal),cut:read(cut),glError:gl.getError()};history.frames++;return result;},get(index){return Object.fromEntries(Object.entries(savedFrames[index]).map(([name,image])=>[name,image.bytes]));},async finish(){if(nativeIO)await nativeIO.finishReadbacks();return{history,samplers:samplers.size,programs:programs.size,glError:gl.getError(),renderer:gl.getParameter(gl.RENDERER),context:gl.getContextAttributes(),...nativeIO?{readbacks:{...nativePostprocess.imageEncoding},observerErrors:nativePostprocess.errors,priorErrors:nativePostprocess.priorErrors}:{}};}};
    return{glError:gl.getError(),programs:programs.size};
  })()`);
  assert.equal(setup.glError,0);assert.equal(setup.programs,2);
  const results=[],inputImage=(frame,name)=>{const spec=frame.images[name],bytes=fs.readFileSync(path.join(directory,spec.file));assert.equal(sha(bytes),spec.sha256);assert.equal(bytes.length,spec.width*spec.height*16);return bytes;};
  function compare(frame,result){
    const expectedCut=inputImage(frame,'bloomCut'),expectedHorizontal=inputImage(frame,'bloomHorizontal');
    const actualCut=Buffer.from(result.cut,'base64'),actualHorizontal=Buffer.from(result.horizontal,'base64');
    assert.equal(sha(actualCut),sha(expectedCut),'GPU cutoff input at frame '+frame.frameIndex);
    if(observeReadbacks){assert.equal(sha(Buffer.from(result.hdr,'base64')),frame.images.hdr.sha256,'Queued HDR input');assert.equal(sha(Buffer.from(result.horizontalInput,'base64')),sha(actualCut),'Queued blur input');}
    const actual=new Float32Array(actualHorizontal.buffer,actualHorizontal.byteOffset,actualHorizontal.byteLength/4),expected=new Float32Array(expectedHorizontal.buffer,expectedHorizontal.byteOffset,expectedHorizontal.byteLength/4);
    let different=0,maxAbsolute=0;const columns={};for(let i=0;i<actual.length;i++)if(!Object.is(actual[i],expected[i])){different++;maxAbsolute=Math.max(maxAbsolute,Math.abs(actual[i]-expected[i]));const x=Math.floor(i/4)%57;columns[x]=(columns[x]??0)+1;}
    results.push({frame:frame.frameIndex,cutSHA256:sha(actualCut),outputSHA256:sha(actualHorizontal),expectedSHA256:sha(expectedHorizontal),different,maxAbsolute,columns});
  }
  for(const frame of frames){
    const hdr=inputImage(frame,'hdr'),cutoff=frame.draws.find(d=>d.name==='fb_bloom'),horizontal=frame.draws.find(d=>d.name==='fb_blur_horiz39x39');
    assert.deepEqual(cutoff.viewport,[0,0,57,106]);assert.deepEqual(horizontal.viewport,cutoff.viewport);
    const result=await evaluate('producerHistory.run('+JSON.stringify({hdr:hdr.toString('base64'),cutoff,horizontal})+')');assert.equal(result.glError,0);
    if(!observeReadbacks)compare(frame,result);else assert.equal(result.pending,true);
  }
  const beforeTransfer=await evaluate('producerHistory.finish()');
  if(observeReadbacks){assert.deepEqual(beforeTransfer.readbacks,{reads:512,deferred:512,encodes:0,queued:512,completed:512});for(const [index,frame]of frames.entries())compare(frame,await evaluate('producerHistory.get('+index+')'));}
  const state=await evaluate('producerHistory.finish()');assert.equal(state.glError,0);assert.deepEqual(errors,[]);assert.deepEqual(state.history,{frames:128,hdrUpdates:128,cutoffDraws:128,horizontalDraws:128,cutoffCPUUploads:0});if(observeReadbacks){assert.deepEqual(state.observerErrors,[]);assert.deepEqual(state.priorErrors,[]);assert.equal(state.readbacks.encodes,512);}
  const report={scope:'Persistent raw-WebGL replay of all 128 retained image frames in original order. Original HDR pixels are explicit inputs; the unchanged native cutoff shader generates every half-float cutoff texture on the GPU before the unchanged horizontal shader. Default output readbacks occur after both draws. Optional original-observer mode queues native before/after draw snapshots and transfers them only after the complete window; no synchronous image reads occur inside that window. No cutoff pixels are uploaded, no reference image or uniform is changed, and no body/RNG state initializes production. This finite component window does not reconstruct preceding whole-table GPU history or establish the cause of any remaining native mismatch.',fixtureSHA256:sha(fixtureBytes),source:fixture.source,observeReadbacks,setup,beforeTransfer,state,results,errors};
  fs.writeFileSync(path.join(output,'bloom-producer-history.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({frames:results.length,cutoffMatches:results.length,horizontalMatches:results.filter(r=>!r.different).length,failures:results.filter(r=>r.different),state,errors}));
}finally{socket.close();}
