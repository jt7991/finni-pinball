// Source WAVs are PCM16. Preserve miniaudio's signed sample / 32768 mapping;
// browser WAV decoders can instead scale positive samples by 32767.
export function decodePCM16Wave(context,bytes){
 const view=new DataView(bytes),tag=at=>String.fromCharCode(...new Uint8Array(bytes,at,4));
 if(bytes.byteLength<12||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw Error('Invalid source WAV');
 const end=view.getUint32(4,true)+8;if(end>bytes.byteLength)throw Error('Truncated source WAV');
 let format,data;
 for(let at=12;at+8<=end;){
  const size=view.getUint32(at+4,true),start=at+8;if(start+size>end)throw Error('Truncated WAV chunk');
  if(tag(at)==='fmt '){
   if(size<16)throw Error('Truncated WAV format');
   format={codec:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),align:view.getUint16(start+12,true),bits:view.getUint16(start+14,true)};
  }
  if(tag(at)==='data')data={start,size};at=start+size+(size%2);
 }
 if(!format||!data||format.codec!==1||format.bits!==16||![1,2].includes(format.channels)||format.align!==format.channels*2||!format.rate||!data.size||data.size%format.align)throw Error('Unsupported source WAV format');
 const frames=data.size/format.align,buffer=context.createBuffer(format.channels,frames,format.rate);
 for(let c=0;c<format.channels;c++){
  const samples=buffer.getChannelData(c);
  for(let i=0;i<frames;i++)samples[i]=view.getInt16(data.start+i*format.align+c*2,true)/32768;
 }
 return buffer;
}

export function createEffectDecoder(context){
 const decoders=new Map();
 function check(buffer,entry){
  if(buffer.sampleRate!==entry.sampleRate||buffer.numberOfChannels!==entry.channels||buffer.length!==entry.frames)throw Error('Effect format differs from source');
  return buffer;
 }
 return async(bytes,entry,loadFallback)=>{
  if(entry.encoding!=='flac-pcm24')return context.decodeAudioData(bytes);
  try{
   // Decode at the authored rate so the cached samples stay unchanged. The
   // live AudioBufferSource handles conversion to the destination device.
   let decoder=decoders.get(entry.sampleRate);
   if(!decoder){decoder=new OfflineAudioContext(entry.channels,1,entry.sampleRate);decoders.set(entry.sampleRate,decoder);}
   return check(await decoder.decodeAudioData(bytes),entry);
  }catch{
   // Unsupported FLAC decoding uses the original WAV, not another lossy copy.
   return check(decodePCM16Wave(context,await loadFallback()),entry);
  }
 };
}
