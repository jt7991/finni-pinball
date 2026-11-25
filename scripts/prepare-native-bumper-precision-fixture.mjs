// Explicit hit positions, unchanged native animation/math functions and exact
// native vertex hashes. This is an isolated component, not a gameplay capture.
import fs from'node:fs';import assert from'node:assert/strict';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{nativeMechanisms}from'./native-mechanism-compiled-harness.mjs';import{nativeTrig}from'./native-trig-compiled-harness.mjs';
const output=process.argv[2];assert.ok(output,'Supply a new fixture path');assert.equal(fs.existsSync(output),false,'Preserve existing native fixtures');
const n=await nativeMechanisms(),trig=await nativeTrig(),spec=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')).parts.find(p=>p.spec.name==='Bumper3').spec,f=Math.fround,sha=x=>createHash('sha256').update(x).digest('hex'),cases=[];
let seed=0x71b4c2e1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let sample=0;sample<1000000;sample++){
 const hit={x:f(spec.center.x+(random()-.5)*220),y:f(spec.center.y+(random()-.5)*220)};let dy=Math.abs(f(hit.y-f(spec.center.y)));if(dy===0)dy=f(.000001);const angle=n.atan(f(Math.abs(f(hit.x-f(spec.center.x)))/dy));
 const native={cos:f(trig.cos(angle)*5),sin:f(trig.sin(angle)*5)},roundedDouble={cos:f(f(Math.cos(angle))*5),sin:f(f(Math.sin(angle))*5)};
 if(native.cos!==roundedDouble.cos||native.sin!==roundedDouble.sin)cases.push({sample,hit,angle,native,roundedDouble});
}
n.bumper.reset(spec);
for(const row of cases){n.bumper.hit(row.hit);n.bumper.update(1);row.expected=n.bumper.read();const vertices=n.bumper.vertices();assert.equal(vertices.length,482*8);row.vertexSHA256=sha(Buffer.from(vertices.buffer));}
const fixture={engineSHA256:'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8',upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',functionHashes:{...n.hashes,...trig.hashes},samples:1000000,seed:0x71b4c2e1,spec,scope:'Explicit Float32 hit positions for an isolated native component. Scalar atanf/cosf/sinf functions identify every rounded-double discrepancy in the declared sample set; the complete original Bumper::UpdateAnimation/UpdateSkirt functions then independently produce every expected state and vertex hash. Original GPU Unlock4575 alone is a no-op, as in the existing mechanism harness. No native physical trajectory, allocator identity or RNG output initializes production.',cases};
const bytes=gzipSync(JSON.stringify(fixture),{level:9,mtime:0});fs.writeFileSync(output,bytes,{flag:'wx'});console.log(JSON.stringify({output,bytes:bytes.length,sha256:sha(bytes),samples:fixture.samples,cases:cases.length}));
