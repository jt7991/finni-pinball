// Read-only native cache-copy input/output observations. No native draws,
// uniforms, image pixels, clocks or render state are replaced.
export function installNativeBackdropObserver({maxCopies=1}={}){
 const p=WebGL2RenderingContext.prototype,data=window.nativeBackdrop={armed:false,done:false,errors:[],priorErrors:[],captures:[]};let observing=false;
 const raw=p.drawArrays;
 p.drawArrays=function(...args){
  let capture;
  if(data.armed&&!data.done&&!observing){
   const gl=this,program=gl.getParameter(gl.CURRENT_PROGRAM),color=gl.getUniformLocation(program,'sourceColor'),depth=gl.getUniformLocation(program,'sourceDepth');
   if(color&&depth){observing=true;try{
    for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
    const io=nativePostprocess.io,shaders=io.shadersFor(program);if(!shaders?.some(s=>s.source.includes('arcadeBackdrop')))throw Error('Unexpected framebuffer copy program');
    const previous=gl.getParameter(gl.ACTIVE_TEXTURE),inputs={};
    try{for(const [name,location]of [['sourceColor',color],['sourceDepth',depth]]){gl.activeTexture(gl.TEXTURE0+gl.getUniform(program,location));const texture=gl.getParameter(gl.TEXTURE_BINDING_2D),id=io.textureId(texture);inputs[name]=name==='sourceDepth'?io.readDepth(gl,id):io.readColor(gl,id);}}finally{gl.activeTexture(previous);}
    const id=io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)),depthId=io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME));
    capture=data.capture={shaders,viewport:Array.from(gl.getParameter(gl.VIEWPORT)),inputs,target:id,depthTarget:depthId,prior:io.readColor(gl,id),draw:{method:'drawArrays',args},colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK)),depthWrite:gl.getParameter(gl.DEPTH_WRITEMASK),depthFunc:gl.getParameter(gl.DEPTH_FUNC),blend:gl.isEnabled(gl.BLEND),scissor:gl.isEnabled(gl.SCISSOR_TEST)};
    data.captures.push(capture);
   }catch(error){data.errors.push(error.message);data.done=true;}finally{observing=false;}}
  }
  const result=raw.apply(this,args);
  if(capture){observing=true;try{capture.output=nativePostprocess.io.readColor(this,capture.target);capture.outputDepth=nativePostprocess.io.readDepth(this,capture.depthTarget);data.done=data.captures.length>=maxCopies;}catch(error){data.errors.push(error.message);data.done=true;}finally{observing=false;}}
  return result;
 };
}
