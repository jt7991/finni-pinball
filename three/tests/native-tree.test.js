import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeTree} from '../native-tree.js';
import {ContactMesh} from '../mesh-contact.js';
import {nativeMeshHit,nativeMeshQuery} from '../native-mesh-contact.js';
import {createFullGame} from '../full-game.js';
import {placeReferenceBall} from '../../scripts/reference-physics.mjs';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

test('scalar collision tree visits every intersecting shape once, including boundary-spanning shapes',()=>{
  const entries=Array.from({length:240},(_,id)=>{
    const x=(id*137)%952,y=(id*271)%2115,z=(id*31)%180;
    return {id,bounds:{left:x-20,right:x+30,top:y-10,bottom:y+40,low:z,high:z+10}};
  });
  entries.push({id:240,bounds:{left:0,right:952,top:1000,bottom:1010,low:0,high:30}});
  const tree=new NativeTree(entries,{left:0,right:952,top:0,bottom:2115});
  assert.ok(tree.levels>1);
  for(const [x,y,z,vx,vy]of [[476,1005,25,40,0],[275,1787,25,0,70],[700,210,90,100,-20]]){
    const query=nativeMeshQuery({x:x*.01,y:(2115-y)*.01,z:z*.01},{x:vx,y:vy,z:0},.25,.001),visited=[];
    tree.query(query,entry=>visited.push(entry.id));
    const expected=entries.filter(({bounds:b})=>{
      const dx=Math.max(b.left-x,0,x-b.right),dy=Math.max(b.top-y,0,y-b.bottom),dz=Math.max(b.low-z,0,z-b.high);
      return dx*dx+dy*dy+dz*dz<=query.radiusSquared;
    }).map(e=>e.id).sort((a,b)=>a-b);
    assert.deepEqual(visited.sort((a,b)=>a-b),expected);
    assert.equal(new Set(visited).size,visited.length,'scalar traversal never duplicates contacts');
  }
});

test('frame candidate reuse preserves ordered scalar visits as sphere centers change and frame bounds advance',()=>{
  const entries=Array.from({length:500},(_,id)=>{
    const x=(id*137)%952,y=(id*271)%2115,z=(id*31)%180;
    return {id,bounds:{left:x-30,right:x+40,top:y-20,bottom:y+50,low:z,high:z+20}};
  });
  entries.push({id:500,bounds:{left:0,right:952,top:1000,bottom:1010,low:0,high:180}});
  const bounds={left:0,right:952,top:0,bottom:2115},tree=new NativeTree(entries,bounds),cache={};
  let compared=0;
  for(let frame=0;frame<200;frame++){
    const query=nativeMeshQuery({x:((frame*173)%952)*.01,y:(2115-(frame*277)%2115)*.01,z:(frame%5)*.2},{x:35,y:-60,z:2},.25,.001);
    for(const offset of [0,5,-5,15,-15]){
      const changing={...query,p:{...query.p,x:Math.fround(query.p.x+offset),y:Math.fround(query.p.y-offset)}};
      const expected=[],actual=[];tree.query(changing,entry=>expected.push(entry.id));tree.query(changing,entry=>actual.push(entry.id),cache);
      assert.deepEqual(actual,expected,'ordered scalar visit list at frame '+frame+' offset '+offset);compared++;
    }
  }
  const otherTree=new NativeTree(entries.slice().reverse(),bounds),query=nativeMeshQuery({x:4.76,y:10,z:.25},{x:0,y:0,z:0},.25,.001),expected=[],actual=[];
  otherTree.query(query,entry=>expected.push(entry.id));otherTree.query(query,entry=>actual.push(entry.id),cache);
  assert.deepEqual(actual,expected,'a different tree invalidates the frame cache');assert.equal(compared,1000);
});

