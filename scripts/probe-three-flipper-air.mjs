import fs from 'node:fs';
import {createGame,STEP} from '../three/physics.js';
const g=await createGame(JSON.parse(fs.readFileSync('three/public/layout.json')));g.start();
const rows=[];
g.input('left',true);g.input('right',true);
for(let i=0;i<.25/STEP;i++){
  if(i===Math.round(.1/STEP)){g.input('left',false);g.input('right',false);}
  g.step();rows.push([Math.round(g.time*1000),...g.flippers.map(f=>Number((90-f.angle*180/Math.PI).toFixed(3)))]);
}
console.log(JSON.stringify(rows));
fs.mkdirSync('.work/three-physics',{recursive:true});fs.writeFileSync('.work/three-physics/flipper-air.json',JSON.stringify(rows,null,2));g.dispose();
