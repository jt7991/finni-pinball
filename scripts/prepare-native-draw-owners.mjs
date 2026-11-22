// Associate native draws with authored objects through controlled visibility
// changes. Captured numeric draw IDs are local to a capture and are never used
// as cross-capture identities.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';

const {values,positionals}=parseArgs({allowPositionals:true,options:{
  output:{type:'string',default:'.work/three-review/native-draw-owners.json'},
}});
assert.ok(positionals.length,'Supply completed visibility captures');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const byOwner=new Map(),byGeometry=new Map();
let sourceTableSHA256,engineSHA256;
for(const file of positionals){
  const bytes=fs.readFileSync(file),capture=JSON.parse(bytes),captureSHA256=sha(bytes);
  assert.deepEqual(capture.errors,[],file+' capture errors');
  assert.ok(capture.maps?.length,file+' completed mappings');
  engineSHA256??=capture.engineSHA256;
  sourceTableSHA256??=capture.reference.controlledSha256;
  assert.equal(capture.engineSHA256,engineSHA256);
  assert.equal(capture.reference.controlledSha256,sourceTableSHA256);
  const geometry=capture.meshes.map(mesh=>({
    vertexSHA256:sha(Buffer.from(mesh.vertexBytes,'base64')),
    indexSHA256:sha(Buffer.from(mesh.indexBytes,'base64')),
    vertices:mesh.vertices,indices:mesh.count,
  }));
  for(const part of capture.maps){
    const key=part.kind+':'+part.name;
    assert.ok(!byOwner.has(key),'Duplicate owner mapping '+key);
    const entry={kind:part.kind,name:part.name,fields:part.fields,
      original:part.original,capture:file,captureSHA256,geometry:[]};
    for(const id of part.meshes){
      assert.ok(capture.draws.some(draw=>draw.mesh===id),'Removed baseline draw');
      const g=geometry[id],signature=g.vertexSHA256+':'+g.indexSHA256;
      entry.geometry.push({...g,draws:capture.draws.filter(draw=>draw.mesh===id).map(draw=>({matrixKind:draw.matrixKind??'basic',worldBits:draw.matrixBits.slice(0,16),drawIndex:capture.draws.indexOf(draw)}))});
      if(!byGeometry.has(signature))byGeometry.set(signature,[]);
      byGeometry.get(signature).push(key);
    }
    byOwner.set(key,entry);
  }
}
// Shared geometry is reported explicitly: ownership cannot be inferred from a
// vertex/index hash alone in that case. A later asset exporter must resolve it
// using the authored transform rather than choosing an arbitrary owner.
const shared=[...byGeometry].filter(([,owners])=>new Set(owners).size>1)
  .map(([signature,owners])=>({signature,owners}));
const parts=[...byOwner.values()],result={engineSHA256,sourceTableSHA256,parts,shared};
fs.writeFileSync(values.output,JSON.stringify(result,null,2));
console.log(JSON.stringify({parts:parts.length,visible:parts.filter(p=>p.geometry.length).length,
  geometry:[...byGeometry].length,shared:shared.length,
  kinds:Object.fromEntries([...new Set(parts.map(p=>p.kind))].map(kind=>[
    kind,parts.filter(p=>p.kind===kind).length])),output:values.output}));
