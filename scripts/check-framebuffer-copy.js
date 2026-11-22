// Runs on a real WebGL2 context in the browser integration check.
export async function checkFramebufferCopy(){
  const {installFramebufferCopy}=await import('/framebuffer-copy.js');
  const gl=document.createElement('canvas').getContext('webgl2');
  try{
    gl.getExtension('EXT_color_buffer_float');
    const target=()=>{
      const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
      for(const [attachment,format] of [[gl.COLOR_ATTACHMENT0,gl.RGBA16F],[gl.DEPTH_ATTACHMENT,gl.DEPTH_COMPONENT16]]){
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texStorage2D(gl.TEXTURE_2D,1,format,2,2);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,attachment,gl.TEXTURE_2D,texture,0);
      }
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete test target');
      return fbo;
    };
    const source=target(),destination=target();
    gl.bindFramebuffer(gl.FRAMEBUFFER,source);gl.clearColor(2,.5,.25,1);gl.clearDepth(.25);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER,destination);gl.clearColor(0,0,0,0);gl.clearDepth(.9);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const program=gl.createProgram();
    for(const [type,text] of [
      [gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}'],
      [gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0,1,0,1);}'],
    ]){
      const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);gl.useProgram(program);
    const vao=gl.createVertexArray(),sampler=gl.createSampler();gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE3);gl.bindSampler(0,sampler);
    gl.enable(gl.BLEND);gl.enable(gl.SCISSOR_TEST);gl.scissor(1,1,1,1);
    gl.depthMask(false);gl.colorMask(false,true,false,true);gl.viewport(1,1,1,1);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,source);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,destination);
    const state=()=>[gl.getParameter(gl.CURRENT_PROGRAM),gl.getParameter(gl.VERTEX_ARRAY_BINDING),
      gl.getParameter(gl.ACTIVE_TEXTURE),...gl.getParameter(gl.VIEWPORT),...gl.getParameter(gl.COLOR_WRITEMASK),
      gl.getParameter(gl.DEPTH_WRITEMASK),gl.isEnabled(gl.BLEND),gl.isEnabled(gl.SCISSOR_TEST),gl.getParameter(gl.SAMPLER_BINDING)];
    const before=state();installFramebufferCopy(gl);const copy=gl.blitFramebuffer;installFramebufferCopy(gl);
    if(copy!==gl.blitFramebuffer)throw Error('Repeated installation changed the copy');
    gl.blitFramebuffer(0,0,2,2,0,0,2,2,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
    if(state().some((value,index)=>value!==before[index]))throw Error('Copy changed engine GL state');
    gl.activeTexture(gl.TEXTURE0);if(gl.getParameter(gl.SAMPLER_BINDING)!==sampler)throw Error('Sampler binding was not restored');
    gl.bindFramebuffer(gl.FRAMEBUFFER,destination);
    gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.viewport(0,0,2,2);
    // z=.5 must fail against the copied .25 depth; a missing depth copy paints green.
    gl.drawArrays(gl.TRIANGLES,0,3);
    const pixels=new Float32Array(16);gl.readPixels(0,0,2,2,gl.RGBA,gl.FLOAT,pixels);
    if(pixels.some((value,index)=>Math.abs(value-[2,.5,.25,1][index%4])>.002))throw Error('HDR color or depth was not copied across the complete target');
    // Empty far-depth pixels receive the backdrop, while the colored geometry
    // above remains byte-equivalent within the HDR target's precision.
    gl.bindFramebuffer(gl.FRAMEBUFFER,source);gl.clearDepth(1);gl.clearColor(.2,.3,.5,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,source);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,destination);
    gl.blitFramebuffer(0,0,2,2,0,0,2,2,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,destination);
    gl.readPixels(0,0,2,2,gl.RGBA,gl.FLOAT,pixels);
    if(pixels.some((value,index)=>!Number.isFinite(value)||(index%4===3?Math.abs(value-1)>.002:value<0||value>.05)))throw Error('Empty depth did not receive the finite dark arcade backdrop');
    if(gl.getError()!==gl.NO_ERROR)throw Error('Invalid WebGL copy');
    return true;
  }finally{gl.getExtension('WEBGL_lose_context').loseContext();}
}
