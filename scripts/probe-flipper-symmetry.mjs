import fs from 'node:fs';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');
const traces=[];
for(const side of ['left','right']){
  const g=await createFullGame(layout,objects,source,()=>{});
  g.start();for(let i=0;i<1.7/STEP;i++)g.step();g.launch();
  const f=g.flippers.find(f=>f.side===side),r=g.records[0],sign=side==='left'?1:-1,trace=[];
  r.body.setTranslation({x:f.p.x+sign*.35,y:f.p.y+.5,z:.255},true);r.body.setLinvel({x:0,y:-6,z:0},true);
  for(let i=0;i<.18/STEP;i++){
    if(i*STEP>=.02&&!g.held[side])g.input(side,true);g.step();const state=g.rules.objects.get(side+'flipper');
    trace.push({ms:i+1,angle:Math.abs(f.angle-f.rest),omega:Math.abs(f.body.angvel().z),elasticity:state.elasticity,eos:state.eostorque,v:{...r.body.linvel()},p:{...r.body.translation()},stats:{...g.physicsStats}});
  }
  traces.push(trace);g.dispose();
}
fs.writeFileSync('.work/three-review/flipper-symmetry.json',JSON.stringify(traces,null,2));
let found=false;
for(let i=0;i<traces[0].length;i++){
  const a=traces[0][i],b=traces[1][i];
  if(Math.abs(Math.hypot(a.v.x,a.v.y)-Math.hypot(b.v.x,b.v.y))>.1&&!found){console.log('First divergence',JSON.stringify([a,b]));found=true;}
}
