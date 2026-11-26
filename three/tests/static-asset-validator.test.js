import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createStaticAssetValidator} from '../../scripts/static-asset-validator.mjs';
const work=fileURLToPath(new URL('../../.work/',import.meta.url));
const expected=bytes=>'W/"'+createHash('sha256').update(bytes).digest('base64url')+'"';
async function scenario(run){
 const directory=fs.mkdtempSync(path.join(work,'asset-validator-test-')),file=path.join(directory,'asset.bin');
 try{await run(file);}finally{assert.equal(path.dirname(directory),path.resolve(work));assert.ok(path.basename(directory).startsWith('asset-validator-test-'));fs.rmSync(directory,{recursive:true,force:true});}
}
test('concurrent validator requests share a stable content result and recheck edited bytes',()=>scenario(async file=>{
 const first=Buffer.alloc(256*1024,17),second=Buffer.alloc(first.length,19);fs.writeFileSync(file,first);fs.utimesSync(file,1700000000,1700000000);
 const validate=createStaticAssetValidator(),info=fs.statSync(file,{bigint:true}),results=await Promise.all(Array.from({length:8},()=>validate(file,info)));
 assert.ok(results.every(result=>result===results[0]));assert.equal(results[0].etag,expected(first));assert.deepEqual(results[0].body,first);
 fs.writeFileSync(file,second);fs.utimesSync(file,1700000000,1700000000);
 // A request can obtain its stat before an edit and reach validation later.
 // Passing that real earlier stat makes stale cache reuse deterministic.
 const updated=await validate(file,info);assert.equal(updated.etag,expected(second));assert.notEqual(updated.etag,results[0].etag);assert.deepEqual(updated.body,second);
 assert.deepEqual(results[0].body,first,'a retained response snapshot survives the edit');
 const fresh=await validate(file,fs.statSync(file,{bigint:true}));assert.equal(fresh.etag,expected(second));
}));
test('a failed hash does not poison a later recreated file or a stale initial stat',()=>scenario(async file=>{
 const bytes=Buffer.from('original source bytes');fs.writeFileSync(file,bytes);const old=fs.statSync(file,{bigint:true}),validate=createStaticAssetValidator();
 fs.unlinkSync(file);await assert.rejects(validate(file,old),{code:'ENOENT'});
 fs.writeFileSync(file,Buffer.from('new source bytes'));
 const result=await validate(file,old);assert.equal(result.etag,expected(fs.readFileSync(file)));assert.deepEqual(result.body,fs.readFileSync(file));assert.equal(result.info.size,BigInt('new source bytes'.length));
}));
test('replacement during snapshot reads publishes the complete current body rather than a mixed version',()=>scenario(async file=>{
 const before=Buffer.alloc(8*1024*1024,31),after=Buffer.alloc(before.length,47);fs.writeFileSync(file,before);fs.utimesSync(file,1700000000,1700000000);
 const validate=createStaticAssetValidator(),pending=validate(file,fs.statSync(file,{bigint:true}));
 await new Promise(resolve=>setImmediate(resolve));fs.writeFileSync(file,after);fs.utimesSync(file,1700000000,1700000000);
 const result=await pending;assert.equal(result.etag,expected(after));assert.notEqual(result.etag,expected(before));assert.deepEqual(result.body,after);
}));
