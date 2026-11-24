// Install before renderer creation, so cached/bound draw functions retain the
// observer. Activated by the replay only for its explicitly requested frame.
export function installPortPixelObserver(){
 const data=window.portPixelObserver={frame:0,targetFrame:0,pixel:null,context:null,target:null,draws:[],observed:0,matched:0,samples:[],errors:[]},prototype=WebGL2RenderingContext.prototype;
 const read=gl=>{const previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),values=new Float32Array(4);try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING));gl.readPixels(...data.pixel,1,1,gl.RGBA,gl.FLOAT,values);const error=gl.getError();if(error)data.errors.push({error,readBuffer:gl.getParameter(gl.READ_BUFFER),status:gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)});return Array.from(values);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);}};
 for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','drawRangeElements','blitFramebuffer','clear','clearBufferfv']){
  const original=prototype[method];prototype[method]=function(...args){
   if(this!==data.context||!data.frame||data.frame!==data.targetFrame)return original.apply(this,args);
   data.observed++;if(this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)!==data.target)return original.apply(this,args);
   data.matched++;const before=read(this),result=original.apply(this,args),after=read(this);
   if(data.samples.length<4)data.samples.push({method,before,after});
   const program=this.getParameter(this.CURRENT_PROGRAM),colorLocation=program&&this.getUniformLocation(program,'staticColor_Alpha'),color=colorLocation&&this.getUniform(program,colorLocation);
   const warmFlasher=color?.[3]===3.75&&Math.abs(color[0]-.9215686917304993)<.00001;
   if(warmFlasher||after.some((value,i)=>value!==before[i])){
    const uniforms={};
    if(program)for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++){const info=this.getActiveUniform(program,i),location=this.getUniformLocation(program,info.name);if(location!==null){const value=this.getUniform(program,location);uniforms[info.name]=ArrayBuffer.isView(value)?Array.from(value):value;}}
    const gl=this,state={depthTest:gl.isEnabled(gl.DEPTH_TEST),depthFunc:gl.getParameter(gl.DEPTH_FUNC),depthMask:gl.getParameter(gl.DEPTH_WRITEMASK),cull:gl.isEnabled(gl.CULL_FACE),cullMode:gl.getParameter(gl.CULL_FACE_MODE),frontFace:gl.getParameter(gl.FRONT_FACE),blend:gl.isEnabled(gl.BLEND),src:gl.getParameter(gl.BLEND_SRC_RGB),dst:gl.getParameter(gl.BLEND_DST_RGB),equation:gl.getParameter(gl.BLEND_EQUATION_RGB),polygonOffset:gl.isEnabled(gl.POLYGON_OFFSET_FILL),viewport:Array.from(gl.getParameter(gl.VIEWPORT)),scissor:gl.isEnabled(gl.SCISSOR_TEST),colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK))},textures={};
    const previousTexture=gl.getParameter(gl.ACTIVE_TEXTURE);try{for(const name of ['tex_flasher_A','tex_flasher_B'])if(uniforms[name]!==undefined){gl.activeTexture(gl.TEXTURE0+uniforms[name]);const handle=gl.getParameter(gl.TEXTURE_BINDING_2D),id=window.nativePostprocess.io.textureId(handle),sampler=gl.getParameter(gl.SAMPLER_BINDING);textures[name]={id,metadata:window.nativePostprocess.textures[id],parameters:Object.fromEntries([gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER,gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].map(key=>[key,sampler?gl.getSamplerParameter(sampler,key):gl.getTexParameter(gl.TEXTURE_2D,key)]))};}}finally{gl.activeTexture(previousTexture);}
    const attributes={};if(warmFlasher){for(const name of ['vPosition','tc']){const index=gl.getAttribLocation(program,name),buffer=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING),stride=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_STRIDE),offset=gl.getVertexAttribOffset(index,gl.VERTEX_ATTRIB_ARRAY_POINTER),values=new Float32Array(32),enabled=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_ENABLED),divisor=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_DIVISOR);try{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.getBufferSubData(gl.ARRAY_BUFFER,0,values);}finally{gl.bindBuffer(gl.ARRAY_BUFFER,previous);}attributes[name]={index,stride,offset,enabled,divisor,values:Array.from(values)};}}
    const textureA=warmFlasher?window.nativePostprocess.io.readColor(gl,textures.tex_flasher_A.id):undefined;
    data.draws.push({method,args:args.map(value=>ArrayBuffer.isView(value)?Array.from(value):value),before,after,uniforms,state,textures,attributes,textureA});
   }
   return result;
  };
 }
}
