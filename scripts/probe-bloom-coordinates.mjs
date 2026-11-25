// Explicit raw-WebGL component inputs. Alternate coordinates/texture formats
// are diagnostics only; none replaces a production shader or native reference.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const [debug,,output]=process.argv.slice(2),file='three/tests/fixtures/vpx-native-bloom-component-hard-round.json.gz',bytes=fs.readFileSync(file),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(bytes),'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
const fixture=JSON.parse(gunzipSync(bytes)),frame=fixture.frame,program=fixture.programs.find(p=>p.name==='fb_blur_horiz39x39'),draw=frame.draws.find(d=>d.name===program.name);
for(const name of ['bloomCut','bloomHorizontal'])assert.equal(sha(Buffer.from(frame.images[name].bytes,'base64')),frame.images[name].sha256);
const windowMode=process.argv.includes('--component-window');
let inputs=[{frame:frame.frameIndex,uniforms:draw.uniforms.w_h_height,cut:frame.images.bloomCut.bytes,expected:frame.images.bloomHorizontal.bytes}];
if(windowMode){
  const directory='.work/three-review/native-harder-round-render-r1/native-frame-history-main-6f8116d-harder-round-r1',source=fs.readFileSync(path.join(directory,'capture.json'));assert.equal(sha(source),fixture.source.captureSHA256);
  const capture=JSON.parse(source);inputs=capture.frames.filter(row=>row.images.bloomHorizontal).map(row=>{
    const image=name=>{const spec=row.images[name],bytes=fs.readFileSync(path.join(directory,spec.file));assert.equal(sha(bytes),spec.sha256);assert.equal(spec.width,57);assert.equal(spec.height,106);return bytes.toString('base64');};
    const d=row.draws.find(d=>d.name===program.name);assert.deepEqual(d.uniforms.w_h_height,draw.uniforms.w_h_height);
    return {frame:row.frameIndex,uniforms:d.uniforms.w_h_height,cut:image('bloomCut'),expected:image('bloomHorizontal')};
  });assert.equal(inputs.length,128);
}
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
  await call('Runtime.enable');
  const result=await evaluate(`(()=>{
    const input=${JSON.stringify({program,draw,frames:inputs})},canvas=document.createElement('canvas');canvas.width=57;canvas.height=106;
    const gl=canvas.getContext('webgl2',{antialias:false});if(!gl)throw Error('WebGL2 unavailable');gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
    const decode=s=>new Float32Array(Uint8Array.from(atob(s),v=>v.charCodeAt(0)).buffer),width=57,height=106,original=input.program.shaders,makeProgram=(coordinate='varying')=>{
      const program=gl.createProgram();for(const spec of original){const shader=gl.createShader(spec.type);let source=spec.source;
        if(spec.type===gl.FRAGMENT_SHADER&&coordinate!=='varying'){const expression=coordinate==='multiply'?'(gl_FragCoord.xy*w_h_height.xy)':'(gl_FragCoord.xy/vec2(57.,106.))';source=source.replaceAll('tex0+float2',expression+'+float2').replaceAll('tex0-float2',expression+'-float2');}
        gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);
      }gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program;
    };
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(input.draw.bloomState.vertices),gl.STATIC_DRAW);
    const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,2,1,3]),gl.STATIC_DRAW);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);const target=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete output');gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);
    const half=value=>{const words=new Uint32Array(1),floats=new Float32Array(words.buffer);floats[0]=value;const word=words[0],sign=word>>>16&0x8000,e=(word>>>23&255)-127+15,m=word&0x7fffff;if(e<=0)return sign|((m|0x800000)>>>Math.min(32,14-e));return sign|(e<<10)|(m>>>13);};
    const bump=(number,delta)=>{const floats=new Float32Array([number]),words=new Uint32Array(floats.buffer);words[0]+=delta;return floats[0];},results=[],halfOutputs=new Map();let pairedHalfOutputs=0;
    for(const frame of input.frames){const cut=decode(frame.cut),expected=decode(frame.expected);
    for(const format of ${JSON.stringify(windowMode?['float-upload']:['float-upload','half-upload','sub-upload','float-storage'])}){
      const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE15);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_BASE_LEVEL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,0);for(const key of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
      if(format==='sub-upload'){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.FLOAT,cut);}
      else gl.texImage2D(gl.TEXTURE_2D,0,format==='float-storage'?gl.RGBA32F:gl.RGBA16F,width,height,0,gl.RGBA,format==='half-upload'?gl.HALF_FLOAT:gl.FLOAT,format==='half-upload'?Uint16Array.from(cut,half):cut);
      for(const coordinate of ${JSON.stringify(windowMode?['varying']:['varying','multiply','divide'])}){const program=makeProgram(coordinate);gl.useProgram(program);for(const[name,size,offset]of[['vPosition',3,0],['tc',2,12]]){const at=gl.getAttribLocation(program,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,20,offset);}}gl.uniform1i(gl.getUniformLocation(program,'layer'),0);gl.uniform1i(gl.getUniformLocation(program,'tex_fb_filtered'),15);
        for(const ulps of ${JSON.stringify(windowMode?[0,1]:[-2,-1,0,1,2])}){const uniforms=frame.uniforms.slice();uniforms[0]=bump(uniforms[0],ulps);gl.uniform4fv(gl.getUniformLocation(program,'w_h_height'),uniforms);
          for(const frontFace of ${JSON.stringify(process.argv.includes('--probe-winding')?['CCW','CW']:['CCW'])}){gl.frontFace(gl[frontFace]);
          for(const primitive of ${JSON.stringify(windowMode?['strip']:['strip','indexed'])}){if(primitive==='strip')gl.drawArrays(gl.TRIANGLE_STRIP,0,4);else gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);const pixels=new Float32Array(width*height*4);let pack;if(${process.argv.includes('--probe-readback')}){pack=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);gl.bufferData(gl.PIXEL_PACK_BUFFER,pixels.byteLength,gl.STREAM_READ);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);}gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,pixels);if(pack){const saved=new Float32Array(pixels.length);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,saved);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(pack);if(saved.some((v,i)=>!Object.is(v,pixels[i])))throw Error('PBO and synchronous reads differ');}if(format!=='float-storage'){const key=[frame.frame,coordinate,ulps,frontFace,primitive].join('|'),prior=halfOutputs.get(key);if(prior){if(prior.some((v,i)=>!Object.is(v,pixels[i])))throw Error('Half-float input upload variants produce different output bytes');pairedHalfOutputs++;}else halfOutputs.set(key,pixels);}let different=0,maxAbsolute=0;const columns={},examples=[];for(let i=0;i<pixels.length;i++)if(!Object.is(pixels[i],expected[i])){different++;const x=Math.floor(i/4)%width;columns[x]=(columns[x]??0)+1;maxAbsolute=Math.max(maxAbsolute,Math.abs(pixels[i]-expected[i]));if(examples.length<3)examples.push({i,actual:pixels[i],expected:expected[i]});}results.push({frame:frame.frame,format,coordinate,ulps,frontFace,primitive,different,maxAbsolute,columns,examples});}}
        }gl.deleteProgram(program);
      }gl.deleteTexture(texture);
    }}
    return {results,pairedHalfOutputs,glError:gl.getError(),renderer:gl.getParameter(gl.RENDERER),context:gl.getContextAttributes()};
  })()`);
  assert.deepEqual(errors,[]);assert.equal(result.glError,0);
  const report={scope:'Diagnostic raw-WebGL component. Original pinned cutoff pixels are explicit inputs and original horizontal output is an unchanged expectation. Texture storage, mathematically equivalent coordinate expressions, reciprocal-width ULPs and primitive topology are varied only here; no production shader/reference is changed.',fixtureSHA256:sha(bytes),source:fixture.source,diagnostics:{windowMode,winding:process.argv.includes('--probe-winding'),pairedReadbacks:process.argv.includes('--probe-readback')},result,errors};
  fs.writeFileSync(path.join(output,'bloom-coordinates.json'),JSON.stringify(report,null,2),{flag:'wx'});
  const failures=ulps=>result.results.filter(r=>r.ulps===ulps&&r.different).map(r=>({frame:r.frame,different:r.different}));
  console.log(JSON.stringify({frames:inputs.length,trials:result.results.length,...windowMode?{baselineFailures:failures(0),shiftedFailureCount:failures(1).length,shiftedFailureExamples:failures(1).slice(0,4)}:{best:result.results.slice().sort((a,b)=>a.different-b.different).slice(0,8)},errors,glError:result.glError}));
}finally{socket.close();}
