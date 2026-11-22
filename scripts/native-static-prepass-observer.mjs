// Observe the original startup prepass without changing its commands, matrices,
// samples or inputs. Current-frame data is reference evidence only.
export function installNativeStaticPrepassObserver(){
 const data=window.nativeStaticPrepass={stages:[],programs:[],averages:[],images:{},errors:[],priorErrors:[],done:false},io=window.nativePostprocess.io,p=WebGL2RenderingContext.prototype,programs=new WeakMap();
 let current,busy=false,lastMirrorTarget,mirrors=0,framebuffer;const sampledFramebuffers=new Map();
 const bind=p.bindFramebuffer;p.bindFramebuffer=function(target,object){const result=bind.call(this,target,object);if(!busy&&(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER))framebuffer=object;return result;};
 const descriptor=(gl,program)=>{
  if(!program)return null;let value=programs.get(program);if(value)return value;
  const shaders=io.shadersFor(program),fragment=shaders?.find(shader=>shader.type===gl.FRAGMENT_SHADER)?.source,ao=gl.getUniformLocation(program,'AO_scale_timeblur');
  value={program,shaders,name:ao?'ambient_occlusion':fragment?.match(/\/\/ps_main_([^\s(]+)\(/)?.[1],basic:gl.getUniformBlockIndex(program,'basicMatrixBlock')};programs.set(program,value);return value;
 };
 const use=p.useProgram;p.useProgram=function(program){const result=use.call(this,program);if(!busy)current=descriptor(this,program);return result;};
 const uniform=(gl,program,name)=>{const location=gl.getUniformLocation(program,name);if(location===null)return null;const value=gl.getUniform(program,location);return ArrayBuffer.isView(value)?Array.from(value):value;};
 const target=gl=>gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)?io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)):null;
 const sample=(gl,program,name)=>{const unit=uniform(gl,program,name);if(unit===null)return null;const active=gl.getParameter(gl.ACTIVE_TEXTURE);try{gl.activeTexture(gl.TEXTURE0+unit);return io.textureId(gl.getParameter(gl.TEXTURE_BINDING_2D));}finally{gl.activeTexture(active);}};
 const before=gl=>{
  if(busy||data.done||!current)return;busy=true;
  try{
   const {program,name,basic}=current;
   if(basic!==gl.INVALID_INDEX&&!sampledFramebuffers.has(framebuffer)){
    const binding=gl.getActiveUniformBlockParameter(program,basic,gl.UNIFORM_BLOCK_BINDING),buffer=gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING,binding),prior=gl.getParameter(gl.UNIFORM_BUFFER_BINDING),values=new Float32Array(80);
    try{gl.bindBuffer(gl.UNIFORM_BUFFER,buffer);gl.getBufferSubData(gl.UNIFORM_BUFFER,gl.getIndexedParameter(gl.UNIFORM_BUFFER_START,binding),values);}finally{gl.bindBuffer(gl.UNIFORM_BUFFER,prior);}
    sampledFramebuffers.set(framebuffer,{target:target(gl),values:Array.from(values),matrixBits:Array.from(new Uint32Array(values.buffer)),projection:uniform(gl,program,'matProj[0]')});
   }
   if(!['fb_mirror','ambient_occlusion','fb_AO_static','fb_AO_no_filter_static'].includes(name))return;
   if(current.index===undefined){current.index=data.programs.length;data.programs.push({name,shaders:current.shaders});}
   const row={name,program:current.index,target:target(gl),viewport:Array.from(gl.getParameter(gl.VIEWPORT)),w_h_height:uniform(gl,program,'w_h_height'),AO_scale_timeblur:uniform(gl,program,'AO_scale_timeblur'),blend:gl.isEnabled(gl.BLEND)};
   if(name==='fb_mirror'){
    row.input=sample(gl,program,'tex_fb_unfiltered');
    const entry=[...sampledFramebuffers].find(([,packet])=>packet.target===row.input);if(entry){row.firstMatrices=entry[1];sampledFramebuffers.delete(entry[0]);}
    lastMirrorTarget=row.target;mirrors++;
   }
   if(name==='fb_AO_static'||name==='fb_AO_no_filter_static'){
    const input=sample(gl,program,'tex_fb_unfiltered')??sample(gl,program,'tex_fb_filtered'),ao=sample(gl,program,'tex_ao');
    data.images.accumulated=io.readColor(gl,input);data.images.ao=io.readColor(gl,ao);row.finalStatic=true;
   }
   data.stages.push(row);return row;
  }catch(error){data.errors.push(error.message);data.done=true;}finally{busy=false;}
 };
 const blit=p.blitFramebuffer;p.blitFramebuffer=function(...args){
  if(data.done||busy||lastMirrorTarget===undefined)return blit.apply(this,args);
  const source=this.getParameter(this.READ_FRAMEBUFFER_BINDING)?io.textureId(this.getFramebufferAttachmentParameter(this.READ_FRAMEBUFFER,this.COLOR_ATTACHMENT0,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)):null,result=blit.apply(this,args);
  if(source===lastMirrorTarget&&(args[8]&this.COLOR_BUFFER_BIT)){busy=true;try{
   for(let error;(error=this.getError())!==this.NO_ERROR;)data.priorErrors.push({stage:'native accumulated color blit',error,source,target:target(this)});
   const id=target(this),index=data.averages.length,key='average'+index;data.images[key]=io.readColor(this,id);data.averages.push({source,target:id,mirrorsSeen:mirrors,image:key,args});lastMirrorTarget=undefined;
   if(this.getFramebufferAttachmentParameter(this.DRAW_FRAMEBUFFER,this.DEPTH_ATTACHMENT,this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE)===this.TEXTURE){const depth=io.textureId(this.getFramebufferAttachmentParameter(this.DRAW_FRAMEBUFFER,this.DEPTH_ATTACHMENT,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME));data.images[key+'Depth']=io.readDepth(this,depth);}
  }catch(error){data.errors.push(error.message);}finally{busy=false;}}
  return result;
 };
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const raw=p[method];p[method]=function(...args){const row=before(this),result=raw.apply(this,args);if(row?.finalStatic){busy=true;try{data.images.staticAO=io.readColor(this,row.target);data.done=true;}catch(error){data.errors.push(error.message);data.done=true;}finally{busy=false;}}return result;};
 }
}
