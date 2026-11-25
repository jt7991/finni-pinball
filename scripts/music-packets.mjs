import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function packetHash(packets){
 const hash=createHash('sha256'),size=Buffer.alloc(4);
 for(const packet of packets){size.writeUInt32LE(packet.length);hash.update(size);hash.update(packet);}
 return hash.digest('hex');
}
export function readOggVorbis(bytes){
 let at=0,pending=[],serial,granuleFrames=0;const packets=[];
 while(at<bytes.length){
  assert.equal(bytes.toString('ascii',at,at+4),'OggS');assert.equal(bytes[at+4],0);
  const stream=bytes.readUInt32LE(at+14);serial??=stream;assert.equal(stream,serial,'One logical Vorbis stream');
  assert.equal(Boolean(bytes[at+5]&1),pending.length>0,'Ogg continuation agrees with packet boundary');
  const count=bytes[at+26],table=at+27,start=table+count;assert.ok(start<=bytes.length);let cursor=start;
  const granule=bytes.readBigUInt64LE(at+6);if(granule!==0xffffffffffffffffn)granuleFrames=Number(granule);
  for(let i=0;i<count;i++){
   const size=bytes[table+i];assert.ok(cursor+size<=bytes.length);pending.push(bytes.subarray(cursor,cursor+size));cursor+=size;
   if(size<255){packets.push(Buffer.concat(pending));pending=[];}
  }
  at=cursor;
 }
 assert.equal(pending.length,0);assert.ok(packets.length>3);assert.equal(packets[0].subarray(0,7).toString('binary'),'\x01vorbis');
 return{channels:packets[0][11],sampleRate:packets[0].readUInt32LE(12),granuleFrames,headers:packets.slice(0,3),packets:packets.slice(3)};
}
export function readWebMVorbis(bytes){
 const containers=new Set([0x18538067,0x1654ae6b,0xae,0x1f43b675,0xa0]),packets=[];let headers;
 function vint(at,id=false){
  assert.ok(at<bytes.length);let width=1,mask=128;while(!(bytes[at]&mask)){mask>>=1;width++;assert.ok(width<=8);}
  assert.ok(at+width<=bytes.length);let value=BigInt(id?bytes[at]:bytes[at]&mask-1);
  for(let i=1;i<width;i++)value=value*256n+BigInt(bytes[at+i]);
  return{width,value,unknown:!id&&value===(1n<<BigInt(width*7))-1n};
 }
 function walk(start,end){
  for(let at=start;at<end;){
   const id=vint(at,true),size=vint(at+id.width),body=at+id.width+size.width,finish=size.unknown?end:body+Number(size.value);
   assert.ok(finish<=end&&finish>=body);const kind=Number(id.value);
   if(containers.has(kind))walk(body,finish);
   if(kind===0x63a2){
    assert.equal(bytes[body],2,'Vorbis CodecPrivate has three Xiph-laced headers');let cursor=body+1;const sizes=[];
    for(let i=0;i<2;i++){let length=0,n;do{assert.ok(cursor<finish);n=bytes[cursor++];length+=n;}while(n===255);sizes.push(length);}
    headers=[];for(const length of sizes){assert.ok(cursor+length<=finish);headers.push(bytes.subarray(cursor,cursor+length));cursor+=length;}headers.push(bytes.subarray(cursor,finish));
   }
   if(kind===0xa3||kind===0xa1){
    const track=vint(body);assert.equal(Number(track.value),1);assert.ok(body+track.width+3<=finish);
    assert.equal(bytes[body+track.width+2]&6,0,'Packet-copy muxer does not lace audio blocks');
    packets.push(bytes.subarray(body+track.width+3,finish));
   }
   at=finish;
  }
 }
 walk(0,bytes.length);assert.ok(headers&&packets.length);return{headers,packets};
}
export function verifyVorbisPacketCopy(ogg,webm){
 const source=readOggVorbis(ogg),remux=readWebMVorbis(webm);
 // FFmpeg rewrites the comment/vendor header during remux. Identification
 // and setup headers define decoding and must retain every original byte.
 const codecHeaders=stream=>[stream.headers[0],stream.headers[2]];
 assert.equal(packetHash(codecHeaders(remux)),packetHash(codecHeaders(source)),'Original Vorbis identification/setup headers survive remux');
 assert.equal(remux.packets.length,source.packets.length,'Every original audio packet survives remux');
 assert.equal(packetHash(remux.packets),packetHash(source.packets),'All original packet boundaries and bytes survive remux');
 return{channels:source.channels,sampleRate:source.sampleRate,sourceGranuleFrames:source.granuleFrames,codecHeadersSHA256:packetHash(codecHeaders(source)),originalCommentSHA256:packetHash([source.headers[1]]),remuxCommentSHA256:packetHash([remux.headers[1]]),packetsSHA256:packetHash(source.packets),packets:source.packets.length};
}
