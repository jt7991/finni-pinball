// Read-only frame observations. Scene/history inputs remain native outputs;
// no uniforms, physics, rendering commands or clock values are replaced.
export function installNativeWholeFrameObserver(){
 const data=window.nativeWholeFrame={armed:false,done:false,images:{},draws:[],clears:[],errors:[],priorErrors:[]},io=window.nativePostprocess.io;
 let busy=false;
 const location=(gl,program,name)=>gl.getUniformLocation(program,name);
 const uniform=(gl,program,name)=>{const loc=location(gl,program,name);if(loc===null)return null;const value=gl.getUniform(program,loc);return ArrayBuffer.isView(value)?Array.from(value):value;};
 const targetId=gl=>gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)?io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)):null;
 const samplerId=(gl,program,name)=>{
  const unit=uniform(gl,program,name);if(unit===null)return null;
  const active=gl.getParameter(gl.ACTIVE_TEXTURE);try{gl.activeTexture(gl.TEXTURE0+unit);return io.textureId(gl.getParameter(gl.TEXTURE_BINDING_2D));}finally{gl.activeTexture(active);}
 };
 const image=(gl,key,id,depth=false)=>{if(id===null||data.images[key])return;data.images[key]=depth?io.readDepth(gl,id):io.readColor(gl,id);};
 const before=(gl,method,args)=>{
  if(busy||!data.armed||data.done)return;
  busy=true;
  try{
   for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
   const program=gl.getParameter(gl.CURRENT_PROGRAM),shaders=io.shadersFor(program),fragment=shaders?.find(shader=>shader.type===gl.FRAGMENT_SHADER)?.source;
   const name=location(gl,program,'AO_scale_timeblur')!==null?'ambient_occlusion':fragment?.match(/\/\/ps_main_([^\s(]+)\(/)?.[1]??'geometry';
   const viewport=Array.from(gl.getParameter(gl.VIEWPORT)),target=targetId(gl);
   const row={method,args,name,target,viewport,scissorEnabled:gl.isEnabled(gl.SCISSOR_TEST),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX))};
   const basic=gl.getUniformBlockIndex(program,'basicMatrixBlock'),ball=gl.getUniformBlockIndex(program,'ballMatrixBlock'),block=basic!==gl.INVALID_INDEX?basic:ball;
   if(block!==gl.INVALID_INDEX){
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
    image(gl,'hdr',samplerId(gl,program,'tex_fb_unfiltered')??samplerId(gl,program,'tex_fb_filtered'));
    image(gl,'bloom',samplerId(gl,program,'tex_bloom'));
    image(gl,'depth',samplerId(gl,program,'tex_depth'),true);
    window.finni.evaluate('Debug.Print "WHOLE_FRAME_INDEX|" & FrameIndex');
    data.frameIndex=Number(Array.from(document.getElementById('log').textContent.matchAll(/WHOLE_FRAME_INDEX\|(\d+)/g)).at(-1)[1]);
    data.tone={name,w_h_height:uniform(gl,program,'w_h_height'),viewport,target};row.finalTone=true;
   }
   data.draws.push(row);
   return row;
  }catch(error){data.errors.push(error.message);data.done=true;}finally{busy=false;}
 };
 const p=WebGL2RenderingContext.prototype;
 const clear=p.clear;p.clear=function(mask){if(data.armed&&!data.done&&!busy)data.clears.push({target:targetId(this),mask,color:Array.from(this.getParameter(this.COLOR_CLEAR_VALUE)),depth:this.getParameter(this.DEPTH_CLEAR_VALUE),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});return clear.call(this,mask);};
 for(const method of ['clearBufferfv','clearBufferiv','clearBufferuiv','clearBufferfi']){
  const original=p[method];p[method]=function(...args){
   if(data.armed&&!data.done&&!busy){busy=true;try{
    const target=targetId(this);data.clears.push({method,target,args:args.map(value=>ArrayBuffer.isView(value)?Array.from(value):value),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});
    if(args[0]===this.COLOR)image(this,'priorClear'+target,target);
   }catch(error){data.errors.push(error.message);}finally{busy=false;}}
   return original.apply(this,args);
  };
 }
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const raw=p[method];p[method]=function(...args){const row=before(this,method,args),result=raw.apply(this,args);if(row?.finalTone){busy=true;try{data.images.final=io.readColor(this,row.target);data.done=true;data.armed=false;}catch(error){data.errors.push(error.message);}finally{busy=false;}}return result;};
 }
}
