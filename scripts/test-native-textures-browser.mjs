// Validate the encoded-image production loader by reading every uploaded GPU
// texel, including transparent RGB, against the native RGBA upload digest.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const directory=process.argv.find(a=>a.startsWith('--asset-directory='))?.slice(18)??'.work/native-world-renderer-lossless',metadataFile=process.argv.find(a=>a.startsWith('--metadata='))?.slice(11)??'native-world.json',assetsURL='/three/@fs/'+path.resolve(directory).replaceAll('\\','/')+'/',
  [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:base});
  for(let i=0;i<600;i++){if(await evaluate('!!window.finniThree'))break;await new Promise(r=>setTimeout(r,50));}
  const result=await evaluate(`(async()=>{
    const {game,view}=finniThree;game.setPaused(true);await game.flush();const {loadNativePrimitiveVisuals,createNativeBaseTexture}=await import('/three/native-basic-render.js'),assets=await loadNativePrimitiveVisuals(${JSON.stringify(assetsURL)},${JSON.stringify(metadataFile)}),renderer=view.renderer,gl=renderer.getContext(),result={textures:[],bytes:0,glErrors:[]};
    for(const [id,spec]of Object.entries(assets.metadata.textures)){
      const binding=assets.metadata.parts.flatMap(p=>Object.values(p.textures)).find(t=>String(t?.id)===id);if(!binding)throw Error('Native texture has no source draw '+id);
      const texture=createNativeBaseTexture(assets,id,binding.sampler);renderer.initTexture(texture);const fbo=gl.createFramebuffer(),previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),pixels=new Uint8Array(spec.width*spec.height*4);
      try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,renderer.properties.get(texture).__webglTexture,0);if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Native image readback incomplete '+id);gl.readPixels(0,0,spec.width,spec.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const error=gl.getError();if(error)result.glErrors.push({id,error});}
      finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);gl.deleteFramebuffer(fbo);texture.dispose();}
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),v=>v.toString(16).padStart(2,'0')).join(''),expected=spec.levels[0].sourceSHA256??spec.levels[0].sha256;
      result.textures.push({id,width:spec.width,height:spec.height,bytes:pixels.length,sha256:digest,expected,equal:digest===expected});result.bytes+=pixels.length;
    }assets.dispose();return result;
  })()`);
  const report=path.basename(directory)+'-gpu-texels.json';fs.writeFileSync(output+'/'+report,JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));assert.deepEqual(errors,[]);assert.deepEqual(result.glErrors,[]);assert.ok(result.textures.length>0);assert.ok(result.textures.every(t=>t.equal),'Every native RGBA byte survives encoded-image decode and GPU upload');
}finally{socket.close();}
