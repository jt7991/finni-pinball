const installed=new WeakSet();

// Restore the cached scene, replacing only empty far-depth pixels with the
// arcade backdrop. The shader copy also avoids Android's combined HDR/depth
// blit corruption without redrawing static meshes. Other blits stay native.
export function installFramebufferCopy(gl,onRendered){
  if(!gl||installed.has(gl))return;
  const program=gl.createProgram(),shaders=[];
  try{
    for(const [type,source] of [
      [gl.VERTEX_SHADER,`#version 300 es
        precision highp float;
        precision highp int;
        out vec2 uv;
        void main(){
          vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
          uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);
        }`],
      [gl.FRAGMENT_SHADER,`#version 300 es
        precision highp float;
        precision highp int;
        precision highp sampler2D;
        uniform sampler2D sourceColor;
        uniform sampler2D sourceDepth;
        in vec2 uv;
        out vec4 color;
        uint starHash(uvec2 cell){
          uint seed=cell.x*1597334677u^cell.y*3812015801u;
          seed^=seed>>16;seed*=2246822519u;
          return seed^(seed>>13);
        }
        vec3 arcadeBackdrop(){
          vec2 pixel=floor(gl_FragCoord.xy/3.0);
          uint seed=starHash(uvec2(floor(pixel/12.0)));
          vec2 point=vec2(float(seed&7u),float((seed>>3)&7u))+2.0;
          bool star=seed%5u==0u&&all(equal(mod(pixel,12.0),point));
          float haze=max(0.0,1.0-length((uv-vec2(.82,.72))*vec2(1.25,1.4)));
          vec3 sky=vec3(.0015,.002,.006)+haze*haze*haze*vec3(.003,.0005,.005);
          // Static cabinet-art geometry: offset zigzags and broad orbital bands.
          // The depth gate below keeps every mark behind the real table.
          float zig=abs(fract(uv.y*2.4+.16)*2.0-1.0);
          float ribbon=1.0-smoothstep(.018,.026,abs(uv.x-(.035+zig*.18)));
          float orbit=length((uv-vec2(1.13,.48))*vec2(1.0,1.4));
          float bands=1.0-smoothstep(.025,.033,abs(fract(orbit*4.5)-.5));
          sky=mix(sky,vec3(.025,.003,.035),ribbon*.85);
          sky=mix(sky,vec3(.003,.018,.032),bands*.75);
          vec3 ink=seed%3u==0u?vec3(.12,.025,.075):vec3(.035,.105,.14);
          return sky+(star?ink*(.5+float((seed>>6)&3u)*.2):vec3(0));
        }
        void main(){
          color=texture(sourceColor,uv);
          gl_FragDepth=texture(sourceDepth,uv).r;
          // Only untouched far-depth pixels are backdrop. Never key on color:
          // the playfield, chrome, lights and ball may use the same blue tones.
          if(gl_FragDepth>=1.0)color=vec4(arcadeBackdrop(),1.0);
        }`],
    ]){
      const shader=gl.createShader(type);shaders.push(shader);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  }catch(error){gl.deleteProgram(program);throw Error(`Could not prepare the renderer: ${error.message}`);}
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
      onRendered?.();
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
