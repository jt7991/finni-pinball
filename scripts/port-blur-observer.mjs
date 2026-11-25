// Observe inside nativeSamplersFor's bound-sampler draw, before WebGL executes
// it. GPU work remains synchronous; all temporary read bindings are restored.
export function installPortBlurObserver(){
 const data=window.portBlurObserver={context:null,frame:0,firstFrame:1,pixelFrames:[],draws:[],programs:[],errors:[],priorErrors:[]},programIds=new WeakMap(),prototype=WebGL2RenderingContext.prototype;let busy=false;
 const observe=(gl,method,args)=>{
  if(busy||gl!==data.context||data.frame<data.firstFrame)return;
  const io=window.nativePostprocess.io,program=gl.getParameter(gl.CURRENT_PROGRAM),shaders=io.shadersFor(program),fragment=shaders?.find(s=>s.type===gl.FRAGMENT_SHADER)?.source;
  if(!fragment?.includes('//ps_main_fb_blur_horiz39x39()'))return;
  busy=true;
  try{
   for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push({frame:data.frame,error});
   if(!programIds.has(program)){programIds.set(program,data.programs.length);data.programs.push({shaders});}
   const row={frame:data.frame,method,args,program:programIds.get(program),uniforms:{},state:{viewport:Array.from(gl.getParameter(gl.VIEWPORT)),scissorEnabled:gl.isEnabled(gl.SCISSOR_TEST),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),blend:gl.isEnabled(gl.BLEND),depth:gl.isEnabled(gl.DEPTH_TEST),dither:gl.isEnabled(gl.DITHER),cull:gl.isEnabled(gl.CULL_FACE),colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK)),sampleCoverage:gl.isEnabled(gl.SAMPLE_COVERAGE),sampleAlphaToCoverage:gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE)},attributes:{}};
   for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i),value=gl.getUniform(program,gl.getUniformLocation(program,info.name));row.uniforms[info.name]=ArrayBuffer.isView(value)?Array.from(value):value;}
   const active=gl.getParameter(gl.ACTIVE_TEXTURE),prior=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
   try{
    const unit=row.uniforms.tex_fb_filtered;gl.activeTexture(gl.TEXTURE0+unit);const texture=gl.getParameter(gl.TEXTURE_BINDING_2D),id=io.textureId(texture),sampler=gl.getParameter(gl.SAMPLER_BINDING),parameters={};
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER,gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_MIN_LOD,gl.TEXTURE_MAX_LOD,gl.TEXTURE_COMPARE_MODE,gl.TEXTURE_COMPARE_FUNC])parameters[key]=sampler?gl.getSamplerParameter(sampler,key):gl.getTexParameter(gl.TEXTURE_2D,key);
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)parameters[anisotropy.TEXTURE_MAX_ANISOTROPY_EXT]=sampler?gl.getSamplerParameter(sampler,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT):gl.getTexParameter(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT);
    row.input={unit,id,hasSampler:!!sampler,metadata:window.nativePostprocess.textures[id],parameters,levels:Object.fromEntries([gl.TEXTURE_BASE_LEVEL,gl.TEXTURE_MAX_LEVEL,gl.TEXTURE_IMMUTABLE_FORMAT,gl.TEXTURE_IMMUTABLE_LEVELS].map(key=>[key,gl.getTexParameter(gl.TEXTURE_2D,key)]))};
    for(const name of ['vPosition','tc']){
     const index=gl.getAttribLocation(program,name),enabled=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_ENABLED),size=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_SIZE),stride=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(index,gl.VERTEX_ATTRIB_ARRAY_POINTER),type=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_TYPE),attribute={index,enabled,size,stride,pointer,type,normalized:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),integer:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_INTEGER),divisor:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_DIVISOR)};
     if(enabled){if(type!==gl.FLOAT)throw Error('Unexpected fullscreen attribute type');const step=(stride||size*4)/4,values=new Float32Array(step*3+size);gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));gl.getBufferSubData(gl.ARRAY_BUFFER,pointer,values);attribute.values=Array.from({length:4},(_,i)=>Array.from(values.subarray(i*step,i*step+size)));}else attribute.current=Array.from(gl.getVertexAttrib(index,gl.CURRENT_VERTEX_ATTRIB));row.attributes[name]=attribute;
    }
    if(method==='drawElements'){const count=args[1],type=args[2],indices=type===gl.UNSIGNED_SHORT?new Uint16Array(count):new Uint32Array(count);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,args[3],indices);row.indices=Array.from(indices);}
    if(data.pixelFrames.includes(data.frame))row.inputImage=io.readColor(gl,id,false,false);
   }finally{gl.activeTexture(active);gl.bindBuffer(gl.ARRAY_BUFFER,prior);}
   const target=gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);row.target=io.textureId(target);data.draws.push(row);return row;
  }catch(error){data.errors.push({frame:data.frame,message:String(error)});}finally{busy=false;}
 };
 for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
  const original=prototype[method];prototype[method]=function(...args){const row=observe(this,method,args),result=original.apply(this,args);if(row&&data.pixelFrames.includes(data.frame)){busy=true;try{row.outputImage=window.nativePostprocess.io.readColor(this,row.target,false,false);}catch(error){data.errors.push({frame:data.frame,message:String(error)});}finally{busy=false;}}return result;};
 }
}
