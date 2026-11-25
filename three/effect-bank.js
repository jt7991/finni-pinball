// Lossless source container helpers. Individual FLAC bytes remain unchanged.
export function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^crcTable[(crc^bytes[i])&255];return(crc^0xffffffff)>>>0;}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
export function effectCatalogue(manifest){
 const files=new Map();for(const entry of Object.values(manifest))if(!entry.music){
  const descriptor={file:entry.file,encodedSHA256:entry.encodedSHA256,channels:entry.channels,sampleRate:entry.sampleRate,frames:entry.frames};
  const previous=files.get(entry.file);if(previous&&JSON.stringify(previous)!==JSON.stringify(descriptor))throw Error('Shared effect source metadata differs');files.set(entry.file,descriptor);
 }return[...files.values()].sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
}
export function expandFLACIndex(entry){
 if(!Number.isSafeInteger(entry.firstFrame)||entry.firstFrame<42||![0,1].includes(entry.strategy)||!Array.isArray(entry.blocks)||!entry.blocks.length||entry.blocks.length>entry.frames)throw Error('Invalid effect frame index');
 let at=entry.firstFrame,position=0;const rows=entry.blocks.map(([bytes,count],frame)=>{if(!Number.isSafeInteger(bytes)||!Number.isSafeInteger(count)||bytes<1||count<1||count>32768)throw Error('Invalid effect frame span');const row={at,next:at+bytes,position,count,frame,strategy:entry.strategy};at+=bytes;position+=count;return row;});
 if(at!==entry.bytes||position!==entry.frames)throw Error('Effect frame index is incomplete');return rows;
}
export function openEffectBank(manifest,index,bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),catalogue=effectCatalogue(manifest),files=new Map();
 if(index.format!=='finni-authored-effects-v1'||data.byteLength!==index.bytes||crc32(data)!==index.crc32||Object.keys(index.sources).length!==catalogue.length)throw Error('Effect source bank differs from index');
 let offset=0;
 for(const expected of catalogue){
  const entry=index.sources[expected.file];if(!entry||entry.offset!==offset||!Number.isSafeInteger(entry.bytes)||entry.bytes<42||entry.offset+entry.bytes>data.length)throw Error('Invalid effect source span');
  for(const key of ['encodedSHA256','channels','sampleRate','frames'])if(entry[key]!==expected[key])throw Error('Effect source bank differs from manifest: '+key);
  files.set(expected.file,{encoding:'flac-pcm24-indexed',key:expected.file,frames:entry.frames,rate:entry.sampleRate,numberOfChannels:entry.channels,encoded:data.subarray(offset,offset+entry.bytes),index:expandFLACIndex(entry)});offset+=entry.bytes;
 }
 if(offset!==data.length)throw Error('Effect source bank has trailing bytes');
 return{get(name){const entry=manifest[String(name).toLowerCase()];if(!entry||entry.music)return;return files.get(entry.file);},get byteLength(){return data.byteLength;},get size(){return files.size;}};
}
