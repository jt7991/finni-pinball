// Select the authored inputs belonging to a native recording. Engine behavior
// is always current; old recordings must not silently run a different table.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=new URL('../three/public/',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const archives={
 'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3':{file:'source-d259c2b.json.gz',sha256:'764afc358ba806d71b72378caa9870ed062dc1fd2afcaa14487d633840ce733e'},
 '3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14':{file:'source-99eff88.json.gz',sha256:'b078ae96f365417e8eaa57f5979ef058a1a2443087bcfb44db60939f58980dde'},
 '6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5':{file:'source-6f8116d.json.gz',sha256:'b9d30061c9570ace2a139a01573be67783b6ff9bd1fef54a0263764a2033470b'},
 '1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997':{file:'source-cc6f04f.json.gz',sha256:'12c5a00acc93c8c9336104657b53eb17506ec9f890fe5a0faba30692ce8d48a9'},
};
const cache=new Map();
export function nativeSourceAssets(tableSHA256){
 const metadata=JSON.parse(fs.readFileSync(new URL('source-table.json',root)));
 const current=metadata.playbackTableSHA256??metadata.sourceTableSHA256;
 let read;
 if(tableSHA256===current)read=name=>fs.readFileSync(new URL(name,root));
 else if(archives[tableSHA256]){
  if(!cache.has(tableSHA256)){
   const archive=archives[tableSHA256],bytes=fs.readFileSync(new URL('../three/tests/fixtures/'+archive.file,import.meta.url));
   assert.equal(sha(bytes),archive.sha256);
   const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-source-assets-v1');assert.equal(packet.tableSHA256,tableSHA256);
   for(const entry of Object.values(packet.files))assert.equal(sha(Buffer.from(entry.text)),entry.sha256);
   cache.set(tableSHA256,packet.files);
  }
  const archived=cache.get(tableSHA256);
  read=name=>{assert.ok(archived[name],'Archived source does not contain '+name);return Buffer.from(archived[name].text);};
 }else throw Error('No authored inputs for native source '+tableSHA256);
 return{tableSHA256,metadata:JSON.parse(read('source-table.json')),bytes:read,text:name=>read(name).toString('utf8'),json:name=>JSON.parse(read(name))};
}
