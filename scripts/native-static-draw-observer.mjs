// Read the actual centered sample's draw state in each native startup prepass.
// No commands, uniforms, texture contents or visibility are replaced.
export function installNativeStaticDrawObserver(){
 const p=WebGL2RenderingContext.prototype,io=nativePostprocess.io,data=window.nativeStaticDraws={draws:[],programs:[],meshes:[],errors:[],priorErrors:[]},programs=new WeakMap(),meshKeys=new Map(),buffers=new WeakMap(),samplers=new WeakMap();let program,bufferSequence=0,busy=false;
 const id=buffer=>{if(!buffers.has(buffer))buffers.set(buffer,++bufferSequence);return buffers.get(buffer);};
 const base64=array=>{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);};
 const use=p.useProgram;p.useProgram=function(value){const result=use.call(this,value);program=value;return result;};
 for(const name of ['samplerParameteri','samplerParameterf']){const raw=p[name];p[name]=function(sampler,key,value){if(!samplers.has(sampler))samplers.set(sampler,{});samplers.get(sampler)[key]=value;return raw.call(this,sampler,key,value);};}
 const observe=(gl,method,args)=>{
  if(busy||nativeStaticPrepass.done||!program)return;const framebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);if(!framebuffer)return;
  const target=io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME));if((nativeStaticPrepass.samplesByInput[target]??0)%128!==127)return;
  const block=gl.getUniformBlockIndex(program,'basicMatrixBlock');if(block===gl.INVALID_INDEX)return;busy=true;
  try{
   for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push({target,error});
   const count=method==='drawRangeElements'?args[3]:args[1],type=method==='drawRangeElements'?args[4]:args[2],offset=method==='drawRangeElements'?args[5]:args[3];
   if(![gl.UNSIGNED_SHORT,gl.UNSIGNED_INT].includes(type))throw Error('Unexpected native static index type');
   if(!programs.has(program)){programs.set(program,data.programs.length);data.programs.push({shaders:io.shadersFor(program)});}
   const uniforms={},textures={},active=gl.getParameter(gl.ACTIVE_TEXTURE);
   try{for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
    const info=gl.getActiveUniform(program,i),location=gl.getUniformLocation(program,info.name);if(location===null)continue;let value=gl.getUniform(program,location);
    if(info.size>1){value=[];for(let j=0;j<info.size;j++){const item=gl.getUniform(program,gl.getUniformLocation(program,info.name.replace('[0]','['+j+']')));value.push(...(ArrayBuffer.isView(item)?item:[item]));}}
    uniforms[info.name]=ArrayBuffer.isView(value)?Array.from(value):value;
    if(info.type===gl.SAMPLER_2D){gl.activeTexture(gl.TEXTURE0+value);const sampler=gl.getParameter(gl.SAMPLER_BINDING),texture=gl.getParameter(gl.TEXTURE_BINDING_2D);textures[info.name]={id:io.textureId(texture),sampler:Object.fromEntries([gl.TEXTURE_MAG_FILTER,gl.TEXTURE_MIN_FILTER,gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].map(key=>[key,sampler?gl.getSamplerParameter(sampler,key):gl.getTexParameter(gl.TEXTURE_2D,key)]))};textures[info.name].sampler[34046]=samplers.get(sampler)?.[34046]??1;}
   }}finally{gl.activeTexture(active);}
   const binding=gl.getActiveUniformBlockParameter(program,block,gl.UNIFORM_BLOCK_BINDING),ubo=gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING,binding),previousUBO=gl.getParameter(gl.UNIFORM_BUFFER_BINDING),matrices=new Float32Array(80);
   try{gl.bindBuffer(gl.UNIFORM_BUFFER,ubo);gl.getBufferSubData(gl.UNIFORM_BUFFER,gl.getIndexedParameter(gl.UNIFORM_BUFFER_START,binding),matrices);}finally{gl.bindBuffer(gl.UNIFORM_BUFFER,previousUBO);}
   const vertex=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),index=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING),stride=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(0,gl.VERTEX_ATTRIB_ARRAY_POINTER),key=[id(vertex),id(index),stride,pointer,count,type,offset].join(':');let mesh=meshKeys.get(key);
   if(mesh===undefined){
    if(stride!==32)throw Error('Unexpected static vertex stride '+stride);const indices=type===gl.UNSIGNED_SHORT?new Uint16Array(count):new Uint32Array(count);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);let min=Infinity,max=-Infinity;for(const value of indices){min=Math.min(min,value);max=Math.max(max,value);}const values=new Float32Array((max-min+1)*8),previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    try{gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.getBufferSubData(gl.ARRAY_BUFFER,pointer+min*stride,values);}finally{gl.bindBuffer(gl.ARRAY_BUFFER,previous);}
    mesh=data.meshes.length;meshKeys.set(key,mesh);data.meshes.push({vertices:values.length/8,vertexBytes:base64(values),indexBytes:base64(Uint32Array.from(indices,value=>value-min))});
   }
   const state={};for(const [name,key]of Object.entries({blendSrcRGB:gl.BLEND_SRC_RGB,blendDstRGB:gl.BLEND_DST_RGB,blendSrcAlpha:gl.BLEND_SRC_ALPHA,blendDstAlpha:gl.BLEND_DST_ALPHA,blendEquationRGB:gl.BLEND_EQUATION_RGB,blendEquationAlpha:gl.BLEND_EQUATION_ALPHA,depthWrite:gl.DEPTH_WRITEMASK,depthFunc:gl.DEPTH_FUNC,cullFace:gl.CULL_FACE_MODE,frontFace:gl.FRONT_FACE}))state[name]=gl.getParameter(key);
   state.blend=gl.isEnabled(gl.BLEND);state.cull=gl.isEnabled(gl.CULL_FACE);state.depthTest=gl.isEnabled(gl.DEPTH_TEST);state.scissorEnabled=gl.isEnabled(gl.SCISSOR_TEST);state.scissor=Array.from(gl.getParameter(gl.SCISSOR_BOX));
   data.draws.push({target,program:programs.get(program),mesh,count,uniforms,textures,state,matrixBits:Array.from(new Uint32Array(matrices.buffer))});
   const error=gl.getError();if(error)throw Error('Static draw readback error '+error);
  }catch(error){data.errors.push(error.message);}finally{busy=false;}
 };
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements']){const raw=p[method];p[method]=function(...args){observe(this,method,args);return raw.apply(this,args);};}
}
