// Explicit reference compatibility mode, never installed in production or in
// unchanged-reference captures. Emulate desktop glUniform*v's byte pointer:
// Emscripten's HEAPF32[pointer >> 2] otherwise rounds unaligned pointers down.
export function installNativeUniformAlignmentReference(){
 const data=window.nativeUniformAlignmentReference={enabled:true,imports:[],alignedCalls:0,unalignedCalls:0,byUniform:{},errors:[]},p=WebGL2RenderingContext.prototype,locations=new WeakMap();let active;
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){for(const [module,group]of Object.entries(args[1]??{}))for(const [name,raw]of Object.entries(group))if(/(?:^|_)glUniform[234]fv$/.test(name)&&!raw.nativeAlignmentReference){data.imports.push({module,name});const wrapped=function(location,count,pointer){const previous=active;active={count,pointer};try{return raw.apply(this,arguments);}finally{active=previous;}};wrapped.nativeAlignmentReference=true;group[name]=wrapped;}return original.apply(this,args);};}
 const get=p.getUniformLocation;p.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)locations.set(location,name);return location;};
 for(const method of ['uniform2fv','uniform3fv','uniform4fv']){const original=p[method];p[method]=function(location,array,offset=0){
  if(!active)return original.apply(this,arguments);if(active.pointer%4===0){data.alignedCalls++;return original.apply(this,arguments);}
  try{if(array.byteOffset!==0||offset!==(active.pointer>>2))throw Error('Unexpected Emscripten uniform upload ABI');const count=active.count*Number(method[7]),view=new DataView(array.buffer),values=new Float32Array(count);for(let i=0;i<count;i++)values[i]=view.getFloat32(active.pointer+i*4,true);data.unalignedCalls++;const name=locations.get(location)??'unknown';data.byUniform[name]=(data.byUniform[name]??0)+1;return original.call(this,location,values);}catch(error){data.errors.push(error.message);throw error;}
 };}
}
