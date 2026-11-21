import fs from 'node:fs';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
const fixture=JSON.parse(fs.readFileSync('three/tests/fixtures/vpx-motion.json'));
const g=await createFullGame(JSON.parse(fs.readFileSync('three/public/layout.json')),JSON.parse(fs.readFileSync('three/public/objects.json')),fs.readFileSync('three/public/rules.vbs','utf8'),()=>{});
const advance=seconds=>{for(let i=0;i<Math.round(seconds/STEP);i++)g.step();};
const errors=[];
try{
  g.start();advance(2);
  for(const pressed of [true,false]){
    g.input('left',pressed);g.input('right',pressed);let elapsed=0;
    for(const [,ms,left,right]of fixture.flippers.filter(r=>r[0]===pressed)){
      advance(ms/1000-elapsed);elapsed=ms/1000;
      const actual=g.flippers.map(f=>90-f.angle*180/Math.PI);
      errors.push({pressed,ms,expected:[left,right],actual,error:Math.max(Math.abs(actual[0]-left),Math.abs(actual[1]-right))});
    }
    if(pressed)advance(.1);
  }
  const report={maxFlipperAngleError:Math.max(...errors.map(r=>r.error)),samples:errors};
  fs.mkdirSync('.work/three-review',{recursive:true});fs.writeFileSync('.work/three-review/vpx-parity.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--check')&&report.maxFlipperAngleError>.01)process.exitCode=1;
}finally{g.dispose();}
