// Integration check: actual VPX/WASM, shipped shaders, animated meshes and input.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await (await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map();
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(Error(data.error.message)):resolve(data.result);}
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(expression,attempts=150)=>{
  for(let i=0;i<attempts;i++){if(await evaluate(expression))return;await delay(50);}
  throw Error(`Timed out: ${expression}`);
};
const capture=async name=>writeFile(`${output}/${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
async function geometry(){
  await evaluate(`finni.evaluate('Debug.Print "RENDERTEST|" & LeftFlipper.CurrentAngle & "|" & RightFlipper.CurrentAngle & "|" & LeftFlipperTop.RotZ & "|" & RightFlipperTop.RotZ & "|" & discoball.RotZ')`);
  return evaluate(`document.getElementById('log').textContent.match(/RENDERTEST\\|([^'\\r\\n]+)/g).at(-1).split('|').slice(1).map(Number)`);
}
await call('Page.enable');
await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.shaderTest={sources:[],errors:[],programs:0,lightBlends:0};
  window.playFullscreenRequests=[];
  const requestFullscreen=Element.prototype.requestFullscreen;
  Element.prototype.requestFullscreen=function(...args){
    playFullscreenRequests.push({active:navigator.userActivation.isActive,playing:document.body.classList.contains('playing')});
    return requestFullscreen.apply(this,args);
  };
  const proto=WebGL2RenderingContext.prototype;
  const source=proto.shaderSource,compile=proto.compileShader,link=proto.linkProgram,blend=proto.blendFuncSeparate;
  proto.blendFuncSeparate=function(s,d,a,b){if(this.canvas===document.getElementById('canvas')&&s===this.SRC_ALPHA&&d===this.ONE_MINUS_SRC_COLOR&&a===this.ZERO&&b===this.ONE)shaderTest.lightBlends++;return blend.call(this,s,d,a,b)};
  proto.shaderSource=function(shader,text){shaderTest.sources.push(text);return source.call(this,shader,text);};
  proto.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))shaderTest.errors.push(this.getShaderInfoLog(shader));};
  proto.linkProgram=function(program){link.call(this,program);shaderTest.programs++;if(!this.getProgramParameter(program,this.LINK_STATUS))shaderTest.errors.push(this.getProgramInfoLog(program));};
