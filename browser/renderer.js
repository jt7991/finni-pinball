// vpinball-wasm 0.3.4 ships GLSL ES shaders with highp floats but implicit lowp
// texture samplers. Float/depth texture reads retain the SAMPLER's precision,
// so assigning their results to highp floats cannot recover the lost bits.
// Mobile GPUs can quantize depth and clamp HDR samples that desktop GPUs keep.
// See https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
// and GLSL ES 3.00 section 8 (texture lookup precision).
const helpersPath='/shaders-10.8.1/Helpers.fxh';
const marker='// Finni: preserve depth and HDR texture precision';
const samplerPrecision=`${marker}
        precision highp sampler2D;
        precision highp samplerCube;
        precision highp sampler2DArray;`;
const patchedContexts=new WeakSet();

export function preserveLightAlpha(gl){
  if(!gl||patchedContexts.has(gl))return;
  patchedContexts.add(gl);
  const blend=gl.blendFunc;
  gl.blendFunc=function(source,destination){
    if(source===this.SRC_ALPHA&&destination===this.ONE_MINUS_SRC_COLOR){
      // VPX bulb/flashers encode additive strength as alpha up to 9999.
      // Applying that blend to alpha as well as RGB overflows an RGBA16F
      // target (9999 squared), producing white light polygons on Android.
      // Preserve destination alpha under reverse-subtract; RGB is unchanged.
      return this.blendFuncSeparate(source,destination,this.ZERO,this.ONE);
    }
    return blend.call(this,source,destination);
  };
}

// Install before native main() reads its settings, not after the table starts.
// Retina phone screens otherwise get desktop-sized render targets and passes.
export function configureRenderer(engine,{mobile=false,quality='auto'}={}){
  const performance=quality==='performance'||quality==='auto'&&mobile;
  const viewport=engine.canvas?.parentElement;
  const width=viewport?.clientWidth,height=viewport?.clientHeight;
  if(performance&&width>0&&height>0){
    // Budget the final buffer too: AAFactor alone leaves post-processing and
    // browser composition at the phone's full, often 3x, device-pixel ratio.
    const density=Math.min(globalThis.devicePixelRatio||1,1.5,720/width);
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
    if(descriptor?.configurable!==false)engine.finniRenderDensity=density;
  }
  const directory='/libsdl/VPinballX/10.8';
  engine.FS.mkdirTree(directory);
  engine.FS.writeFile(`${directory}/VPinballX.ini`,[
    '[Player]',
    'BallTrail=0',
    'ForceMotionBlurOff=1',
    ...(performance?[
    `AAFactor=${engine.finniRenderDensity?1:0.5}`,
    'MaxTexDimension=2048',
    'DisableAO=1',
    'DynamicAO=0',
    'PFReflection=0',
    'SSRefl=0',
    'ForceBloomOff=1',
    ]:[]),
    '',
  ].join('\n'));
}

export function startTable(engine,path){
  const density=engine.finniRenderDensity;
  const original=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
  const canvas=engine.canvas;
  const contextDescriptor=canvas&&Object.getOwnPropertyDescriptor(canvas,'getContext');
  const getContext=canvas?.getContext;
  if(getContext)canvas.getContext=function(type,...args){
    const gl=getContext.call(this,type,...args);
    if(type==='webgl2')preserveLightAlpha(gl);
    return gl;
  };
  let capped=false;
  try{
    if(density&&density<globalThis.devicePixelRatio&&original?.configurable!==false){
      // SDL's browser backend takes its physical window size from the device
      // ratio, ignoring the native window-size preferences. Only its synchronous
      // startup sees this budget; restore the browser's real ratio immediately.
      Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,enumerable:original?.enumerable??true,value:density});
      capped=true;
    }
    return engine.ccall('vpinball_wasm_start','number',['string'],[path]);
  }finally{
    if(getContext){
      if(contextDescriptor)Object.defineProperty(canvas,'getContext',contextDescriptor);
      else delete canvas.getContext;
    }
    if(capped){
      if(original)Object.defineProperty(globalThis,'devicePixelRatio',original);
      else delete globalThis.devicePixelRatio;
    }
  }
}

export function prepareRenderer(engine){
  // Patch the loaded engine's virtual filesystem, before vpinball_wasm_start
  // creates any shader programs. Keep downloaded engine files byte-for-byte.
  const source=engine.FS.readFile(helpersPath,{encoding:'utf8'});
  if(source.includes(marker))return;
  const anchor='precision highp float;';
  if(!source.includes('#ifdef SHADER_GLES30')||!source.includes(anchor)){
    throw Error('The browser renderer shader format changed. Update the renderer compatibility patch.');
  }
  engine.FS.writeFile(helpersPath,source.replace(anchor,`${anchor}\n        ${samplerPrecision}`));
}
