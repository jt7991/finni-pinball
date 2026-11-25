// Lossless observer transport. Pages contain expectations only and can be
// consumed without materializing a multi-gigabyte JSON string or body array.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{gzipSync,gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{packNativeHistoryState,unpackNativeHistoryState}from'./native-history-state-package.mjs';
import{unpackNativeHistoryAudio}from'./native-history-audio-package.mjs';
export const nativeHistoryArrayPaths=[['frames'],['actions'],['startup','boundaries'],['clock','frames'],['clock','animationFrames'],['clock','preparedFrames'],['timers','events'],['timers','budgetTransitions'],['playerInputs'],['playerStateObserver','observations'],['presentation','records']];
const sha=b=>createHash('sha256').update(b).digest('hex'),get=(root,keys)=>keys.reduce((r,k)=>r?.[k],root),set=(root,keys,value)=>{get(root,keys.slice(0,-1))[keys.at(-1)]=value;};
export class NativeHistoryPageWriter{
 constructor(directory){this.directory=directory;this.arrays=new Map();fs.mkdirSync(path.join(directory,'pages'),{recursive:true});}
 add(keys,bytes){
  const id=keys.join('.');let array=this.arrays.get(id);if(!array){array={path:keys,count:0,pages:[]};this.arrays.set(id,array);}
  const packet=packNativeHistoryState(bytes);assert.ok(Array.isArray(packet.source));assert.ok(packet.source.length);const file=`pages/${id.replaceAll('.','-')}-${String(array.pages.length).padStart(5,'0')}.json.gz`,compressed=gzipSync(JSON.stringify(packet));
  fs.writeFileSync(path.join(this.directory,file),compressed,{flag:'wx'});array.pages.push({file,from:array.count,count:packet.source.length,sourceBytes:packet.sourceBytes,sourceSHA256:packet.sourceSHA256,compressedBytes:compressed.length,compressedSHA256:sha(compressed)});array.count+=packet.source.length;
 }
 pageRemaining(metadata,{pageSize=128}={}){
  assert.ok(Number.isInteger(pageSize)&&pageSize>0);
  for(const keys of nativeHistoryArrayPaths){const rows=get(metadata,keys);if(!Array.isArray(rows)||!rows.length)continue;
   assert.ok(!this.arrays.has(keys.join('.')),'Previously streamed arrays must have an empty tail');
   for(let i=0;i<rows.length;i+=pageSize)this.add(keys,Buffer.from(JSON.stringify(rows.slice(i,i+pageSize))));set(metadata,keys,[]);
  }
  return[...this.arrays.keys()];
 }
 finish(metadata){
  for(const[id,array]of this.arrays){assert.deepEqual(get(metadata,array.path),[],'Every streamed tail must be transferred before sealing');set(metadata,array.path,{$nativeHistoryArray:id});}
  const manifest={format:'native-history-paged-v1',metadata,arrays:[...this.arrays.values()]},fixture=hydrateNativeHistoryPages(manifest,this.directory),logical=hashNativeHistoryJSON(fixture);Object.assign(manifest,logical);fs.writeFileSync(path.join(this.directory,'capture-pages.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
 }
}
export class NativeHistoryPagedArray{
 constructor(descriptor,directory){this.descriptor=descriptor;this.directory=directory;this.length=descriptor.count;let count=0;for(const page of descriptor.pages){assert.equal(page.from,count,'Pages must be contiguous');assert.ok(page.count>0);assert.match(page.file,/^pages\/[a-zA-Z0-9-]+\.json\.gz$/);count+=page.count;}assert.equal(count,this.length,'Page count must cover every row');}
 readPage(page){const bytes=typeof this.directory==='function'?this.directory(page.file):fs.readFileSync(path.join(this.directory,page.file));assert.equal(bytes.length,page.compressedBytes);assert.equal(sha(bytes),page.compressedSHA256,'Compressed native page changed');const packet=JSON.parse(gunzipSync(bytes));assert.equal(packet.sourceBytes,page.sourceBytes);assert.equal(packet.sourceSHA256,page.sourceSHA256);const rows=unpackNativeHistoryState(packet);assert.equal(rows.length,page.count);return rows;}
 *[Symbol.iterator](){for(const page of this.descriptor.pages)yield*this.readPage(page);}
 *entries(){let i=0;for(const row of this)yield[i++,row];}
 at(index){index=index<0?this.length+index:index;if(index<0||index>=this.length)return;const page=this.descriptor.pages.find(p=>index>=p.from&&index<p.from+p.count);return this.readPage(page)[index-page.from];}
}
export function hydrateNativeHistoryPages(manifest,directory){
 assert.equal(manifest.format,'native-history-paged-v1');const result=structuredClone(manifest.metadata),seen=new Set();for(const descriptor of manifest.arrays){const id=descriptor.path.join('.');assert.ok(!seen.has(id));seen.add(id);assert.deepEqual(get(result,descriptor.path),{$nativeHistoryArray:id});const array=new NativeHistoryPagedArray(descriptor,directory);set(result,descriptor.path,['frames','startup.boundaries','clock.preparedFrames'].includes(id)?array:[...array]);}return result;
}
export function hashNativeHistoryJSON(value){
 const hash=createHash('sha256');let logicalJSONBytes=0;const emit=s=>{logicalJSONBytes+=Buffer.byteLength(s);hash.update(s);};
 const walk=v=>{
  if(v instanceof NativeHistoryPagedArray){emit('[');let first=true;for(const p of v.descriptor.pages){const text=JSON.stringify(v.readPage(p));if(!first)emit(',');emit(text.slice(1,-1));first=false;}emit(']');}
  else if(Array.isArray(v)){emit('[');for(let i=0;i<v.length;i++){if(i)emit(',');walk(v[i]);}emit(']');}
  else if(v&&typeof v==='object'){emit('{');let first=true;for(const[k,item]of Object.entries(v)){if(!first)emit(',');emit(JSON.stringify(k)+':');walk(item);first=false;}emit('}');}
  else emit(JSON.stringify(v));
 };walk(value);return{logicalJSONBytes,logicalJSONSHA256:hash.digest('hex')};
}
function hydrateNativeHistoryBundle(bundle){
 assert.equal(bundle.format,'native-history-bundle-v1');const files=bundle.manifest.arrays.flatMap(a=>a.pages.map(p=>p.file));assert.equal(new Set(files).size,files.length,'Each bundled page is unique');assert.deepEqual(Object.keys(bundle.pages).sort(),files.sort(),'Bundle contains every page and no additional files');
 return hydrateNativeHistoryPages(bundle.manifest,file=>Buffer.from(bundle.pages[file],'base64'));
}
function verifyNativeHistory(result,manifest){const digest=hashNativeHistoryJSON(result);assert.equal(digest.logicalJSONBytes,manifest.logicalJSONBytes);assert.equal(digest.logicalJSONSHA256,manifest.logicalJSONSHA256,'Complete logical native capture changed');}
// Keep compressed pages in one fixture without ever constructing the logical
// JSON string, which can exceed V8's string-size limit. Nothing is extracted.
export function writeNativeHistoryBundle(manifestFile,file){
 const manifest=JSON.parse(fs.readFileSync(manifestFile));assert.equal(manifest.format,'native-history-paged-v1');const pages={};for(const a of manifest.arrays)for(const p of a.pages){assert.match(p.file,/^pages\/[a-zA-Z0-9-]+\.json\.gz$/);assert.ok(!Object.hasOwn(pages,p.file));pages[p.file]=fs.readFileSync(path.join(path.dirname(manifestFile),p.file)).toString('base64');}
 const bundle={format:'native-history-bundle-v1',manifest,pages};verifyNativeHistory(hydrateNativeHistoryBundle(bundle),manifest);const bytes=gzipSync(JSON.stringify(bundle));fs.writeFileSync(file,bytes,{flag:'wx'});return{file,bytes:bytes.length,sha256:sha(bytes),sourceBytes:manifest.logicalJSONBytes,sourceSHA256:manifest.logicalJSONSHA256,pages:Object.keys(pages).length};
}
export function readNativeHistoryCapture(file,{verify=true}={}){
 const bytes=fs.readFileSync(file),document=JSON.parse(bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes);if(document.format==='native-history-audio-v1')return unpackNativeHistoryAudio(document);if(document.format==='native-history-state-xor-v1')return unpackNativeHistoryState(document);
 const bundled=document.format==='native-history-bundle-v1',manifest=bundled?document.manifest:document;if(manifest.format!=='native-history-paged-v1')return manifest;const result=bundled?hydrateNativeHistoryBundle(document):hydrateNativeHistoryPages(manifest,path.dirname(file));if(verify)verifyNativeHistory(result,manifest);return result;
}
