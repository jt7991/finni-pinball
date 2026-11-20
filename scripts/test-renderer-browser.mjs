// Integration check: actual VPX/WASM, shipped shaders, animated meshes and input.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
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
  window.shaderTest={sources:[],errors:[],programs:0};
  const proto=WebGL2RenderingContext.prototype;
  const source=proto.shaderSource,compile=proto.compileShader,link=proto.linkProgram;
  proto.shaderSource=function(shader,text){shaderTest.sources.push(text);return source.call(this,shader,text);};
  proto.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))shaderTest.errors.push(this.getShaderInfoLog(shader));};
  proto.linkProgram=function(program){link.call(this,program);shaderTest.programs++;if(!this.getProgramParameter(program,this.LINK_STATUS))shaderTest.errors.push(this.getProgramInfoLog(program));};
`});
try{
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.navigate',{url:base});
  await wait('!!window.finni && !document.getElementById("play").disabled',1200);
  const prepared=await evaluate(`finni.engine.FS.readFile('/shaders-10.8.1/Helpers.fxh',{encoding:'utf8'})`);
  for(const sampler of ['sampler2D','samplerCube','sampler2DArray'])assert.ok(prepared.includes(`precision highp ${sampler};`));
  // Reapplying the compatibility patch is safe; unknown shader layouts fail clearly.
  assert.equal(await evaluate(`(async()=>{const {prepareRenderer}=await import('/renderer.js');prepareRenderer(finni.engine);return finni.engine.FS.readFile('/shaders-10.8.1/Helpers.fxh',{encoding:'utf8'});})()`),prepared);
  const button=await evaluate(`(()=>{const r=document.getElementById('play').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...button,button:'left',clickCount:1});
  await wait('document.body.classList.contains("playing")');await delay(500);
  const shaders=await evaluate('shaderTest');
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
  console.log(`PASS: actual VPX engine; ${shaders.programs} shader programs; high-precision depth/HDR samplers; both flippers and caps animate/release; disco ball rotates; portrait, landscape and camera changes. Desktop Chromium GPU, not physical Android certification.`);
}finally{socket.close();}
