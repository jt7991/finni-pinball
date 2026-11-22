// Lossless integer prediction and byte planes for the exact native mesh bits.
// No floating-point quantization, vertex reordering, or triangle reordering.
function transform(input,parts,decode){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),output=new Uint8Array(bytes.length),source=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),target=new DataView(output.buffer);
  const section=(offset,count,components)=>{
    if(!Number.isInteger(offset)||!Number.isInteger(count)||offset<0||count<0||offset+count*components*4>bytes.length)throw Error('Native geometry section out of bounds');
    for(let component=0;component<components;component++){
      let previous=0;
      for(let i=0;i<count;i++){
        const scalar=offset+(i*components+component)*4,plane=offset+component*count*4;
        if(decode){
          const code=(bytes[plane+i]|bytes[plane+count+i]<<8|bytes[plane+count*2+i]<<16|bytes[plane+count*3+i]<<24)>>>0;
          const delta=(code>>>1)^-(code&1),value=(previous+delta)>>>0;target.setUint32(scalar,value,true);previous=value;
        }else{
          const value=source.getUint32(scalar,true),delta=(value-previous)|0,code=((delta<<1)^(delta>>31))>>>0;previous=value;
          for(let byte=0;byte<4;byte++)output[plane+byte*count+i]=code>>>(byte*8);
        }
      }
    }
  };
  for(const part of parts){section(part.vertexByteOffset,part.vertices,8);section(part.indexByteOffset,part.indices,1);}
  return output;
}
export const encodeNativeGeometry=(bytes,parts)=>transform(bytes,parts,false);
export const decodeNativeGeometry=(bytes,parts)=>transform(bytes,parts,true).buffer;
