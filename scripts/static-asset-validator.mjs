import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const versionOf=info=>[info.dev,info.ino,info.size,info.mtimeNs,info.ctimeNs].join(':');
const tag=hash=>`W/"${hash}"`;

export function createStaticAssetValidator(){
 const entries=new Map();
 async function validate(file,info){
  const version=versionOf(info),previous=entries.get(file);
  if(previous?.version===version)return previous.ready;
  const entry={version};
  entry.ready=(async()=>{
   const hash=createHash('sha256');
   for await(const chunk of createReadStream(file))hash.update(chunk);
   const current=await stat(file,{bigint:true});
   if(!current.isFile())throw Object.assign(Error('Static asset is no longer a file'),{code:'ENOENT'});
   // A build may replace a file while its hash is being read. Only publish a
   // validator for a stable version; concurrent requests share the same work.
   if(versionOf(current)!==version)return validate(file,current);
   return{info:current,etag:tag(hash.digest('base64url')),
    // Existing cached responses used the stat stamp as their validator. It is
    // safe to upgrade those responses while this exact file version remains.
    legacyETag:tag(createHash('sha256').update(version).digest('base64url'))};
  })().catch(error=>{if(entries.get(file)===entry)entries.delete(file);throw error;});
  entries.set(file,entry);return entry.ready;
 }
 return validate;
}
