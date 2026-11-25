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
export const NATIVE_GEOMETRY_DICTIONARY='delta-byteplanes-dictionary-v1';
const originalEncoding='delta-byteplanes-v1',magic=0x3144474e;
function sectionsFor(parts,length){
  const sections=[];let cursor=0;
  for(const part of parts)for(const[offset,count,components]of [[part.vertexByteOffset,part.vertices,8],[part.indexByteOffset,part.indices,1]]){
    const bytes=count*components*4;
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(bytes)||offset!==cursor||offset+bytes>length)throw Error('Invalid native geometry dictionary section');
    sections.push({offset,count,components,bytes});cursor+=bytes;
  }
  if(cursor!==length)throw Error('Native geometry dictionary length differs from sections');
  return sections;
}
function packDictionary(encoded,parts){
  const sections=sectionsFor(parts,encoded.length),buckets=new Map(),entries=[];let length=12;
  for(const section of sections){
    let hash=2166136261;for(let i=0;i<section.bytes;i++)hash=Math.imul(hash^encoded[section.offset+i],16777619)>>>0;
    const key=section.bytes+':'+hash,bucket=buckets.get(key)??[];
    const same=bucket.find(index=>{const previous=sections[index];for(let i=0;i<section.bytes;i++)if(encoded[section.offset+i]!==encoded[previous.offset+i])return false;return true;});
    entries.push(same===undefined?0:same+1);length+=4+(same===undefined?section.bytes:0);
    if(same===undefined){bucket.push(entries.length-1);buckets.set(key,bucket);}
  }
  const output=new Uint8Array(length),view=new DataView(output.buffer);view.setUint32(0,magic,true);view.setUint32(4,encoded.length,true);view.setUint32(8,sections.length,true);let at=12;
  for(const[index,section]of sections.entries()){const reference=entries[index];view.setUint32(at,reference,true);at+=4;if(!reference){output.set(encoded.subarray(section.offset,section.offset+section.bytes),at);at+=section.bytes;}}
  return output;
}
function unpackDictionary(input,parts){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);
  if(bytes.length<12||view.getUint32(0,true)!==magic)throw Error('Invalid native geometry dictionary header');
  const length=view.getUint32(4,true),sections=sectionsFor(parts,length);
  if(view.getUint32(8,true)!==sections.length)throw Error('Native geometry dictionary section count differs');
  const locations=new Uint32Array(sections.length);let at=12;
  // Validate all spans and references before allocating output or decoding.
  for(const[index,section]of sections.entries()){
    if(at+4>bytes.length)throw Error('Truncated native geometry dictionary token');
    const reference=view.getUint32(at,true);at+=4;
    if(reference){if(reference>index||sections[reference-1].bytes!==section.bytes)throw Error('Invalid native geometry dictionary reference');locations[index]=locations[reference-1];}
    else{if(at+section.bytes>bytes.length)throw Error('Truncated native geometry dictionary literal');locations[index]=at;at+=section.bytes;}
  }
  if(at!==bytes.length)throw Error('Trailing native geometry dictionary bytes');
  const output=new Uint8Array(length),target=new DataView(output.buffer);
  for(const[index,section]of sections.entries())for(let component=0;component<section.components;component++){
    let previous=0;const plane=locations[index]+component*section.count*4;
    for(let i=0;i<section.count;i++){
      const code=(bytes[plane+i]|bytes[plane+section.count+i]<<8|bytes[plane+section.count*2+i]<<16|bytes[plane+section.count*3+i]<<24)>>>0;
      const value=(previous+((code>>>1)^-(code&1)))>>>0;target.setUint32(section.offset+(i*section.components+component)*4,value,true);previous=value;
    }
  }
  return output.buffer;
}
export function encodeNativeGeometry(bytes,parts,encoding=originalEncoding){
  if(![originalEncoding,NATIVE_GEOMETRY_DICTIONARY].includes(encoding))throw Error('Unsupported native geometry encoding');
  const encoded=transform(bytes,parts,false);return encoding===originalEncoding?encoded:packDictionary(encoded,parts);
}
export function decodeNativeGeometry(bytes,parts,encoding=originalEncoding){
  if(encoding===NATIVE_GEOMETRY_DICTIONARY)return unpackDictionary(bytes,parts);
  if(encoding!==originalEncoding)throw Error('Unsupported native geometry encoding');
  return transform(bytes,parts,true).buffer;
}
