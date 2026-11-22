// Verify an independent frame using geometry digests and, for shared meshes,
// native world matrices. No draw IDs or buffer IDs cross capture boundaries.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{
  capture:{type:'string',default:'.work/three-review/native-materials-rubber-variants.json'},
  owners:{type:'string',default:'.work/three-review/native-draw-owners-complete.json'},
  output:{type:'string',default:'.work/three-review/native-ownership-coverage.json'},
  'expected-draws':{type:'string',default:'589'},
}}),capture=JSON.parse(fs.readFileSync(values.capture)),owners=JSON.parse(fs.readFileSync(values.owners)),sha=b=>createHash('sha256').update(b).digest('hex'),lookup=new Map();
assert.equal(capture.engineSHA256,owners.engineSHA256);assert.equal(capture.reference.controlledSha256,owners.sourceTableSHA256);assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);assert.equal(capture.draws.length,Number(values['expected-draws']));
for(const part of owners.parts)for(const geometry of part.geometry){const key=geometry.vertexSHA256+':'+geometry.indexSHA256;if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push({part,geometry});}
const result={draws:capture.draws.length,mapped:[],missing:[],ambiguous:[],byKind:{}};
for(const [index,draw]of capture.draws.entries()){
  const mesh=capture.meshes[draw.mesh],key=sha(Buffer.from(mesh.vertexBytes,'base64'))+':'+sha(Buffer.from(mesh.indexBytes,'base64'));let candidates=lookup.get(key)??[];
  if(candidates.length>1)candidates=candidates.filter(({geometry})=>geometry.draws.some(d=>d.worldBits.every((v,i)=>v===draw.matrixBits[i])));
  if(candidates.length===1){const {part}=candidates[0];result.mapped.push({draw:index,kind:part.kind,name:part.name});result.byKind[part.kind]=(result.byKind[part.kind]??0)+1;}
  else if(candidates.length===0)result.missing.push({draw:index,count:draw.count});
  else result.ambiguous.push({draw:index,owners:candidates.map(({part})=>part.kind+':'+part.name)});
}
fs.writeFileSync(values.output,JSON.stringify(result,null,2));console.log(JSON.stringify({draws:result.draws,mapped:result.mapped.length,missing:result.missing,ambiguous:result.ambiguous,byKind:result.byKind}));assert.deepEqual(result.missing,[]);assert.deepEqual(result.ambiguous,[]);
