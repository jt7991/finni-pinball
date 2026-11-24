import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from 'node:url';import{build}from 'vite';
import{verifyDmdAtlas}from '../../scripts/verify-dmd-atlas.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),publicRoot=path.join(root,'three/public'),work=path.join(root,'.work');
test('the delivered DMD atlas is lossless and bound to the unchanged original atlas',()=>{
 const metadata=verifyDmdAtlas();assert.equal(metadata.file,'dmd-atlas.webp');assert.equal(metadata.width,4096);assert.equal(metadata.height,4672);assert.equal(metadata.rgbaSHA256,'16b9a1483adc65e4f731b89fa99f4f59e29b8079d9bd54942975a8ee111d7555');assert.ok(metadata.bytes<metadata.sourceBytes);
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
