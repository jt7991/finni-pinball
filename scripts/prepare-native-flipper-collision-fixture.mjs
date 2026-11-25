import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeFlipperCollisionOracle} from './native-flipper-collision-compiled-harness.mjs';

const output=process.argv[2];assert.ok(output,'Supply a new fixture path');assert.equal(fs.existsSync(output),false,'Preserve original native evidence');
const oracle=await nativeFlipperCollisionOracle(),layout=JSON.parse(fs.readFileSync('three/public/layout.json')),f=Math.fround,cases=[];
const initialSeed=0x2671125;let seed=initialSeed;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;},range=(a,b)=>f(a+(b-a)*random());
for(const source of layout.items.filter(item=>item.kind==='Flipper'))for(const magnitude of [144,432,720,2160,3600])for(const sign of [-1,1])for(let i=0;i<256;i++){
  const angle=f((sign<0?Math.min(source.start_angle,source.end_angle):Math.max(source.start_angle,source.end_angle))*f(Math.PI/180));
  const face=i%2?-1:1,normal={x:f(Math.cos(angle)*face),y:f(Math.sin(angle)*face),z:0},along=range(0,source.flipper_radius_max+source.end_radius),gap=[-6,-.05,-.00001,0,.00001,.05][i%6];
  const center={x:f(source.center.x),y:f(source.center.y)},taper=f(source.base_radius+(source.end_radius-source.base_radius)*along/source.flipper_radius_max),distance=f(25+taper+gap),normalSpeed=i<16?[-.00010001,-.0001,-.00009999,0,.00009999,.0001,.00010001,-.05][i%8]:range(-70,10),tangentSpeed=range(-25,25);
  const input={side:source.name,center,position:{x:f(center.x+f(along*Math.sin(angle))+f(distance*normal.x)),y:f(center.y-f(along*Math.cos(angle))+f(distance*normal.y)),z:range(20,45)},velocity:{x:f(f(normal.x*normalSpeed)-f(normal.y*tangentSpeed)),y:f(f(normal.y*normalSpeed)+f(normal.x*tangentSpeed)),z:range(-5,5)},momentum:{x:range(-1500,1500),y:range(-1500,1500),z:range(-1500,1500)},normal,gap:f(gap),inContact:true,contactTorque:f(sign*magnitude),flipperMomentum:0,flipperSpeed:0,inertia:f(f(f(1/3)*f(source.mass))*f(f(source.flipper_radius_max)*f(source.flipper_radius_max))),material:{elasticity:source.elasticity,elasticity_falloff:source.elasticity_falloff,friction:source.friction},hitMomentBit:i%3===0};
  cases.push({input,expected:oracle.collide(input)});
  // Match a released/moving mechanism using exactly the same ball state.
  // Torque and stop contact are independent of the magnitude/face selector.
  if(i%8===0){const moving={...input,inContact:false,contactTorque:0,flipperSpeed:range(-.4,.4)};moving.flipperMomentum=f(moving.flipperSpeed*moving.inertia);cases.push({input:moving,expected:oracle.collide(moving)});}
}
const fixture={format:'native-flipper-collision-v1',scope:'Unchanged original HitFlipper::Collide called through its original vtable on explicit scratch states. Both authored centers/materials, both stop torque directions, independently crossed face directions, five torque magnitudes, and moving controls. Clock zero suppresses event dispatch. Finite component coverage, not a clean full-game replay. JSON scalar expectations treat signed zero as numerical zero.',engineSHA256:oracle.engineSHA256,functionIndex:oracle.functionIndex,functionSHA256:oracle.functionSHA256,tableSlot:oracle.tableSlot,seed:initialSeed,upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',cases};
const bytes=gzipSync(JSON.stringify(fixture),{level:9,mtime:0});fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({output,cases:cases.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
