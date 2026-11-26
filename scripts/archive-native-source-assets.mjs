// Preserve authored inputs before importing another table revision. Historical
// native recordings must continue using their original source, never the new one.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const [output]=process.argv.slice(2);
assert.ok(output&&!fs.existsSync(output),'Choose a new archive path');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=Object.fromEntries(['source-table.json','layout.json','objects.json','rules.vbs','audio.json','native-audio/effects.json'].map(name=>{
  const bytes=fs.readFileSync('three/public/'+name),text=bytes.toString('utf8');
  assert.ok(Buffer.from(text).equals(bytes),'Archive text must preserve every source byte');
  return[name,{text,sha256:sha(bytes)}];
}));
const metadata=JSON.parse(files['source-table.json'].text);
const packet={format:'native-source-assets-v1',tableSHA256:metadata.sourceTableSHA256,files};
const bytes=gzipSync(JSON.stringify(packet),{level:9});
fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({output,tableSHA256:packet.tableSHA256,sha256:sha(bytes),bytes:bytes.length,files:Object.keys(files)}));
