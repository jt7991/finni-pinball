// Select the authored inputs belonging to a native recording. Engine behavior
// is always current; old recordings must not silently run a different table.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=new URL('../three/public/',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const previous='3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14';
let archived;
export function nativeSourceAssets(tableSHA256){
 const current=JSON.parse(fs.readFileSync(new URL('source-table.json',root))).sourceTableSHA256;
 let read;
 if(tableSHA256===current)read=name=>fs.readFileSync(new URL(name,root));
 else if(tableSHA256===previous){
  if(!archived){
   const bytes=fs.readFileSync(new URL('../three/tests/fixtures/source-99eff88.json.gz',import.meta.url));
   assert.equal(sha(bytes),'b078ae96f365417e8eaa57f5979ef058a1a2443087bcfb44db60939f58980dde');
   const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.format,'native-source-assets-v1');assert.equal(packet.tableSHA256,previous);
   for(const entry of Object.values(packet.files))assert.equal(sha(Buffer.from(entry.text)),entry.sha256);
   archived=packet.files;
  }
  read=name=>{assert.ok(archived[name],'Archived source does not contain '+name);return Buffer.from(archived[name].text);};
 }else throw Error('No authored inputs for native source '+tableSHA256);
 return{tableSHA256,metadata:JSON.parse(read('source-table.json')),bytes:read,text:name=>read(name).toString('utf8'),json:name=>JSON.parse(read(name))};
}
