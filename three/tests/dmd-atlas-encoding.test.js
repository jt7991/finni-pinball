import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from 'node:url';import{build}from 'vite';
import{verifyDmdAtlas}from '../../scripts/verify-dmd-atlas.mjs';
import{createHash}from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),publicRoot=path.join(root,'three/public'),work=path.join(root,'.work');
test('the delivered DMD atlas is lossless and bound to the current main authored atlas',()=>{
 const metadata=verifyDmdAtlas();assert.equal(metadata.file,'dmd-atlas.webp');assert.equal(metadata.width,4096);assert.equal(metadata.height,5440);assert.equal(metadata.rgbaSHA256,'3f2b8bb9f047e32b1d641f9bba8fc47db0a6fecb64ef3938da2b994e6290cbe5');assert.ok(metadata.bytes<metadata.sourceBytes);
 const source=fs.readFileSync(path.join(root,'runtime/dmd-atlas.png'));assert.ok(source.equals(fs.readFileSync(path.join(publicRoot,'dmd-atlas.png'))));assert.equal(createHash('sha256').update(source).digest('hex'),'f097c6dcb703974c20ce59686cc7208797c071f1a8b0e09d0c3f110f953cc9d9');
});
test('an actual production build rejects stale or corrupted derived DMD data',async()=>{
 const directory=fs.mkdtempSync(path.join(work,'atlas-encoding-test-'));
 try{
  for(const file of ['dmd-atlas.png','dmd-atlas.webp','dmd-atlas-encoding.json'])fs.copyFileSync(path.join(publicRoot,file),path.join(directory,file));
  const source=fs.readFileSync(path.join(directory,'dmd-atlas.png')),changed=Buffer.from(source);changed[changed.length-10]^=1;fs.writeFileSync(path.join(directory,'dmd-atlas.png'),changed);
  await assert.rejects(build({configFile:path.join(root,'vite.config.js'),publicDir:directory,logLevel:'silent',build:{write:false}}),/DMD atlas source changed/);
  fs.writeFileSync(path.join(directory,'dmd-atlas.png'),source);const encoded=fs.readFileSync(path.join(directory,'dmd-atlas.webp'));encoded[encoded.length-10]^=1;fs.writeFileSync(path.join(directory,'dmd-atlas.webp'),encoded);
  assert.throws(()=>verifyDmdAtlas(directory),/Encoded DMD atlas changed/);
 }finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(work));assert.ok(path.basename(directory).startsWith('atlas-encoding-test-'));fs.rmSync(directory,{recursive:true,force:true});}
});
