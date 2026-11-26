// Read-only frame observations. Scene/history inputs remain native outputs;
// no uniforms, physics, rendering commands or clock values are replaced.
export function installNativeWholeFrameObserver(options={}){
 const data=window.nativeWholeFrame={armed:!!options.fromInitialization,done:false,images:{},draws:[],clears:[],errors:[],priorErrors:[]},io=window.nativePostprocess.io;
 if(options.fromInitialization){
  const imageStart=options.imageFromFrame??1,frameLimit=options.pagedHistory?32768:8192;
  if(!Number.isInteger(options.frames)||options.frames<2||options.frames>frameLimit||!Number.isInteger(imageStart)||imageStart<1||imageStart>options.frames)throw Error('Capture exceeds the declared bounded history limit');
  if(options.imageWhen!==undefined){
   if(!['party-finale','party-finale-victory','next-round-completion'].includes(options.imageWhen)||options.imageFromFrame!==undefined||!Number.isInteger(options.imageFrames)||options.imageFrames<2||options.imageFrames>128||options.imageFrames>options.frames)throw Error('Invalid bounded physical-milestone image window');
  }else if(options.frames-imageStart+1>128)throw Error('Capture requires at most 128 image frames');
  data.frames=[];
  data.captureFrameCount=options.frames;data.imageFromFrame=options.imageWhen?null:imageStart;
 }
 if(options.tracePixel)data.tracePixel=options.tracePixel;
 const nextFrame=()=>{
   if(options.fromInitialization&&!busy&&data.done&&!data.errors.length&&data.frames.length<data.captureFrameCount){
    for(const key of ['frameIndex','tone','reflectedTransmissionObserved','reflectedTransmissionTexture'])delete data[key];
    Object.assign(data,{armed:true,done:false,images:{},draws:[],clears:[],errors:[],priorErrors:[]});
   }
 };
 let busy=false,capturedWarmFlasher=false;
 const hotBlurTargets=new WeakMap();
 const historyPrograms=new WeakMap(),postprocessProgramIds=new WeakMap();if(options.postprocessImages)data.postprocessPrograms=[];
 const location=(gl,program,name)=>gl.getUniformLocation(program,name);
 const uniform=(gl,program,name)=>{const loc=location(gl,program,name);if(loc===null)return null;const value=gl.getUniform(program,loc);return ArrayBuffer.isView(value)?Array.from(value):value;};
 const targetId=gl=>gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)?io.textureId(gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME)):null;
 const samplerId=(gl,program,name)=>{
  const unit=uniform(gl,program,name);if(unit===null)return null;
  const active=gl.getParameter(gl.ACTIVE_TEXTURE);try{gl.activeTexture(gl.TEXTURE0+unit);return io.textureId(gl.getParameter(gl.TEXTURE_BINDING_2D));}finally{gl.activeTexture(active);}
 };
 const capturesImages=()=>{
  if(options.imageWhen&&data.imageFromFrame===null){
   if(!window.nativeMissionCompletionController?.finale)return false;
   if(options.imageWhen==='party-finale-victory'&&window.nativeMissionCompletionController.finale.outcome!=='native-victory')return false;
   if(options.imageWhen==='next-round-completion'&&!(window.nativeMissionCompletionController.scenario.continueRound&&window.nativeMissionCompletionController.completed))return false;
   const first=window.nativeStartup.frameIndex(),last=first+options.imageFrames-1;
   if(last>options.frames)throw Error('Party-finale image window exceeds declared history limit');
   data.imageFromFrame=first;data.captureFrameCount=last;
  }
  return !options.fromInitialization||window.nativeStartup.frameIndex()>=data.imageFromFrame;
 };
 const image=(gl,key,id,depth=false)=>{if(!capturesImages()||id===null||data.images[key])return;data.images[key]=depth?io.readDepth(gl,id):io.readColor(gl,id);};
 const pixel=gl=>{const previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),values=new Float32Array(4);try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING));gl.readPixels(...data.tracePixel,1,1,gl.RGBA,gl.FLOAT,values);return Array.from(values);}finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);}};
 const base64=values=>{const bytes=new Uint8Array(values.buffer,values.byteOffset,values.byteLength);let result='';for(let i=0;i<bytes.length;i+=0x8000)result+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(result);};
 const geometry=(gl,args)=>{const [,count,type,offset]=args,stride=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(0,gl.VERTEX_ATTRIB_ARRAY_POINTER),buffer=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING);if(stride!==32||![gl.UNSIGNED_SHORT,gl.UNSIGNED_INT].includes(type))throw Error('Unexpected observed light geometry ABI');const indices=type===gl.UNSIGNED_SHORT?new Uint16Array(count):new Uint32Array(count);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);let min=Infinity,max=-Infinity;for(const index of indices){min=Math.min(min,index);max=Math.max(max,index);}const vertices=new Float32Array((max-min+1)*8);try{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.getBufferSubData(gl.ARRAY_BUFFER,pointer+min*stride,vertices);}finally{gl.bindBuffer(gl.ARRAY_BUFFER,previous);}return{vertices:vertices.length/8,indices:count,vertexBytes:base64(vertices),indexBytes:base64(Uint32Array.from(indices,index=>index-min))};};
 const before=(gl,method,args)=>{
  nextFrame();
  if(busy||!data.armed||data.done)return;
  busy=true;let observedRow;
  try{
   if(!options.imagesOnly)for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
   const program=gl.getParameter(gl.CURRENT_PROGRAM);let info=options.imagesOnly?historyPrograms.get(program):undefined;
   if(!info){const shaders=io.shadersFor(program),fragment=shaders?.find(shader=>shader.type===gl.FRAGMENT_SHADER)?.source;info={name:location(gl,program,'AO_scale_timeblur')!==null?'ambient_occlusion':fragment?.match(/\/\/ps_main_([^\s(]+)\(/)?.[1]??'geometry',ball:options.imagesOnly&&gl.getUniformBlockIndex(program,'ballMatrixBlock')!==gl.INVALID_INDEX};if(options.imagesOnly)historyPrograms.set(program,info);}
   const {name}=info;
   if(!capturesImages()&&!name.startsWith('fb_rhtonemap'))return;
   const warmColor=options.captureFlasherGeometry&&!capturedWarmFlasher&&name==='noLight'?uniform(gl,program,'staticColor_Alpha'):null;
   const auditColor=options.flasherAuditColor;
   const captureWarm=auditColor?warmColor?.every((value,i)=>value===(i===3?Math.fround(auditColor[i]/100):Math.fround(Math.fround(auditColor[i])*Math.fround(1/255)))):warmColor?.[3]===3.75&&warmColor[0]===.9215686917304993;
   const geometryFrame=options.geometryFrames?.includes(window.nativeStartup.frameIndex())||captureWarm;
   // The history capture needs postprocess inputs/outputs, not thousands of
   // static-prepass matrix readbacks. The existing detailed capture retains
   // its complete draw/matrix observations when imagesOnly is absent.
   const captureReflection=options.captureReflection&&!data.images.reflection&&(uniform(gl,program,'mirrorNormal_factor')?.[3]??0)>0;
   if(options.imagesOnly&&!geometryFrame&&!captureReflection&&name!=='ambient_occlusion'&&!['fb_blur_horiz19x19','fb_blur_vert19x19','fb_bloom','fb_blur_horiz39x39','fb_blur_vert39x39'].includes(name)&&!name.startsWith('fb_rhtonemap')){
    if(!data.images.previousHDR&&info.ball){for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);image(gl,'previousHDR',samplerId(gl,program,'tex_ball_playfield'));}
    return;
   }
   if(options.imagesOnly)for(let error;(error=gl.getError())!==gl.NO_ERROR;)data.priorErrors.push(error);
   const viewport=Array.from(gl.getParameter(gl.VIEWPORT)),target=targetId(gl);
   const row=observedRow={method,args,name,target,viewport,scissorEnabled:gl.isEnabled(gl.SCISSOR_TEST),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX))};
   if(options.imagesOnly)row.uniforms=Object.fromEntries(['w_h_height','exposure_wcg','bloom_dither_colorgrade','AO_scale_timeblur'].map(key=>[key,uniform(gl,program,key)]).filter(([,value])=>value!==null));
   if(data.captureLightGeometry&&method==='drawElements'&&location(gl,program,'lightCenter_maxRange')!==null&&viewport[2]===gl.drawingBufferWidth&&viewport[3]===gl.drawingBufferHeight){row.lightGeometry=geometry(gl,args);row.lightCenter=uniform(gl,program,'lightCenter_maxRange');row.lightBlend=uniform(gl,program,'blend_modulate_vs_add');}
   if(geometryFrame&&name==='noLight'&&method==='drawElements'){row.flasherGeometry=geometry(gl,args);if(captureWarm){row.flasherTextureA=io.readColor(gl,samplerId(gl,program,'tex_flasher_A'));capturedWarmFlasher=true;}}
   if(data.tracePixel&&target!==null&&[gl.RGBA16F,gl.RGBA32F].includes(nativePostprocess.textures[target]?.internalFormat)&&viewport[2]===gl.drawingBufferWidth&&viewport[3]===gl.drawingBufferHeight)row.pixelBefore=pixel(gl);
   if(row.pixelBefore||row.lightGeometry){row.uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const active=gl.getActiveUniform(program,i),value=uniform(gl,program,active.name);if(value!==null)row.uniforms[active.name]=value;}row.blend={enabled:gl.isEnabled(gl.BLEND),src:gl.getParameter(gl.BLEND_SRC_RGB),dst:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),equation:gl.getParameter(gl.BLEND_EQUATION_RGB),equationAlpha:gl.getParameter(gl.BLEND_EQUATION_ALPHA),mask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK))};}
   if(location(gl,program,'tex_light_color')!==null)row.classicUniforms=Object.fromEntries(['lightColor_intensity','lightColor2_falloff_power','lightCenter_maxRange'].map(name=>[name,uniform(gl,program,name)]));
   const basic=gl.getUniformBlockIndex(program,'basicMatrixBlock'),ball=gl.getUniformBlockIndex(program,'ballMatrixBlock'),block=basic!==gl.INVALID_INDEX?basic:ball;
   if(block!==gl.INVALID_INDEX&&(!options.imagesOnly||geometryFrame||!data.images.reflection||!data.images.previousHDR||!data.images.transmission)){
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
   if(options.postprocessImages&&['fb_bloom','fb_blur_horiz39x39','fb_blur_vert39x39'].includes(name)){
    const unit=uniform(gl,program,'tex_fb_filtered'),active=gl.getParameter(gl.ACTIVE_TEXTURE),prior=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    try{
     gl.activeTexture(gl.TEXTURE0+unit);const sampler=gl.getParameter(gl.SAMPLER_BINDING),parameters={};for(const key of [gl.TEXTURE_MAG_FILTER,gl.TEXTURE_MIN_FILTER,gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_MIN_LOD,gl.TEXTURE_MAX_LOD,gl.TEXTURE_COMPARE_MODE,gl.TEXTURE_COMPARE_FUNC])parameters[key]=sampler?gl.getSamplerParameter(sampler,key):gl.getTexParameter(gl.TEXTURE_2D,key);
     const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)parameters[anisotropy.TEXTURE_MAX_ANISOTROPY_EXT]=sampler?gl.getSamplerParameter(sampler,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT):gl.getTexParameter(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT);
     const buffer=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),stride=gl.getVertexAttrib(0,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(0,gl.VERTEX_ATTRIB_ARRAY_POINTER);if(stride!==20)throw Error('Unexpected bloom vertex layout');const vertices=new Float32Array(20);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);row.vertexObservation={pointer,stride,bufferBytes:gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE),requestedBytes:vertices.byteLength};if(pointer+vertices.byteLength>row.vertexObservation.bufferBytes)throw Error('Observed fullscreen vertex read exceeds native buffer bounds');gl.getBufferSubData(gl.ARRAY_BUFFER,pointer,vertices);const vertexError=gl.getError();if(vertexError)throw Error('Fullscreen vertex observation GL error '+vertexError);
     const id=samplerId(gl,program,'tex_fb_filtered');row.bloomState={unit,id,texture:nativePostprocess.textures[id],parameters,vertices:Array.from(vertices),blend:gl.isEnabled(gl.BLEND),depth:gl.isEnabled(gl.DEPTH_TEST),dither:gl.isEnabled(gl.DITHER),colorMask:Array.from(gl.getParameter(gl.COLOR_WRITEMASK))};
     if(!postprocessProgramIds.has(program)){postprocessProgramIds.set(program,data.postprocessPrograms.length);data.postprocessPrograms.push({name,shaders:io.shadersFor(program)});}row.bloomState.program=postprocessProgramIds.get(program);
     row.bloomState.uniforms={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i);row.bloomState.uniforms[info.name]=uniform(gl,program,info.name);}
     row.bloomState.attributes={};for(const name of ['vPosition','tc']){
      const index=gl.getAttribLocation(program,name);if(index<0){row.bloomState.attributes[name]={index,active:false};continue;}const enabled=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_ENABLED),size=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_SIZE),type=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_TYPE),stride=gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_STRIDE),pointer=gl.getVertexAttribOffset(index,gl.VERTEX_ATTRIB_ARRAY_POINTER),entry={index,enabled,size,type,stride,pointer,normalized:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),integer:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_INTEGER),divisor:gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_DIVISOR)};row.bloomState.attributes[name]=entry;
      if(enabled){if(type!==gl.FLOAT)throw Error('Unsupported observed fullscreen attribute type');const step=(stride||size*4)/4,values=new Float32Array(step*3+size);gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(index,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));entry.bufferBytes=gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE);entry.requestedBytes=values.byteLength;if(pointer+values.byteLength>entry.bufferBytes)throw Error('Observed fullscreen attribute exceeds buffer bounds: '+name);gl.getBufferSubData(gl.ARRAY_BUFFER,pointer,values);entry.values=Array.from({length:4},(_,i)=>Array.from(values.subarray(i*step,i*step+size)));}else entry.current=Array.from(gl.getVertexAttrib(index,gl.CURRENT_VERTEX_ATTRIB));const error=gl.getError();if(error)throw Error('Fullscreen attribute observation GL error '+error+' '+name);
     }
     row.bloomState.textureLevels=Object.fromEntries([gl.TEXTURE_BASE_LEVEL,gl.TEXTURE_MAX_LEVEL,gl.TEXTURE_IMMUTABLE_FORMAT,gl.TEXTURE_IMMUTABLE_LEVELS].map(key=>[key,gl.getTexParameter(gl.TEXTURE_2D,key)]));
     image(gl,({fb_bloom:'bloomHDR',fb_blur_horiz39x39:'bloomHorizontalInput',fb_blur_vert39x39:'bloomVerticalInput'})[name],id);
    }finally{gl.activeTexture(active);gl.bindBuffer(gl.ARRAY_BUFFER,prior);}
   }
   if(name==='ambient_occlusion'){
    image(gl,'depth',samplerId(gl,program,'tex_depth'),true);
    image(gl,'priorAO',samplerId(gl,program,'tex_fb_filtered'));
   }
   if(name.startsWith('fb_rhtonemap')){
    if(options.imagesOnly)image(gl,'ao',samplerId(gl,program,'tex_ao'));
    image(gl,'hdr',samplerId(gl,program,'tex_fb_unfiltered')??samplerId(gl,program,'tex_fb_filtered'));
    image(gl,'bloom',samplerId(gl,program,'tex_bloom'));
    image(gl,'depth',samplerId(gl,program,'tex_depth'),true);
    if(options.fromInitialization)data.frameIndex=window.nativeStartup.frameIndex();
    else{window.finni.evaluate('Debug.Print "WHOLE_FRAME_INDEX|" & FrameIndex');
    data.frameIndex=Number(Array.from(document.getElementById('log').textContent.matchAll(/WHOLE_FRAME_INDEX\|(\d+)/g)).at(-1)[1]);}
    data.tone={name,w_h_height:uniform(gl,program,'w_h_height'),viewport,target};row.finalTone=true;
   }
   if(!options.imagesOnly||geometryFrame||name!=='geometry')data.draws.push(row);
   return row;
  }catch(error){data.failureContext={frameIndex:window.nativeStartup?.frameIndex(),row:observedRow};data.errors.push(error.message);data.done=true;}finally{busy=false;}
 };
 const p=WebGL2RenderingContext.prototype;
 const postImages={fb_bloom:'bloomCut',fb_blur_horiz39x39:'bloomHorizontal',fb_blur_vert39x39:'bloomVertical'};
 // Explicit component mode only: repeat the unchanged native blur on owned
 // output storage, first sampling its live input, then an uploaded readback.
 // Normal captures never enter this path. Nothing yields while GL is borrowed.
 const hotBlurComponent=(gl,row,args,draw)=>{
  if(!options.hotBlurComponent||row.name!=='fb_blur_horiz39x39'||!capturesImages())return;
  busy=true;const before=window.nativeStartup.read(),firstFrame=window.nativeStartup.frameIndex(),active=gl.getParameter(gl.ACTIVE_TEXTURE),drawFBO=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),readFBO=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),program=gl.getParameter(gl.CURRENT_PROGRAM),unit=row.bloomState.unit;gl.activeTexture(gl.TEXTURE0+unit);const source=gl.getParameter(gl.TEXTURE_BINDING_2D);
  try{
   const width=row.viewport[2],height=row.viewport[3];let owned=hotBlurTargets.get(gl);
   if(!owned){
    owned={target:gl.createTexture(),copy:gl.createTexture(),fbo:gl.createFramebuffer(),width,height,original:program,clone:gl.createProgram()};hotBlurTargets.set(gl,owned);
    for(const spec of io.shadersFor(program)){const shader=gl.createShader(spec.type);gl.shaderSource(shader,spec.source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(owned.clone,shader);gl.deleteShader(shader);}gl.linkProgram(owned.clone);if(!gl.getProgramParameter(owned.clone,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(owned.clone));
    for(const texture of[owned.target,owned.copy]){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_BASE_LEVEL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);}
   }
   if(owned.width!==width||owned.height!==height||owned.original!==program)throw Error('Hot blur component requires a fixed declared window size and program');
   gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,owned.fbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,owned.target,0);if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Hot blur component output incomplete');
   gl.bindTexture(gl.TEXTURE_2D,source);draw.apply(gl,args);const outputId=io.textureId(owned.target);image(gl,'hotBlur',outputId);
   const sampled=io.readColor(gl,row.bloomState.id,false,false),values=Uint8Array.from(atob(sampled.bytes),c=>c.charCodeAt(0));data.images.sampledCut=sampled;
   gl.bindTexture(gl.TEXTURE_2D,owned.copy);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.FLOAT,new Float32Array(values.buffer));image(gl,'uploadedCut',io.textureId(owned.copy));draw.apply(gl,args);image(gl,'copiedBlur',outputId);
   gl.bindTexture(gl.TEXTURE_2D,source);const uniforms=row.bloomState.uniforms;gl.useProgram(owned.clone);gl.uniform4fv(gl.getUniformLocation(owned.clone,'w_h_height'),uniforms.w_h_height);gl.uniform1i(gl.getUniformLocation(owned.clone,'layer'),uniforms.layer);gl.uniform1i(gl.getUniformLocation(owned.clone,'tex_fb_filtered'),unit);draw.apply(gl,args);image(gl,'clonedBlur',outputId);
   const error=gl.getError(),after=window.nativeStartup.read();row.hotBlurComponent={firstFrame,lastFrame:window.nativeStartup.frameIndex(),beforeMilliseconds:before.ms,afterMilliseconds:after.ms,randomUnchanged:JSON.stringify(before.random)===JSON.stringify(after.random),bodiesUnchanged:JSON.stringify(before.balls)===JSON.stringify(after.balls),glError:error};if(error||row.hotBlurComponent.firstFrame!==row.hotBlurComponent.lastFrame||before.ms!==after.ms||!row.hotBlurComponent.randomUnchanged||!row.hotBlurComponent.bodiesUnchanged)throw Error('Native state advanced or GL failed during synchronous component work');
  }catch(error){data.errors.push(String(error));}
  finally{gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,source);gl.activeTexture(active);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,drawFBO);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,readFBO);busy=false;}
 };
 const clear=p.clear;p.clear=function(mask){nextFrame();if(data.armed&&!data.done&&!busy)data.clears.push({target:targetId(this),mask,color:Array.from(this.getParameter(this.COLOR_CLEAR_VALUE)),depth:this.getParameter(this.DEPTH_CLEAR_VALUE),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});return clear.call(this,mask);};
 for(const method of ['clearBufferfv','clearBufferiv','clearBufferuiv','clearBufferfi']){
  const original=p[method];p[method]=function(...args){
   nextFrame();
   if(data.armed&&!data.done&&!busy){busy=true;try{
    const target=targetId(this);data.clears.push({method,target,args:args.map(value=>ArrayBuffer.isView(value)?Array.from(value):value),scissorEnabled:this.isEnabled(this.SCISSOR_TEST),scissor:Array.from(this.getParameter(this.SCISSOR_BOX))});
    if(!options.imagesOnly&&args[0]===this.COLOR)image(this,'priorClear'+target,target);
   }catch(error){data.errors.push(error.message);}finally{busy=false;}}
   return original.apply(this,args);
  };
 }
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const raw=p[method];p[method]=function(...args){const row=before(this,method,args),result=raw.apply(this,args);if(row&&postImages[row.name]&&(options.postprocessImages||options.postprocessFrames?.includes(window.nativeStartup.frameIndex()))){busy=true;try{image(this,postImages[row.name],row.target);}catch(error){data.errors.push(error.message);}finally{busy=false;}}if(row)hotBlurComponent(this,row,args,raw);if(row?.pixelBefore){busy=true;try{row.pixelAfter=pixel(this);}catch(error){data.errors.push(error.message);}finally{busy=false;}}if(row?.finalTone){busy=true;try{window.nativeSceneClock?.noteTonemap?.(data.frameIndex);if(capturesImages())data.images.final=io.readColor(this,row.target);data.done=true;data.armed=false;if(options.fromInitialization){
   data.frames.push({images:data.images,draws:data.draws,clears:data.clears,errors:data.errors,priorErrors:data.priorErrors,frameIndex:data.frameIndex,tone:data.tone,playing:document.body.classList.contains('playing'),snapshot:window.nativeStartup.read(),...options.mechanismSpecs?{mechanismPoses:window.nativeMechanismPoses.snapshot(options.mechanismSpecs)}:{},canvas:{width:this.drawingBufferWidth,height:this.drawingBufferHeight,attributes:this.getContextAttributes()}});
   if(options.freezeObserversAfterCapture&&data.frames.length===data.captureFrameCount){window.nativeStartup.done=true;window.nativeSceneClock.armed=false;window.nativeTimerDispatch.armed=false;window.nativeBallPresentation.armed=false;}
  }}catch(error){data.errors.push(error.message);}finally{busy=false;}}return result;};
 }
}
