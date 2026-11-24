// Read-only frame observations. Scene/history inputs remain native outputs;
// no uniforms, physics, rendering commands or clock values are replaced.
export function installNativeWholeFrameObserver(options={}){
 const data=window.nativeWholeFrame={armed:!!options.fromInitialization,done:false,images:{},draws:[],clears:[],errors:[],priorErrors:[]},io=window.nativePostprocess.io;
 if(options.fromInitialization){
  if(!Number.isInteger(options.frames)||options.frames<2||options.frames>16)throw Error('Consecutive capture requires 2..16 frames');
  data.frames=[];
 }
 const nextFrame=()=>{
   if(options.fromInitialization&&!busy&&data.done&&!data.errors.length&&data.frames.length<options.frames){
    for(const key of ['frameIndex','tone','reflectedTransmissionObserved','reflectedTransmissionTexture'])delete data[key];
    Object.assign(data,{armed:true,done:false,images:{},draws:[],clears:[],errors:[],priorErrors:[]});
   }
 };
 let busy=false;
 const historyPrograms=new WeakMap();
 const location=(gl,program,name)=>gl.getUniformLocation(program,name);
 const uniform=(gl,program,name)=>{const loc=location(gl,program,name);if(loc===null)return null;const value=gl.getUniform(program,loc);return ArrayBuffer.isView(value)?Array.from(value):value;};
 const targetId=gl=>gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)?io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)):null;
 const samplerId=(gl,program,name)=>{
  const unit=uniform(gl,program,name);if(unit===null)return null;
  const active=gl.getParameter(gl.ACTIVE_TEXTURE);try{gl.activeTexture(gl.TEXTURE0+unit);return io.textureId(gl.getParameter(gl.TEXTURE_BINDING_2D));}finally{gl.activeTexture(active);}
 };
 const image=(gl,key,id,depth=false)=>{if(id===null||data.images[key])return;data.images[key]=depth?io.readDepth(gl,id):io.readColor(gl,id);};
 const pixel=gl=>{const previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),values=new Float32Array(4);try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING));gl.readPixels(...data.tracePixel,1,1,gl.RGBA,gl.FLOAT,values);return Array.from(values);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);}};
 const base64=values=>{const bytes=new Uint8Array(values.buffer,values.byteOffset,values.byteLength);let result='';for(let i=0;i<bytes.length;i+=0x8000)result+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(result);};
 const geometry=(gl,args)=>{const [,count,type,offset]=args,stride=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(0,gl.VERTEX_ATTRIB_ARRAY_POINTER),buffer=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING);if(stride!==32||![gl.UNSIGNED_SHORT,gl.UNSIGNED_INT].includes(type))throw Error('Unexpected observed light geometry ABI');const indices=type===gl.UNSIGNED_SHORT?new Uint16Array(count):new Uint32Array(count);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);let min=Infinity,max=-Infinity;for(const index of indices){min=Math.min(min,index);max=Math.max(max,index);}const vertices=new Float32Array((max-min+1)*8);try{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.getBufferSubData(gl.ARRAY_BUFFER,pointer+min*stride,vertices);}finally{gl.bindBuffer(gl.ARRAY_BUFFER,previous);}return{vertices:vertices.length/8,indices:count,vertexBytes:base64(vertices),indexBytes:base64(Uint32Array.from(indices,index=>index-min))};};
 const before=(gl,method,args)=>{
  nextFrame();
  if(busy||!data.armed||data.done)return;
  busy=true;
  try{
   if(!options.imagesOnly)for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
   const program=gl.getParameter(gl.CURRENT_PROGRAM);let info=options.imagesOnly?historyPrograms.get(program):undefined;
   if(!info){const shaders=io.shadersFor(program),fragment=shaders?.find(shader=>shader.type===gl.FRAGMENT_SHADER)?.source;info={name:location(gl,program,'AO_scale_timeblur')!==null?'ambient_occlusion':fragment?.match(/\/\/ps_main_([^\s(]+)\(/)?.[1]??'geometry',ball:options.imagesOnly&&gl.getUniformBlockIndex(program,'ballMatrixBlock')!==gl.INVALID_INDEX};if(options.imagesOnly)historyPrograms.set(program,info);}
   const {name}=info;
   // The history capture needs postprocess inputs/outputs, not thousands of
   // static-prepass matrix readbacks. The existing detailed capture retains
   // its complete draw/matrix observations when imagesOnly is absent.
   if(options.imagesOnly&&name!=='ambient_occlusion'&&!['fb_blur_horiz19x19','fb_blur_vert19x19','fb_bloom','fb_blur_horiz39x39','fb_blur_vert39x39'].includes(name)&&!name.startsWith('fb_rhtonemap')){
    if(!data.images.previousHDR&&info.ball){for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);image(gl,'previousHDR',samplerId(gl,program,'tex_ball_playfield'));}
    return;
   }
   if(options.imagesOnly)for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
   const viewport=Array.from(gl.getParameter(gl.VIEWPORT)),target=targetId(gl);
   const row={method,args,name,target,viewport,scissorEnabled:gl.isEnabled(gl.SCISSOR_TEST),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX))};
   if(options.imagesOnly)row.uniforms=Object.fromEntries(['w_h_height','exposure_wcg','bloom_dither_colorgrade','AO_scale_timeblur'].map(key=>[key,uniform(gl,program,key)]).filter(([,value])=>value!==null));
   if(data.captureLightGeometry&&method==='drawElements'&&location(gl,program,'lightCenter_maxRange')!==null&&viewport[2]===gl.drawingBufferWidth&&viewport[3]===gl.drawingBufferHeight){row.lightGeometry=geometry(gl,args);row.lightCenter=uniform(gl,program,'lightCenter_maxRange');row.lightBlend=uniform(gl,program,'blend_modulate_vs_add');}
   if(data.tracePixel&&target!==null&&[gl.RGBA16F,gl.RGBA32F].includes(nativePostprocess.textures[target]?.internalFormat)&&viewport[2]===gl.drawingBufferWidth&&viewport[3]===gl.drawingBufferHeight)row.pixelBefore=pixel(gl);
   if(row.pixelBefore||row.lightGeometry){row.uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const active=gl.getActiveUniform(program,i),value=uniform(gl,program,active.name);if(value!==null)row.uniforms[active.name]=value;}row.blend={enabled:gl.isEnabled(gl.BLEND),src:gl.getParameter(gl.BLEND_SRC_RGB),dst:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),equation:gl.getParameter(gl.BLEND_EQUATION_RGB),equationAlpha:gl.getParameter(gl.BLEND_EQUATION_ALPHA),mask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK))};}
   if(location(gl,program,'tex_light_color')!==null)row.classicUniforms=Object.fromEntries(['lightColor_intensity','lightColor2_falloff_power','lightCenter_maxRange'].map(name=>[name,uniform(gl,program,name)]));
   const basic=gl.getUniformBlockIndex(program,'basicMatrixBlock'),ball=gl.getUniformBlockIndex(program,'ballMatrixBlock'),block=basic!==gl.INVALID_INDEX?basic:ball;
   if(block!==gl.INVALID_INDEX&&(!options.imagesOnly||!data.images.reflection||!data.images.previousHDR||!data.images.transmission)){
    const binding=gl.getActiveUniformBlockParameter(program,block,gl.UNIFORM_BLOCK_BINDING),buffer=gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING,binding),previous=gl.getParameter(gl.UNIFORM_BUFFER_BINDING),size=gl.getActiveUniformBlockParameter(program,block,gl.UNIFORM_BLOCK_DATA_SIZE),values=new Float32Array(size/4);
    try{gl.bindBuffer(gl.UNIFORM_BUFFER,buffer);gl.getBufferSubData(gl.UNIFORM_BUFFER,gl.getIndexedParameter(gl.UNIFORM_BUFFER_START,binding),values);}finally{gl.bindBuffer(gl.UNIFORM_BUFFER,previous);}
    row.matrixKind=basic!==gl.INVALID_INDEX?'basic':'ball';row.matrices=Array.from(values);
    if(values[26]<0)image(gl,'initialReflection',target);
    if(row.matrixKind==='basic'){
     row.transmissionActive=location(gl,program,'tex_base_transmission')!==null;
     row.transmissionTexture=samplerId(gl,program,'tex_base_transmission');
     if(values[26]<0&&row.transmissionActive){data.reflectedTransmissionObserved=true;data.reflectedTransmissionTexture=row.transmissionTexture;const texture=nativePostprocess.textures[row.transmissionTexture];image(gl,texture?.width>1?'priorReflectionTransmission':'reflectionTransmission',row.transmissionTexture);}
    }
    if(row.matrixKind==='basic'&&values[26]>=0&&(uniform(gl,program,'mirrorNormal_factor')?.[3]??0)>0)image(gl,'reflection',samplerId(gl,program,'tex_reflection'));
    if(row.matrixKind==='basic'&&values[26]>=0)image(gl,'transmission',samplerId(gl,program,'tex_base_transmission'));
    if(row.matrixKind==='ball'){
     row.orientation=uniform(gl,program,'orientation');
     image(gl,'previousHDR',samplerId(gl,program,'tex_ball_playfield'));
    }
   }
   if(name==='fb_blur_horiz19x19')image(gl,'priorTransmissionFiltered',target);
   if(name==='ambient_occlusion'){
    image(gl,'depth',samplerId(gl,program,'tex_depth'),true);
    image(gl,'priorAO',samplerId(gl,program,'tex_fb_filtered'));
   }
   if(name.startsWith('fb_rhtonemap')){
    if(options.imagesOnly)image(gl,'ao',samplerId(gl,program,'tex_ao'));
    image(gl,'hdr',samplerId(gl,program,'tex_fb_unfiltered')??samplerId(gl,program,'tex_fb_filtered'));
    image(gl,'bloom',samplerId(gl,program,'tex_bloom'));
    image(gl,'depth',samplerId(gl,program,'tex_depth'),true);
    if(options.fromInitialization)data.frameIndex=window.nativeStartup.frameIndex();
    else{window.finni.evaluate('Debug.Print "WHOLE_FRAME_INDEX|" & FrameIndex');
    data.frameIndex=Number(Array.from(document.getElementById('log').textContent.matchAll(/WHOLE_FRAME_INDEX\|(\d+)/g)).at(-1)[1]);}
    data.tone={name,w_h_height:uniform(gl,program,'w_h_height'),viewport,target};row.finalTone=true;
   }
   if(!options.imagesOnly||name!=='geometry')data.draws.push(row);
   return row;
  }catch(error){data.errors.push(error.message);data.done=true;}finally{busy=false;}
 };
 const p=WebGL2RenderingContext.prototype;
 const clear=p.clear;p.clear=function(mask){nextFrame();if(data.armed&&!data.done&&!busy)data.clears.push({target:targetId(this),mask,color:Array.from(this.getParameter(this.COLOR_CLEAR_VALUE)),depth:this.getParameter(this.DEPTH_CLEAR_VALUE),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});return clear.call(this,mask);};
 for(const method of ['clearBufferfv','clearBufferiv','clearBufferuiv','clearBufferfi']){
  const original=p[method];p[method]=function(...args){
   nextFrame();
   if(data.armed&&!data.done&&!busy){busy=true;try{
    const target=targetId(this);data.clears.push({method,target,args:args.map(value=>ArrayBuffer.isView(value)?Array.from(value):value),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});
    if(!options.imagesOnly&&args[0]===this.COLOR)image(this,'priorClear'+target,target);
   }catch(error){data.errors.push(error.message);}finally{busy=false;}}
   return original.apply(this,args);
  };
 }
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const raw=p[method];p[method]=function(...args){const row=before(this,method,args),result=raw.apply(this,args);if(row?.pixelBefore){busy=true;try{row.pixelAfter=pixel(this);}catch(error){data.errors.push(error.message);}finally{busy=false;}}if(row?.finalTone){busy=true;try{data.images.final=io.readColor(this,row.target);data.done=true;data.armed=false;if(options.fromInitialization){
   data.frames.push({images:data.images,draws:data.draws,clears:data.clears,errors:data.errors,priorErrors:data.priorErrors,frameIndex:data.frameIndex,tone:data.tone,playing:document.body.classList.contains('playing'),snapshot:window.nativeStartup.read(),canvas:{width:this.drawingBufferWidth,height:this.drawingBufferHeight}});
  }}catch(error){data.errors.push(error.message);}finally{busy=false;}}return result;};
 }
}
