import test from 'node:test';
import assert from 'node:assert/strict';
import {ContactMesh} from '../mesh-contact.js';
import {BallSpin} from '../ball-spin.js';
const empty=()=>new ContactMesh({vertices:[],indices:[]});
const velocity={x:-10,y:0,z:0};

test('tall wall blocks low and high shots along its entire length',()=>{
  const mesh=empty();mesh.addWall({x:0,y:0,z:0},{x:0,y:2,z:0},0,1.2);
  for(const y of [.25,1.75])for(const z of [.25,1]){
    const hit=mesh.hitsAt({x:.5,y,z},velocity,.25,.03).find(h=>h.normal.x>.99);
    assert.ok(hit,`wall at y=${y}, z=${z}`);assert.ok(Math.abs(hit.time-.025)<1e-9);
  }
});

test('sloping ramp wall keeps its native height bands instead of blocking the space underneath',()=>{
  const mesh=empty();mesh.addRampWall({x:0,y:0,z:0},{x:0,y:2,z:1.2},0,1.2,.31,false);
  assert.equal(mesh.hitsAt({x:.5,y:1.75,z:.25},velocity,.25,.03).length,0);
  assert.ok(mesh.hitsAt({x:.5,y:1.75,z:1.2},velocity,.25,.03).some(h=>h.normal.x>.99));
});

test('native wall cap uses polygon impact timing and does not create triangle rest contacts',()=>{
  const mesh=empty();mesh.addPolygon([{x:0,y:0,z:0},{x:2,y:0,z:0},{x:2,y:2,z:0},{x:0,y:2,z:0}]);
  const hit=mesh.hitsAt({x:1,y:1,z:.35},{x:0,y:0,z:-5},.25,.03)[0];
  assert.ok(Math.abs(hit.time-.02)<1e-9);assert.equal(hit.contact,false);assert.equal(hit.normal.z,1);
  assert.equal(mesh.hitsAt({x:1,y:1,z:.2503},{x:0,y:0,z:-.05},.25,.001).length,0);
  assert.equal(mesh.hitsAt({x:3,y:1,z:.35},{x:0,y:0,z:-5},.25,.03).length,0);
});

test('wall endpoint sphere catches a ball beyond the finite upper edge',()=>{
  const mesh=empty();mesh.addEdge({x:0,y:0,z:.4},{x:0,y:1,z:.4});
  const p={x:0,y:1.1,z:.8},v={x:0,y:0,z:-5};
  assert.equal(mesh.hitsAt(p,v,.25,.1).length,0,'finite edge ends before this shot');
  mesh.addPoint({x:0,y:1,z:.4});
  const hit=mesh.hitsAt(p,v,.25,.1)[0];assert.ok(hit);assert.ok(hit.normal.y>.39&&hit.normal.z>.9);
});

test('native resting-spin history damps a spinning trapped ball and preserves free rolling',()=>{
  const spin=new BallSpin();let p={x:0,y:0,z:.25},w={x:40,y:0,z:10};
  const body={translation:()=>({...p}),angvel:()=>({...w}),mass:()=>1,setAngvel:v=>{w=v;}};
  for(let ms=0;ms<100;ms++)spin.record(body,ms);
  p.x=.001;spin.apply(body,100);assert.ok(w.x<10&&w.x>0);assert.equal(w.z,w.x/4);
  p.x=1;w={x:40,y:0,z:10};spin.apply(body,100);assert.equal(w.x,40);
});
