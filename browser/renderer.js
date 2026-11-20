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

// Install before native main() reads its settings, not after the table starts.
// Retina phone screens otherwise get desktop-sized render targets and passes.
export function configureRenderer(engine,{mobile=false,quality='auto'}={}){
  const performance=quality==='performance'||quality==='auto'&&mobile;
  if(!performance)return;
  const directory='/libsdl/VPinballX/10.8';
  engine.FS.mkdirTree(directory);
  engine.FS.writeFile(`${directory}/VPinballX.ini`,[
    '[Player]',
    'AAFactor=0.5',
    'MaxTexDimension=2048',
    'DisableAO=1',
    'DynamicAO=0',
    'PFReflection=0',
    'SSRefl=0',
    'ForceBloomOff=1',
    '',
  ].join('\n'));
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