test('temporal broad candidates preserve exact AABB and sphere visits across slow motion, teleports and boundary escapes',()=>{
  const entries=Array.from({length:1600},(_,id)=>{const x=(id*137)%952,y=(id*271)%2115,z=(id*31)%180;return {id,bounds:{left:x-30,right:x+40,top:y-20,bottom:y+50,low:z,high:z+20}};});
  const tree=new NativeTree(entries,{left:0,right:952,top:0,bottom:2115}),cache={};let reused=0,rebuilt=0,last;
  const compare=(x,y,z,vx,vy)=>{
    const query=nativeMeshQuery({x:x*.01,y:(2115-y)*.01,z:z*.01},{x:vx,y:vy,z:0},.25,.001),expected=[],actual=[];
    tree.query(query,e=>expected.push(e.id));tree.query(query,e=>actual.push(e.id),cache);assert.deepEqual(actual,expected);
    if(last===cache.region)reused++;else rebuilt++;last=cache.region;
    for(const dx of [-10,0,10]){const moved={...query,p:{...query.p,x:Math.fround(query.p.x+dx)}};const a=[],b=[];tree.query(moved,e=>a.push(e.id));tree.query(moved,e=>b.push(e.id),cache);assert.deepEqual(b,a,'sphere is rechecked against the fixed frame bounds');}
  };
  for(let frame=0;frame<400;frame++)compare(400+frame*.2,1100+frame*.15,25+Math.sin(frame*.01)*4,3,2);
  for(const [x,y,z]of [[200,1100,25],[800,1100,25],[800,100,25],[800,1900,25],[800,1900,-200],[800,1900,300],[0,0,0],[952,2115,180]])compare(x,y,z,60,-20);
  assert.ok(reused>390,'nearby frames reuse broad candidates');assert.ok(rebuilt>=8,'all-axis escapes rebuild before narrowing');
});

test('fractional-height vertical posts retain an exactly horizontal collision normal',()=>{
  const mesh=new ContactMesh({vertices:[],indices:[]});
  // A generic normalized 3D edge can acquire a slight tilt when this height
  // rounds. VPX HitLineZ is vertical without a cylinder-coordinate transform.
  mesh.addVertical({x:5.5,y:19,z:0},.8351042938232422,1.1451042938232422);
  const hit=nativeMeshHit(mesh.shapes[0],{x:5.8,y:19,z:1},{x:-10,y:0,z:0},.25,.01);
  assert.ok(hit);assert.equal(hit.normal.z,0);assert.equal(Math.abs(hit.normal.y),0);assert.equal(hit.normal.x,1);
  const flat=new ContactMesh({vertices:[],indices:[]});flat.addVertical({x:5,y:10,z:0},0,0);
  assert.equal(flat.shapes.length,1,'zero-height source shapes still belong to the tree');
});

test('native reference placement retains table-space Float32 coordinates before Rapier publication',async()=>{
  const g=await createFullGame(JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let i=0;i<1700;i++)g.step();const record=g.records[0];
    const measured={x:547.42035,y:206.22552,z:160,vx:0,vy:0,vz:-2};
    placeReferenceBall(g,record,measured);
    assert.deepEqual(g.nativeBall(record.body).sync(),{x:Math.fround(measured.x),y:Math.fround(measured.y),z:Math.fround(measured.z)});
  }finally{g.dispose();}
});

test('native all-body capture reproduces a complete spinner strike and every scored rotation',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-spinners.mjs','three/tests/fixtures/vpx-spinner-all-balls.json','--check','--json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].spins,4);
  assert.equal(reports[0].scoreMismatches,0);assert.equal(reports[0].countMismatches,0);
});

test('native scoop capture matches the incoming path, physical ball removal and full authored award',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-kickers.mjs','--check','--json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].lifecycleMismatches,0);assert.equal(reports[0].events.length,1);
});

test('independent raw flipper strike retains the native animation-ball role and initial body states',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-raw-flipper-all-balls.json','--check','--json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].name,'left-105-40');
});

test('authored ball release starts at its kicker and physically rolls to the plunger',async()=>{
  const layout=JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),objects=JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url)));
  const g=await createFullGame(layout,objects,fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    const spec=objects.objects.find(s=>s.name==='BallRelease'),ball=g.spawn('BallRelease'),record=g.records[0];
    assert.equal(ball.x,Math.fround(spec.center.x));assert.equal(ball.y,Math.fround(spec.center.y));assert.equal(ball.z,25);assert.equal(record.held,'ballrelease');
    g.kick('BallRelease',ball,90,4);assert.equal(record.held,null);assert.equal(record.inLane,false);assert.equal(ball.velx,4);
    assert.equal(ball.x,Math.fround(spec.center.x),'Kick does not teleport to the rod');
    for(let ms=0;ms<800;ms++)g.step();
    assert.equal(record.inLane,true,'the actual shooter switch sees the incoming ball');assert.ok(Math.abs(ball.x-905)<1);assert.ok(Math.abs(ball.y-1897)<1);
  }finally{g.dispose();}
});
