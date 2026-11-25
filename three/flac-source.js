// Independent decoder for this table's mono/stereo 24-bit FLAC sources.
// Bitstream definitions: RFC 9639, sections 8.2 and 9.
// https://www.rfc-editor.org/rfc/rfc9639.html
// No resampling, normalization, browser audio context or source substitution.
const fail=message=>{throw Error('Authored FLAC: '+message);};
const table=(bits,polynomial)=>Uint32Array.from({length:256},(_,value)=>{
 let crc=value*2**(bits-8);for(let n=0;n<8;n++)crc=(crc*2)^((crc&2**(bits-1))?polynomial:0);return crc&(2**bits-1);
});
const crc8=table(8,7),crc16=table(16,0x8005);
function checksum(data,start,end,bits,lookup){let crc=0;for(let i=start;i<end;i++)crc=((crc*256)^lookup[((crc>>>(bits-8))^data[i])&255])&(2**bits-1);return crc;}
class Bits{
 constructor(data,byte=0){this.data=data;this.at=byte*8;}
 u(bits){
  if(bits<0||bits>36||this.at+bits>this.data.length*8)fail('truncated bits');let value=0;
  while(bits){const available=8-(this.at%8),take=Math.min(bits,available);value=value*2**take+((this.data[this.at>>>3]>>>(available-take))&((1<<take)-1));this.at+=take;bits-=take;}return value;
 }
 s(bits){const value=this.u(bits);return bits&&value>=2**(bits-1)?value-2**bits:value;}
 unary(){let zeros=0;while(true){if(this.at>=this.data.length*8||zeros>65536)fail('invalid unary code');const remaining=8-this.at%8,value=this.data[this.at>>>3]&((1<<remaining)-1);if(value){const count=Math.clz32(value)-(32-remaining);this.at+=count+1;return zeros+count;}zeros+=remaining;this.at+=remaining;}}
 number(){
  const first=this.u(8);if(first<128)return first;let count=0;for(let bit=128;first&bit;bit>>>=1)count++;
  if(count<2||count>7)fail('invalid frame number');let value=first&((1<<(7-count))-1);
  for(let i=1;i<count;i++){const next=this.u(8);if((next&192)!==128)fail('invalid frame number continuation');value=value*64+(next&63);}return value;
 }
}
function residual(reader,samples,order){
 const method=reader.u(2);if(method>1)fail('reserved residual method');const width=method+4,partitions=2**reader.u(4),size=samples.length/partitions;
 if(!Number.isInteger(size)||size<=order)fail('invalid residual partition');let at=order;
 for(let p=0;p<partitions;p++){
  const count=size-(p===0?order:0),parameter=reader.u(width);
  if(parameter===2**width-1){const bits=reader.u(5);for(let i=0;i<count;i++)samples[at++]=reader.s(bits);}
  else for(let i=0;i<count;i++){const folded=reader.unary()*2**parameter+reader.u(parameter),value=folded%2?-(folded+1)/2:folded/2;if(value< -2147483647||value>2147483647)fail('residual exceeds signed range');samples[at++]=value;}
 }
}
const fixed=[[],[1],[2,-1],[3,-3,1],[4,-6,4,-1]];
function subframe(reader,count,bits){
 if(reader.u(1))fail('reserved subframe bit');const type=reader.u(6),wasted=reader.u(1)?reader.unary()+1:0;bits-=wasted;if(bits<1||bits>25)fail('invalid subframe depth');
 const samples=new Int32Array(count),limit=2**(bits-1);let order=0,coefficients,shift=0;
 if(type===0)samples.fill(reader.s(bits));
 else if(type===1)for(let i=0;i<count;i++)samples[i]=reader.s(bits);
 else{
  if(type>=8&&type<=12){order=type-8;coefficients=fixed[order];}
  else if(type>=32){order=type-31;}
  else fail('reserved subframe type');
  if(order>count)fail('predictor longer than frame');for(let i=0;i<order;i++)samples[i]=reader.s(bits);
  if(type>=32){const precision=reader.u(4)+1;if(precision===16)fail('reserved predictor precision');shift=reader.s(5);if(shift<0)fail('negative predictor shift');coefficients=Array.from({length:order},()=>reader.s(precision));}
  residual(reader,samples,order);
  for(let i=order;i<count;i++){let prediction=0;for(let j=0;j<order;j++)prediction+=coefficients[j]*samples[i-j-1];const value=samples[i]+Math.floor(prediction/2**shift);if(value< -limit||value>=limit)fail('predicted sample exceeds bit depth');samples[i]=value;}
 }
 if(wasted)for(let i=0;i<count;i++)samples[i]*=2**wasted;return samples;
}
function parse(bytes,expected){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(data.length<42||data.length>16*1024*1024||data[0]!==102||data[1]!==76||data[2]!==97||data[3]!==67)fail('invalid signature or size');
 if(!expected||!Number.isInteger(expected.frames)||expected.frames<1||expected.frames*expected.channels*4>16*1024*1024)fail('invalid expected allocation');
 let at=4,last=false,format;
 while(!last){
  if(at+4>data.length)fail('truncated metadata');const tag=data[at],kind=tag&127,size=data[at+1]*65536+data[at+2]*256+data[at+3],start=at+4;last=!!(tag&128);if(start+size>data.length)fail('truncated metadata block');
  if(kind===0){if(format||at!==4||size!==34)fail('invalid stream information');const r=new Bits(data,start),min=r.u(16),max=r.u(16);r.u(24);r.u(24);format={min,max,sampleRate:r.u(20),channels:r.u(3)+1,bits:r.u(5)+1,frames:r.u(36)};}
  else if(!format||kind===127)fail('invalid metadata order');at=start+size;
 }
 if(!format||format.bits!==24||![1,2].includes(format.channels)||!format.max||format.max>32768)fail('unsupported authored format');
 for(const key of ['channels','frames','sampleRate'])if(format[key]!==expected[key])fail('source '+key+' differs from manifest');
 return{data,format,at};
}
function readFrame(data,at,format,written,frame,strategy){
  const start=at,r=new Bits(data,at);if(r.u(15)!==0x7ffc)fail('invalid frame sync');const variable=r.u(1);if(strategy!==undefined&&strategy!==variable)fail('changed blocking strategy');
  const blockCode=r.u(4),rateCode=r.u(4),assignment=r.u(4),depthCode=r.u(3);if(r.u(1)||!blockCode||rateCode===15||assignment>10)fail('reserved frame header');
  const number=r.number();if(number!==(variable?written:frame))fail('non-contiguous frame number');
  const count=blockCode===1?192:blockCode<6?144*2**blockCode:blockCode===6?r.u(8)+1:blockCode===7?r.u(16)+1:2**blockCode;
  const rate=rateCode===0?format.sampleRate:rateCode===12?r.u(8)*1000:rateCode===13?r.u(16):rateCode===14?r.u(16)*10:[0,88200,176400,192000,8000,16000,22050,24000,32000,44100,48000,96000][rateCode];
  const bits=[format.bits,8,12,0,16,20,24,32][depthCode],channelCount=assignment<8?assignment+1:2;
  if(rate!==format.sampleRate||bits!==24||channelCount!==format.channels||count>format.max||written+count>format.frames)fail('frame format differs from stream');
  r.u(8);if(checksum(data,start,r.at/8,8,crc8))fail('header checksum');
  const decoded=Array.from({length:channelCount},(_,c)=>subframe(r,count,bits+((assignment===8||assignment===10)&&c===1||assignment===9&&c===0?1:0)));
  const padding=(8-r.at%8)%8;if(r.u(padding))fail('nonzero frame padding');r.u(16);at=r.at/8;if(checksum(data,start,at,16,crc16))fail('frame checksum');
  const channels=Array.from({length:channelCount},()=>new Float32Array(count));
  for(let i=0;i<count;i++){
   let left=decoded[0][i],right=decoded[1]?.[i];if(assignment===8)right=left-right;else if(assignment===9)left+=right;else if(assignment===10){const middle=left*2+(right%2!==0?1:0),side=right;left=(middle+side)/2;right=(middle-side)/2;}
   if(left< -8388608||left>8388607||right!==undefined&&(right< -8388608||right>8388607))fail('sample exceeds 24-bit range');
   channels[0][i]=left/8388608;if(channelCount===2)channels[1][i]=right/8388608;
  }
  return{channels,count,next:at,strategy:variable};
}
export function indexAuthoredFLAC(bytes,expected){
 const parsed=parse(bytes,expected),{data,format}=parsed,index=[];let at=parsed.at,written=0,frame=0,strategy;
 while(at<data.length){const block=readFrame(data,at,format,written,frame,strategy);index.push({at,next:block.next,position:written,count:block.count,frame,strategy:block.strategy});at=block.next;written+=block.count;frame++;strategy=block.strategy;}
 if(written!==format.frames)fail('missing audio frames');return index;
}
export function decodeAuthoredFLAC(bytes,expected){
 const parsed=parse(bytes,expected),{data,format}=parsed,channels=Array.from({length:format.channels},()=>new Float32Array(format.frames));let at=parsed.at,written=0,frame=0,strategy;
 while(at<data.length){const block=readFrame(data,at,format,written,frame,strategy);for(let c=0;c<channels.length;c++)channels[c].set(block.channels[c],written);at=block.next;written+=block.count;frame++;strategy=block.strategy;}
 if(written!==format.frames)fail('missing audio frames');return{numberOfChannels:channels.length,sampleRate:format.sampleRate,length:written,getChannelData:channel=>channels[channel]};
}
export function createFLACFrameCache(limit=16*1024*1024){
 if(!Number.isSafeInteger(limit)||limit<262144)fail('invalid frame cache budget');const frames=new Map();let retainedBytes=0;
 return{
  get(key,load){
   let value=frames.get(key);if(value){frames.delete(key);frames.set(key,value);return value.channels;}
   const channels=load(),bytes=channels.reduce((sum,c)=>sum+c.byteLength,0);if(bytes>limit)fail('decoded frame exceeds cache budget');
   while(retainedBytes+bytes>limit&&frames.size){const oldest=frames.keys().next().value;retainedBytes-=frames.get(oldest).bytes;frames.delete(oldest);}
   frames.set(key,{channels,bytes});retainedBytes+=bytes;return channels;
  },
  clear(){frames.clear();retainedBytes=0;},get stats(){return{retainedBytes,frames:frames.size,limit};},
 };
}
export function createAuthoredFLACSource(bytes,expected,index,cache){
 const parsed=parse(bytes,expected),{data,format}=parsed;if(!cache?.get||!Array.isArray(index)||!index.length)fail('frame index/cache required');
 let next=parsed.at,position=0,frame=0,strategy;const frames=index.map(row=>{
  for(const key of ['at','next','position','count','frame','strategy'])if(!Number.isSafeInteger(row[key]))fail('invalid frame index');
  if(row.at!==next||row.position!==position||row.frame!==frame||row.next<=row.at||row.next>data.length||row.count<1||row.count>format.max||![0,1].includes(row.strategy)||strategy!==undefined&&strategy!==row.strategy)fail('non-contiguous frame index');
  next=row.next;position+=row.count;frame++;strategy=row.strategy;return{...row};
 });
 if(next!==data.length||position!==format.frames)fail('incomplete frame index');
 return{numberOfChannels:format.channels,sampleRate:format.sampleRate,length:format.frames,
  readInterleaved(position,count,outputChannels){
   if(!Number.isSafeInteger(position)||!Number.isSafeInteger(count)||position<0||count<0||count>65536||position+count>format.frames||![1,2].includes(outputChannels)||format.channels===2&&outputChannels!==2)fail('invalid PCM read range');
   const pcm=new Float32Array(count*outputChannels);let output=0;
   while(output<count){
    let low=0,high=frames.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(frames[mid].position<=position)low=mid;else high=mid-1;}
    const row=frames[low],channels=cache.get(row,()=>{const block=readFrame(data,row.at,format,row.position,row.frame,row.strategy);if(block.next!==row.next||block.count!==row.count)fail('frame differs from index');return block.channels;}),offset=position-row.position,take=Math.min(count-output,row.count-offset);
    if(take<=0)fail('PCM position outside indexed frame');for(let c=0;c<outputChannels;c++){const channel=channels[Math.min(c,format.channels-1)];for(let i=0;i<take;i++)pcm[(output+i)*outputChannels+c]=channel[offset+i];}
    output+=take;position+=take;
   }
   return pcm;
  },
 };
}
