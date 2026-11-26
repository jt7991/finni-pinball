import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const versionOf=info=>[info.dev,info.ino,info.size,info.mtimeNs,info.ctimeNs].join(':');
const tag=hash=>`W/"${hash}"`;

export function createStaticAssetValidator(){
 const entries=new Map();
 async function validate(file,info){
  const version=versionOf(info),previous=entries.get(file);
  if(previous?.version===version){
   const snapshot=await previous.ready;
   // A joining request may have arrived after an edit with the same stat
   // stamp. Check its current bytes before sharing the earlier result.
   if((await readFile(file)).equals(snapshot.body))return snapshot;
   return validate(file,await stat(file,{bigint:true}));
  }
  const entry={version};
  entry.ready=(async()=>{
   let before=info;
   for(;;){
    const first=await readFile(file),body=await readFile(file),current=await stat(file,{bigint:true});
    if(!current.isFile())throw Object.assign(Error('Static asset is no longer a file'),{code:'ENOENT'});
    // Metadata can repeat across same-size edits. Verify the bytes too, and
    // return the actual snapshot to serve rather than reopening the path.
    if(versionOf(current)!==versionOf(before)||BigInt(body.length)!==current.size||!first.equals(body)){before=current;continue;}
    return{info:current,body,etag:tag(createHash('sha256').update(body).digest('base64url'))};
   }
  })().finally(()=>{if(entries.get(file)===entry)entries.delete(file);});
  entries.set(file,entry);return entry.ready;
 }
 return validate;
}
