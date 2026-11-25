// Diagnostic container experiment, not the production playback generator.
// Packet-copy Vorbis still differs from original compiled-native PCM decoding.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
import {verifyVorbisPacketCopy} from './music-packets.mjs';
const {values}=parseArgs({options:{'source-dir':{type:'string'},'output-dir':{type:'string'},ffmpeg:{type:'string'}}});
for(const option of ['source-dir','output-dir','ffmpeg'])assert.ok(values[option],'Required --'+option);
const root=path.resolve(import.meta.dirname,'..'),output=path.resolve(values['output-dir']),directory=path.join(output,'audio'),manifest=JSON.parse(fs.readFileSync(path.join(root,'three/public/audio.json'))),sha=b=>createHash('sha256').update(b).digest('hex');
const sourceTableSHA256=sha(fs.readFileSync(path.join(root,'runtime/Finni-Big-Day.vpx'))),sourceInfo=JSON.parse(fs.readFileSync(path.join(root,'three/public/source-table.json')));assert.equal(sourceTableSHA256,sourceInfo.sourceTableSHA256);
assert.equal(fs.existsSync(path.join(output,'audio.json')),false,'Use a fresh staging directory');fs.mkdirSync(directory,{recursive:true});
function store(bytes,extension){const file=sha(bytes).slice(0,24)+extension,target=path.join(directory,file);if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),bytes);else fs.writeFileSync(target,bytes);return file;}
const streams=new Map(),result={},rows=[];
for(const[name,entry]of Object.entries(manifest)){
 if(!entry.music){result[name]=entry;continue;}
 const source=path.resolve(values['source-dir'],'sounds',name+'.ogg'),bytes=fs.readFileSync(source);assert.equal(sha(bytes),entry.sourceSHA256,name+' original current-table sound bytes');
 let stream=streams.get(entry.sourceSHA256);
 if(!stream){
  const temporary=path.join(output,'remux.webm'),run=spawnSync(values.ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-map_metadata','-1','-c:a','copy','-bitexact',temporary],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const webm=fs.readFileSync(temporary);fs.unlinkSync(temporary);const packetProof=verifyVorbisPacketCopy(bytes,webm);
  stream={file:store(bytes,'.ogg'),webm:store(webm,'.webm'),webmSHA256:sha(webm),...packetProof};streams.set(entry.sourceSHA256,stream);rows.push({sourceSHA256:entry.sourceSHA256,...stream});
 }
 const legacy=entry.encoding==='vorbis'?entry.alternatives.find(s=>s.encoding==='aac').file:entry.file,legacyBytes=fs.readFileSync(path.join(root,'three/public/audio',legacy));
 result[name]={...entry,file:stream.file,encoding:'vorbis',mimeType:'audio/ogg; codecs="vorbis"',sampleRate:stream.sampleRate,channels:stream.channels,sourceGranuleFrames:stream.sourceGranuleFrames,alternatives:[{file:stream.webm,mimeType:'audio/webm; codecs="vorbis"',encoding:'vorbis-copy',sha256:stream.webmSHA256},{file:store(legacyBytes,'.m4a'),mimeType:'audio/mp4',encoding:'aac',sha256:sha(legacyBytes)}]};
}
fs.writeFileSync(path.join(output,'audio.json'),JSON.stringify(result));fs.writeFileSync(path.join(output,'music-build-report.json'),JSON.stringify({sourceTableSHA256,namedStreams:Object.values(result).filter(e=>e.music).length,uniqueStreams:streams.size,allVorbisPacketsExact:true,rows},null,2));console.log(JSON.stringify({namedStreams:24,uniqueStreams:streams.size,allVorbisPacketsExact:true,output}));
