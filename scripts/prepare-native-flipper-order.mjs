// Retain the six flipper draw slots from the same pinned source frame used
// to publish the table's opaque draw order. No captured poses are published.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const file='.work/three-review/native-full-order-revealed.json',bytes=fs.readFileSync(file),capture=JSON.parse(bytes),metadataFile='three/public/flipper-tops.json',metadata=JSON.parse(fs.readFileSync(metadataFile));
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.observationErrors,[]);
metadata.bodyDrawOrders={};
for(const part of metadata.parts){
 const position=part.spec.position,name=part.spec.name.replace(/Top$/,''),orders={};
 for(const reflection of [false,true]){
  const matching=capture.draws.flatMap((draw,index)=>draw.matrixKind==='basic'&&(draw.matrices[26]<0)===reflection&&Object.is(draw.matrices[12],Math.fround(position.x))&&Object.is(draw.matrices[13],Math.fround(position.y))?[{draw,index}]:[]),body=matching.filter(({draw})=>draw.count===300&&draw.matrices[14]===0),top=matching.filter(({draw})=>draw.count===462&&draw.matrices[14]===Math.fround(position.z));
  assert.equal(body.length,2,name+' base/rubber association');
  assert.equal(top.length,reflection&&part.spec.is_reflection_enabled===false?0:1,name+' top association');
  orders[reflection?'reflection':'main']=body.map(({index})=>index);
  if(top.length)part[reflection?'reflectionDrawOrder':'drawOrder']=top[0].index;
 }
 metadata.bodyDrawOrders[name]=orders;
}
metadata.orderProvenance={engineSHA256:capture.engineSHA256,captureSHA256:createHash('sha256').update(bytes).digest('hex'),scope:'Opaque draw slots from the unchanged native frame also used for native-table.json. Only submission order is retained; no observed poses, camera matrices or rendered images.'};
fs.writeFileSync(metadataFile,JSON.stringify(metadata));
console.log(JSON.stringify({body:metadata.bodyDrawOrders,tops:metadata.parts.map(part=>({name:part.spec.name,main:part.drawOrder,reflection:part.reflectionDrawOrder})),provenance:metadata.orderProvenance}));
