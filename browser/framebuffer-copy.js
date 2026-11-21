const installed=new WeakSet();

// Avoid combined HDR color/depth blit corruption observed in Android GLES.
// A shader copy preserves VPX's cached scene without redrawing
// hundreds of static meshes. Leave other blits on the native path.
export function installFramebufferCopy(gl){
  if(!gl||installed.has(gl))return;
  const program=gl.createProgram(),shaders=[];
  try{
    for(const [type,source] of [
      [gl.VERTEX_SHADER,`#version 300 es
        precision highp float;
        out vec2 uv;
        void main(){
          vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
          uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);
        }`],
      [gl.FRAGMENT_SHADER,`#version 300 es
        precision highp float;
        precision highp sampler2D;
        uniform sampler2D sourceColor;
        uniform sampler2D sourceDepth;
        in vec2 uv;
        out vec4 color;
        void main(){
          color=texture(sourceColor,uv);
          gl_FragDepth=texture(sourceDepth,uv).r;
        }`],
    ]){
      const shader=gl.createShader(type);shaders.push(shader);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  }catch(error){gl.deleteProgram(program);throw Error(`Could not prepare the mobile renderer: ${error.message}`);}
  finally{for(const shader of shaders)gl.deleteShader(shader);}

  const vao=gl.createVertexArray(),sampler=gl.createSampler();
  gl.samplerParameteri(sampler,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.samplerParameteri(sampler,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.samplerParameteri(sampler,gl.TEXTURE_COMPARE_MODE,gl.NONE);
  gl.samplerParameteri(sampler,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(sampler,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const colorLocation=gl.getUniformLocation(program,'sourceColor');
  const depthLocation=gl.getUniformLocation(program,'sourceDepth');
  const capabilities=[gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,
    gl.STENCIL_TEST,gl.POLYGON_OFFSET_FILL,gl.RASTERIZER_DISCARD,gl.DITHER,
    gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE];
  const original=gl.blitFramebuffer;
  gl.blitFramebuffer=function(...args){
    const [sx,sy,sw,sh,dx,dy,dw,dh,mask,filter]=args;
    if(mask!==(this.COLOR_BUFFER_BIT|this.DEPTH_BUFFER_BIT)||filter!==this.NEAREST||
       sx||sy||dx||dy||sw!==dw||sh!==dh||dw<=0||dh<=0||
       !this.getParameter(this.READ_FRAMEBUFFER_BINDING)||!this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)){
      return original.apply(this,args);
    }
    const attachment=(target,kind,parameter)=>this.getFramebufferAttachmentParameter(target,kind,parameter);
    const objectType=this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE;
    if(attachment(this.READ_FRAMEBUFFER,this.COLOR_ATTACHMENT0,objectType)!==this.TEXTURE||
       attachment(this.READ_FRAMEBUFFER,this.DEPTH_ATTACHMENT,objectType)!==this.TEXTURE){
      return original.apply(this,args);
    }
    const color=attachment(this.READ_FRAMEBUFFER,this.COLOR_ATTACHMENT0,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    const depth=attachment(this.READ_FRAMEBUFFER,this.DEPTH_ATTACHMENT,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
    if(color===attachment(this.DRAW_FRAMEBUFFER,this.COLOR_ATTACHMENT0,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)||
       depth===attachment(this.DRAW_FRAMEBUFFER,this.DEPTH_ATTACHMENT,this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)){
      return original.apply(this,args);
    }
    const state={
      program:this.getParameter(this.CURRENT_PROGRAM),vao:this.getParameter(this.VERTEX_ARRAY_BINDING),
      viewport:this.getParameter(this.VIEWPORT),colors:this.getParameter(this.COLOR_WRITEMASK),
      depthWrite:this.getParameter(this.DEPTH_WRITEMASK),depthFunc:this.getParameter(this.DEPTH_FUNC),
      depthRange:this.getParameter(this.DEPTH_RANGE),active:this.getParameter(this.ACTIVE_TEXTURE),
      enabled:capabilities.map(cap=>this.isEnabled(cap)),
    };
    const bindings=[];
    try{
      for(const [unit,texture] of [[0,depth],[1,color]]){
        this.activeTexture(this.TEXTURE0+unit);
        bindings.push([unit,this.getParameter(this.TEXTURE_BINDING_2D),this.getParameter(this.SAMPLER_BINDING)]);
        this.bindTexture(this.TEXTURE_2D,texture);this.bindSampler(unit,sampler);
      }
      for(const cap of capabilities)this.disable(cap);
      this.enable(this.DEPTH_TEST);this.depthMask(true);this.depthFunc(this.ALWAYS);this.depthRange(0,1);
      this.colorMask(true,true,true,true);this.viewport(0,0,dw,dh);
      this.useProgram(program);this.uniform1i(depthLocation,0);this.uniform1i(colorLocation,1);
      this.bindVertexArray(vao);this.drawArrays(this.TRIANGLES,0,3);
    }finally{
      this.bindVertexArray(state.vao);this.useProgram(state.program);this.viewport(...state.viewport);
      this.colorMask(...state.colors);this.depthMask(state.depthWrite);this.depthFunc(state.depthFunc);
      this.depthRange(...state.depthRange);
      capabilities.forEach((cap,index)=>state.enabled[index]?this.enable(cap):this.disable(cap));
      for(const [unit,texture,boundSampler] of bindings){
        this.activeTexture(this.TEXTURE0+unit);this.bindTexture(this.TEXTURE_2D,texture);this.bindSampler(unit,boundSampler);
      }
      this.activeTexture(state.active);
    }
  };
  installed.add(gl);
}
