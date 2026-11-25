// The shared framebuffer copy needs to restore scalar GL state. Observe the
// actual setters instead of synchronously reading those values on every copy.
// Resource bindings remain direct GL queries. Unknown/invalid scalar writes
// invalidate their cached value; the next read asks GL without consuming errors.
const readers=new WeakMap(),invalidators=new WeakMap();
export function backdropStateReader(gl){
  if(readers.has(gl))return readers.get(gl);
  const getParameter=gl.getParameter.bind(gl),isEnabled=gl.isEnabled.bind(gl);
  const values=new Map(),enabled=new Map();let viewportLimits,textureUnits,lost=false;
  const scalar=new Set([gl.VIEWPORT,gl.COLOR_WRITEMASK,gl.DEPTH_WRITEMASK,gl.DEPTH_FUNC,gl.DEPTH_RANGE,gl.ACTIVE_TEXTURE]);
  const caps=new Set([gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.SCISSOR_TEST,gl.STENCIL_TEST,gl.POLYGON_OFFSET_FILL,gl.RASTERIZER_DISCARD,gl.DITHER,gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE]);
  const clone=value=>Array.isArray(value)||ArrayBuffer.isView(value)?value.slice():value;
  const observe=(name,update)=>{const original=gl[name];gl[name]=function(...args){const result=original.apply(this,args);if(this===gl){if(!lost)update(...args);}else{invalidate();invalidators.get(this)?.();}return result;};};
  const uncertain=key=>values.delete(key);
  observe('viewport',(x,y,width,height)=>{
    viewportLimits??=getParameter(gl.MAX_VIEWPORT_DIMS);
    if(!viewportLimits||![x,y,width,height].every(v=>Number.isInteger(v))||Math.abs(x)>viewportLimits[0]||Math.abs(y)>viewportLimits[1]||width<0||height<0||width>viewportLimits[0]||height>viewportLimits[1]){uncertain(gl.VIEWPORT);return;}
    values.set(gl.VIEWPORT,new Int32Array([x,y,width,height]));
  });
  observe('colorMask',(r,g,b,a)=>values.set(gl.COLOR_WRITEMASK,[!!r,!!g,!!b,!!a]));
  observe('depthMask',value=>values.set(gl.DEPTH_WRITEMASK,!!value));
  observe('depthFunc',value=>{if(Number.isInteger(value)&&value>=gl.NEVER&&value<=gl.ALWAYS)values.set(gl.DEPTH_FUNC,value);else uncertain(gl.DEPTH_FUNC);});
  observe('depthRange',(near,far)=>{
    if(Number.isFinite(near)&&Number.isFinite(far)&&near>=0&&near<=far&&far<=1)values.set(gl.DEPTH_RANGE,new Float32Array([near,far]));else uncertain(gl.DEPTH_RANGE);
  });
  observe('activeTexture',value=>{
    textureUnits??=getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    if(Number.isInteger(value)&&textureUnits&&value>=gl.TEXTURE0&&value<gl.TEXTURE0+textureUnits)values.set(gl.ACTIVE_TEXTURE,value);else uncertain(gl.ACTIVE_TEXTURE);
  });
  for(const [name,value]of [['enable',true],['disable',false]])observe(name,cap=>{if(caps.has(cap))enabled.set(cap,value);else enabled.clear();});
  // Renderer loss handling restarts the game; nevertheless discard scalar
  // observations immediately when this context's state is discarded.
  const invalidate=()=>{values.clear();enabled.clear();viewportLimits=textureUnits=undefined;};
  invalidators.set(gl,invalidate);
  gl.canvas?.addEventListener('webglcontextlost',()=>{lost=true;invalidate();});
  gl.canvas?.addEventListener('webglcontextrestored',()=>{lost=false;invalidate();});
  const reader={
    getParameter(key){if(lost||!scalar.has(key))return getParameter(key);if(!values.has(key))values.set(key,clone(getParameter(key)));return clone(values.get(key));},
    isEnabled(cap){if(lost||!caps.has(cap))return isEnabled(cap);if(!enabled.has(cap))enabled.set(cap,isEnabled(cap));return enabled.get(cap);},
  };
  readers.set(gl,reader);return reader;
}
