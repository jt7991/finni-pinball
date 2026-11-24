import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {once} from 'node:events';
import {loadDmdAtlasBlob} from '../dmd-atlas.js';

const bytes=fs.readFileSync(new URL('../public/dmd-atlas.png',import.meta.url));
async function withAtlasServer(run,{failFirst=false}={}){
  let requests=0;
  const server=http.createServer((_request,response)=>{
    requests++;
    if(failFirst&&requests===1){response.writeHead(503);response.end('Unavailable');return;}
    response.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});response.end(bytes);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/dmd-atlas.png`;
  try{await run(url,()=>requests);}finally{server.closeAllConnections();server.close();await once(server,'close');}
}

test('concurrent and sequential atlas consumers receive original bytes through one HTTP transfer',async()=>{
  await withAtlasServer(async(url,requests)=>{
    const imageSource=loadDmdAtlasBlob(url),bitmapSource=loadDmdAtlasBlob(new URL(url));
    assert.equal(imageSource,bitmapSource,'Consumers share the in-flight encoded download');
    const [a,b]=await Promise.all([imageSource,bitmapSource]);
    assert.equal(a,b);assert.equal(a.type,'image/png');
    assert.deepEqual(Buffer.from(await a.arrayBuffer()),bytes);
    assert.deepEqual(Buffer.from(await (await loadDmdAtlasBlob(url)).arrayBuffer()),bytes);
    assert.equal(requests(),1,'Completed atlas remains available for the later flasher load');
  });
});

test('a failed shared atlas download can be retried without retaining the failure',async()=>{
  await withAtlasServer(async(url,requests)=>{
    const a=loadDmdAtlasBlob(url),b=loadDmdAtlasBlob(url);assert.equal(a,b);
    await assert.rejects(a,/DMD sprite atlas unavailable/);await assert.rejects(b,/DMD sprite atlas unavailable/);assert.equal(requests(),1);
    const retry=await loadDmdAtlasBlob(url);assert.deepEqual(Buffer.from(await retry.arrayBuffer()),bytes);
    assert.equal(await loadDmdAtlasBlob(url),retry);assert.equal(requests(),2);
  },{failFirst:true});
});