`});
try{
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.navigate',{url:base});
  await wait('!!window.finni && !document.getElementById("play").disabled',1200);
  const blended=await evaluate(`(async()=>{
    const {preserveLightAlpha}=await import('/renderer.js');
    const gl=document.createElement('canvas').getContext('webgl2');
    try{
      gl.getExtension('EXT_color_buffer_float');
      preserveLightAlpha(gl);preserveLightAlpha(gl);
      const program=gl.createProgram();
      for(const [type,source] of [
        [gl.VERTEX_SHADER,'#version 300 es\\nvoid main(){gl_Position=vec4(float((gl_VertexID<<1)&2)*2.-1.,float(gl_VertexID&2)*2.-1.,0,1);}'],
        [gl.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;out vec4 color;void main(){color=vec4(-.00001,-.00002,-.00003,9999.);}'],
      ]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader)}
      gl.linkProgram(program);gl.useProgram(program);
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA16F,1,1);
      const target=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      gl.viewport(0,0,1,1);gl.clearColor(.2,.3,.4,1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_COLOR);gl.drawArrays(gl.TRIANGLES,0,3);
      const pixel=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,pixel);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      return {pixel:Array.from(pixel),normalAlpha:[gl.getParameter(gl.BLEND_SRC_ALPHA),gl.getParameter(gl.BLEND_DST_ALPHA)],error:gl.getError()};
    }finally{gl.getExtension('WEBGL_lose_context').loseContext()}
  })()`);
  for(const [index,expected] of [.3,.5,.7,1].entries())assert.ok(Number.isFinite(blended.pixel[index])&&Math.abs(blended.pixel[index]-expected)<.003,'HDR bulb RGB stays unchanged and alpha stays finite');
  assert.deepEqual(blended.normalAlpha,[770,771],'Ordinary transparency retains native blending');
  assert.equal(blended.error,0,'HDR blending is valid WebGL');
  const copyTest=(await readFile(new URL('./check-framebuffer-copy.js',import.meta.url),'utf8')).replace('export async function','async function');
  assert.equal(await evaluate(`(async()=>{${copyTest};return checkFramebufferCopy()})()`),true,'Real GPU copies HDR color and depth and restores engine state');
  const prepared=await evaluate(`finni.engine.FS.readFile('/shaders-10.8.1/Helpers.fxh',{encoding:'utf8'})`);
  for(const sampler of ['sampler2D','samplerCube','sampler2DArray'])assert.ok(prepared.includes(`precision highp ${sampler};`));
  await capture('ready');
  // Reapplying the compatibility patch is safe; unknown shader layouts fail clearly.
  assert.equal(await evaluate(`(async()=>{const {prepareRenderer}=await import('/renderer.js');prepareRenderer(finni.engine);return finni.engine.FS.readFile('/shaders-10.8.1/Helpers.fxh',{encoding:'utf8'});})()`),prepared);
  const button=await evaluate(`(()=>{const r=document.getElementById('play').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...button,button:'left',clickCount:1});
  await wait('document.body.classList.contains("playing")');await delay(500);
  assert.deepEqual(await evaluate('playFullscreenRequests'),[{active:true,playing:false}],'Play requests fullscreen from the trusted click before starting the engine');
  await evaluate(`finni.evaluate('Debug.Print "BALL_TRAIL_CHECK|" & Table1.BallTrail')`);
  assert.ok(await evaluate(`document.getElementById('log').textContent.includes('BALL_TRAIL_CHECK|0')`),'Native table ball trail is disabled after loading legacy preferences');
  const ballMaterial=await evaluate(`new Promise(resolve=>{
    const p=WebGL2RenderingContext.prototype,draw=p.drawElements;let material=null;
    p.drawElements=function(...args){
      const program=this.getParameter(this.CURRENT_PROGRAM);
      if(!material&&this.getUniformLocation(program,'tex_ball_color'))material={
        unlit:this.getUniform(program,this.getUniformLocation(program,'w_h_disableLighting'))[2],
        alpha:this.getUniform(program,this.getUniformLocation(program,'cBase_Alpha'))[3],
        blending:this.isEnabled(this.BLEND),
      };
      return draw.apply(this,args);
    };
    setTimeout(()=>{p.drawElements=draw;resolve(material)},200);
  })`);
  assert.deepEqual(ballMaterial,{unlit:1,alpha:1,blending:false},'Real ball draws use opaque chrome without playfield transmission or excessive table lighting');
  await evaluate(`finni.evaluate('Debug.Print "BALL_DECAL_CHECK|" & Table1.BallFrontDecal')`);
  assert.ok(await evaluate(`document.getElementById('log').textContent.includes("BALL_DECAL_CHECK|'")`),'No scratch overlay on new game balls');
  assert.equal(await evaluate(`finni.engine.FS.analyzePath('/tables/finni.vpx').exists`),false,'Packed table upload released after startup');
  const shaders=await evaluate('shaderTest');
  assert.ok(shaders.lightBlends>0,'Real VPX light passes preserve HDR target alpha');
  assert.deepEqual(shaders.errors,[],'Real shader compile/link errors');
  assert.ok(shaders.programs>20,'Real VPX shader programs linked');
  const sampled=shaders.sources.filter(s=>/uniform\s+(?:sampler2D|samplerStereo)\s+tex_(?:depth|probe_depth|env|fb_)/.test(s));
  assert.ok(sampled.length>10,'Depth, framebuffer and environment programs exercised');
  for(const source of sampled)assert.ok(source.includes('precision highp sampler2D;'),'Sampler precision reaches compiled shader source');
  assert.equal(await evaluate('document.getElementById("camera-view").value'),'balanced');
  const resting=await geometry();await capture('balanced-rest');
  await evaluate(`finni.evaluate('DiscoTimer.Enabled=True:Table1_KeyDown LeftFlipperKey:Table1_KeyDown RightFlipperKey')`);
  await delay(300);
  const held=await geometry();
  assert.ok(Math.abs(held[0]-resting[0])>20&&Math.abs(held[1]-resting[1])>20,'Both physical flippers move');
  assert.ok(Math.abs(held[0]-held[2])<.1&&Math.abs(held[1]-held[3])<.1,'Flipper cap animation stays synchronized');
  for(let i=0;i<4;i++){await delay(120);await capture(`balanced-motion-${i}`);}
  const rotated=await geometry();assert.notEqual(rotated[4],held[4],'Disco-ball mesh is actually animating');
  await evaluate(`finni.evaluate('Table1_KeyUp LeftFlipperKey:Table1_KeyUp RightFlipperKey')`);await delay(300);
  const released=await geometry();
  assert.ok(Math.abs(released[0]-resting[0])<.1&&Math.abs(released[1]-resting[1])<.1,'Both flippers return');
  await evaluate(`document.getElementById('camera-view').value='topdown';document.getElementById('camera-view').dispatchEvent(new Event('change'))`);await delay(400);
  await capture('topdown-motion');
  await evaluate(`document.getElementById('camera-view').value='balanced';document.getElementById('camera-view').dispatchEvent(new Event('change'))`);
  await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});await delay(500);
  await capture('landscape-motion');
  assert.deepEqual(await evaluate('shaderTest.errors'),[],'Camera changes keep shader programs valid');
  // Simulate the final drain's ball-count bookkeeping, then end through the
  // native subroutine. This checks replay, not a full three-ball physics run.
  await evaluate(`window.replayEngine=finni.engine;finni.evaluate('BallsOnPlayfield=0:EndOfGame')`);
  await wait('!document.getElementById("waiting").hidden && document.getElementById("play").textContent==="Play again"');
  await wait(`(()=>{finni.evaluate('Debug.Print "REPLAY_BACKGROUND|" & Digits(40).ImageA');return document.getElementById('log').textContent.includes('REPLAY_BACKGROUND|d_gameover')})()`);
  await wait(`document.getElementById('dmd').getContext('2d').getImageData(0,0,1024,256).data.some((value,index)=>index%4!==3&&value>96)`);
  await capture('replay');
  const replayButton=await evaluate(`(()=>{const r=document.getElementById('play').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const replayFullscreen=await evaluate('({active:!!document.fullscreenElement,requests:playFullscreenRequests.length})');
  for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...replayButton,button:'left',clickCount:1});
  await wait('document.body.classList.contains("game-in-play") && document.getElementById("waiting").hidden');
  assert.equal(await evaluate('playFullscreenRequests.length'),replayFullscreen.requests+(replayFullscreen.active?0:1),'Replay requests fullscreen only if it is not already active');
  assert.equal(await evaluate('replayEngine===finni.engine'),true,'Replay reuses the loaded native player');
  assert.equal(await evaluate(`finni.engine.FS.analyzePath('/tables/finni.vpx').exists`),false,'Replay does not need the packed table upload');
  console.log(`PASS: actual VPX engine; ${shaders.programs} shader programs; high-precision depth/HDR samplers; both flippers and caps animate/release; disco ball rotates; portrait, landscape and camera changes; native game-over/replay after upload cleanup. Desktop Chromium GPU, not physical Android certification.`);
}finally{socket.close();}
