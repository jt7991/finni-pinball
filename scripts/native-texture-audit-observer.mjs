// Read-only upload/binding provenance for the original native texture pipeline.
// Copy bytes at upload time, before the original WASM heap can be reused.
export function installNativeTextureAuditObserver(){
 const data=window.nativeTextureAudit={uploads:[],bindings:[],pending:[]},p=WebGL2RenderingContext.prototype,sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join(''),memories=[],tables=[];
 const remember=values=>{for(const value of values){if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);if(value instanceof WebAssembly.Table&&!tables.includes(value))tables.push(value);}};
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){for(const group of Object.values(args[1]??{}))remember(Object.values(group));const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;};}
 data.inspectTextureHashes=()=>{
  if(memories.length!==1||tables.length!==1)throw Error('Unique original texture memory/table required');
  const memory=memories[0],view=new DataView(memory.buffer),words=new Uint32Array(memory.buffer),bytes=new Uint8Array(memory.buffer),names=data.names??['Spotflash','flipperltop','flipperrtop','flipperx'],rows=[],strings=new Map(),prefixes=new Map();
  for(const name of names){const encoded=new TextEncoder().encode(name),prefix=new Uint8Array(4);prefix.set(encoded.subarray(0,4));const key=new DataView(prefix.buffer).getUint32(0,true);if(!prefixes.has(key))prefixes.set(key,[]);prefixes.get(key).push({name,encoded});}
  const accept=(object,name)=>{
   const vtable=view.getUint32(object,true);if(vtable<65536||vtable+12>=memory.buffer.byteLength)return;
   const index=view.getUint32(vtable+8,true);if(index>=tables[0].length)return;const getter=Number(tables[0].get(index)?.name);if(!data.getterFunctions?.includes(getter))return;
   rows.push({name,object,pinBinary:view.getUint32(object+28,true),width:view.getUint32(object+20,true),height:view.getUint32(object+24,true),liveHash:String(view.getBigUint64(object+32,true)),getter});
  };
  for(let i=1;i<words.length-18;i++)if(prefixes.has(words[i])){
   const address=i*4,match=prefixes.get(words[i]).find(({encoded})=>encoded.every((c,j)=>bytes[address+j]===c)&&bytes[address+encoded.length]===0);if(!match)continue;
   const {name,encoded}=match;
   if(encoded.length<11&&bytes[address+11]===encoded.length)accept(address-4,name);
   strings.set(address,name);
  }
  for(let i=1;i<words.length-18;i++){const name=strings.get(words[i]);if(name&&(bytes[i*4+11]&128)&&words[i+1]===name.length)accept(i*4-4,name);}
  return rows;
 };
 const bind=p.bindTexture;p.bindTexture=function(target,texture){const result=bind.call(this,target,texture);if(target===this.TEXTURE_2D){data.bindings.push({id:window.nativePostprocess.io.textureId(texture),unit:this.getParameter(this.ACTIVE_TEXTURE)-this.TEXTURE0,frame:window.nativeStartup.frameIndex()});if(data.bindings.length>256)data.bindings.shift();}return result;};
 const upload=p.texSubImage2D;p.texSubImage2D=function(...args){
  const [target,level,x,y,width,height,format,type,source,offset=0]=args;
  if(target===this.TEXTURE_2D&&level===0&&((width===512&&height===512)||(width===2048&&height===720))&&type===this.UNSIGNED_BYTE&&ArrayBuffer.isView(source)&&[this.RGB,this.RGBA].includes(format)){
   const channels=format===this.RGB?3:4,bytes=new Uint8Array(source.buffer,source.byteOffset+offset*source.BYTES_PER_ELEMENT,width*height*channels).slice(),rgba=channels===4?bytes:new Uint8Array(width*height*4);
   if(channels===3)for(let i=0,j=0;i<rgba.length;i+=4,j+=3){rgba[i]=bytes[j];rgba[i+1]=bytes[j+1];rgba[i+2]=bytes[j+2];rgba[i+3]=255;}
   const row={id:window.nativePostprocess.io.textureId(this.getParameter(this.TEXTURE_BINDING_2D)),unit:this.getParameter(this.ACTIVE_TEXTURE)-this.TEXTURE0,frame:window.nativeStartup.frameIndex(),ms:window.nativeStartup.read()?.ms,width,height,format,type,x,y,offset,first:Array.from(bytes.subarray(0,16)),unpack:Object.fromEntries([this.UNPACK_ALIGNMENT,this.UNPACK_ROW_LENGTH,this.UNPACK_SKIP_ROWS,this.UNPACK_SKIP_PIXELS].map(key=>[key,this.getParameter(key)])),stack:Error().stack};
   data.uploads.push(row);data.pending.push(Promise.all([sha(bytes),sha(rgba)]).then(([sourceSHA256,rgbaSHA256])=>Object.assign(row,{sourceSHA256,rgbaSHA256})));
  }
  return upload.apply(this,args);
 };
}
