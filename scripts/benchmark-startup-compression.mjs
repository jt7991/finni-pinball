// Measure lossless transport choices on the files the production browser
// actually requested. Compression time excludes disk reads and verification.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const option=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const capture=option('capture'),directory=path.resolve(option('directory')??'.work/three-candidate-shared-atlas-r1'),report=option('report');
assert.ok(capture&&report);assert.equal(fs.existsSync(report),false,'Preserve earlier measurements');
const packet=JSON.parse(fs.readFileSync(capture)),rows=(packet.loads?.[0]??packet).rows;
const files=[...new Set(rows.filter(row=>row.encoding==='gzip'&&new URL(row.url).pathname.startsWith('/three/')).map(row=>decodeURIComponent(new URL(row.url).pathname.slice('/three/'.length))||'index.html'))];
const results=[];
for(const file of files){
 const full=path.resolve(directory,file);assert.ok(full.startsWith(directory+path.sep));
 const source=fs.readFileSync(full),sha256=createHash('sha256').update(source).digest('hex'),levels={};
 for(let trial=0;trial<3;trial++)for(const level of trial%2?[9,6,1]:[1,6,9]){
  const start=performance.now(),encoded=gzipSync(source,{level}),milliseconds=performance.now()-start;
  assert.deepEqual(gunzipSync(encoded),source,'Every decoded byte remains unchanged');
  const row=levels[level]??={bytes:encoded.length,milliseconds:[]};assert.equal(encoded.length,row.bytes);row.milliseconds.push(milliseconds);
 }
 for(const row of Object.values(levels))row.medianMilliseconds=row.milliseconds.slice().sort((a,b)=>a-b)[1];
 results.push({file,sourceBytes:source.length,sourceSHA256:sha256,levels});
}
const totals=Object.fromEntries([1,6,9].map(level=>[level,results.reduce((sum,row)=>({bytes:sum.bytes+row.levels[level].bytes,milliseconds:sum.milliseconds+row.levels[level].medianMilliseconds}),{bytes:0,milliseconds:0})]));
const output={scope:'Observed first-visit gzip assets, with identical source bytes at all three compression levels. Alternating trial order; median compression time per file excludes read/decode/assert work. Desktop Node diagnostics, not network or phone timing.',capture,directory,files:results,totals};
fs.writeFileSync(report,JSON.stringify(output,null,2));console.log(JSON.stringify({files:results.length,totals}));
