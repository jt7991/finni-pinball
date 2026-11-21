import fs from 'node:fs';
import {createFullGame} from '../three/full-game.js';
import {createGame,STEP,RADIUS} from '../three/physics.js';
const layout=JSON.parse(fs.readFileSync('three/public/layout.json'));
const specs=JSON.parse(fs.readFileSync('three/public/objects.json'));
const source=fs.readFileSync('three/public/rules.vbs','utf8');
const contactNames=(g,ball)=>{
  const names=new Set();g.world.contactPairsWith(ball,other=>names.add(g.colliderLabels.get(other.handle)??g.tags.get(other.handle)?.name??'unlabeled'));
  return [...names];
};
const round=p=>Object.fromEntries(['x','y','z'].map(k=>[k,Number(p[k].toFixed(3))]));
const results=[];
if(process.argv.includes('--flippers')){
  for(const side of ['left','right'])for(const offset of [.35,.6,.85,1.05])for(const delay of [0,.02,.04,.06]){
    const g=await createGame(layout);g.start();g.launch();const f=g.flippers.find(f=>f.side===side),sign=side==='left'?1:-1;
    const x=f.p.x+sign*offset,y=f.p.y+.5;
    g.ball.setTranslation({x,y,z:RADIUS+.005},true);g.ball.setLinvel({x:0,y:-6,z:0},true);
    let top=0,maximum=0,hit=false;
    for(let i=0;i<1/STEP;i++){
      if(i*STEP>=delay)g.input(side,true);g.step();const p=g.ball.translation(),v=g.ball.linvel();
      if(i*STEP<.18){maximum=Math.max(maximum,Math.hypot(v.x,v.y));top=Math.max(top,p.z);}
      if(v.y>2)hit=true;
    }
    results.push({side,offset,delay,hit,maximum:Number(maximum.toFixed(2)),height:Number(top.toFixed(3)),end:round(g.ball.translation())});g.dispose();
  }
}else{
  const full=process.argv.includes('--full');
  for(let seed=0;seed<(full?12:24);seed++){
    const g=full?await createFullGame(layout,specs,source,()=>{}):await createGame(layout);
    g.start();let stalled=0,stuck=null,last=null;
    if(!full){g.charge=seed%4*.4;g.launch();}
    for(let i=0;i<40/STEP;i++){
      if(full&&g.inLane){g.input('launch',true);if(g.charge>.4+(seed%3)*.3)g.input('launch',false);}
      if(full&&i%120===0&&g.rules.value('bChooseBattle')){g.input('action',true);g.input('action',false);}
      const rec=full?g.records.find(r=>!r.held):{body:g.ball,collider:g.ballCollider};
      if(rec){
        const p=rec.body.translation();
        for(const side of ['left','right']){
          const down=p.y<5.7&&(Math.floor(i/((seed%3+1)*12))+(side==='left'?0:seed%2))%3!==0;
          if(g.held[side]!==down)g.input(side,down);
        }
        if(last&&Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z)<.001)stalled+=STEP;else stalled=0;
        last={...p};
        if(stalled>2){stuck={position:round(p),velocity:round(rec.body.linvel()),contacts:contactNames(g,rec.collider),at:Number(g.time.toFixed(2))};break;}
      }else {last=null;stalled=0;}
      g.step();
    }
    const result={seed,stuck,state:g.state,score:g.score};results.push(result);console.log(JSON.stringify(result));g.dispose();
  }
}
fs.mkdirSync('.work/three-physics',{recursive:true});
fs.writeFileSync(`.work/three-physics/${process.argv.includes('--flippers')?'flippers':process.argv.includes('--full')?'full':'launches'}.json`,JSON.stringify(results,null,2));
if(process.argv.includes('--flippers'))console.log(JSON.stringify(results));
