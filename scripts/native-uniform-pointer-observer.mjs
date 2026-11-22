// Read original WASM import pointers and the corresponding unchanged WebGL
// upload. No source memory, values, calls, state or timing are replaced.
export function installNativeUniformPointerObserver(){
 const data=window.nativeUniformPointers={imports:[],rows:[],errors:[]},locations=new WeakMap(),p=WebGL2RenderingContext.prototype;let active;
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const [module,group]of Object.entries(args[1]??{}))for(const [name,raw]of Object.entries(group))if(/(?:^|_)glUniform[234]fv$/.test(name)&&!raw.nativeUniformPointerObserver){
   data.imports.push({module,name});const wrapped=function(location,count,pointer){const previous=active;active={module,name,location,count,pointer};try{return raw.apply(this,arguments);}finally{active=previous;}};wrapped.nativeUniformPointerObserver=true;group[name]=wrapped;
  }
  return original.apply(this,args);
 };}
 const get=p.getUniformLocation;p.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)locations.set(location,{program,name});return location;};
 for(const method of ['uniform2fv','uniform3fv','uniform4fv']){const original=p[method];p[method]=function(location,array,offset=0,length){
  if(!window.nativeWholeFrame?.armed||nativeWholeFrame.done||!active)return original.apply(this,arguments);
  const info=locations.get(location);if(!info||!['lightColor_intensity','lightColor2_falloff_power','lightCenter_maxRange'].includes(info.name))return original.apply(this,arguments);
  let row;try{const view=new DataView(array.buffer),n=active.count*Number(method[7]),basic=this.getUniformBlockIndex(info.program,'basicMatrixBlock')!==this.INVALID_INDEX;row={...active,uniform:info.name,method,basic,pointerAlignment:active.pointer%4,arrayByteOffset:array.byteOffset,arrayOffset:offset,byteAddressSent:array.byteOffset+offset*4,intended:Array.from({length:n},(_,i)=>view.getFloat32(active.pointer+i*4,true)),intendedBits:Array.from({length:n},(_,i)=>view.getUint32(active.pointer+i*4,true)),sent:Array.from(array.subarray(offset,offset+n)),sentBits:Array.from(new Uint32Array(array.buffer,array.byteOffset+offset*4,n))};}catch(error){data.errors.push(error.message);}
  const result=original.apply(this,arguments);if(row){const value=this.getUniform(info.program,location);row.uploaded=Array.from(value);row.uploadedBits=Array.from(new Uint32Array(value.buffer));data.rows.push(row);}return result;
 };}
}
