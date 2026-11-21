import fs from 'node:fs';
import {createFullGame} from '../three/full-game.js';
import {createGame,STEP,RADIUS} from '../three/physics.js';
const layout=JSON.parse(fs.readFileSync('three/public/layout.json'));
const specs=JSON.parse(fs.readFileSync('three/public/objects.json'));
const source=fs.readFileSync('three/public/rules.vbs','utf8');
const contactNames=(g,ball)=>{
  const names=new Set();g.world.contactPairsWith(ball,other=>g.world.contactPair(ball,other,manifold=>{
    if(Array.from({length:manifold.numContacts()},(_,i)=>manifold.contactDist(i)).some(d=>d<.005))names.add(g.colliderLabels.get(other.handle)??g.tags.get(other.handle)?.name??'unlabeled');
  }));
  const body=ball.parent();if(body)for(const m of g.nativeMeshes){
    if(m.collider.isEnabled()&&m.mesh.hitsAt(body.translation(),{x:0,y:0,z:0},RADIUS,STEP).length)names.add(g.colliderLabels.get(m.collider.handle)??'native mesh');
  }
  return [...names];
};
const round=p=>Object.fromEntries(['x','y','z'].map(k=>[k,Number(p[k].toFixed(3))]));
const results=[];
const multiball=process.argv.includes('--multiball');
const nudged=process.argv.includes('--nudges');
const runtimeRandom=process.argv.includes('--runtime-random');
const renderHz=Number(process.argv.find(a=>a.startsWith('--render-hz='))?.split('=')[1]??0);
if(process.argv.some(a=>a.startsWith('--render-hz='))&&(!Number.isFinite(renderHz)||renderHz<1||renderHz>240||!process.argv.includes('--full')))throw Error('Controlled render cadence requires full runtime and 1..240 Hz');
const observeAfterStall=Number(process.argv.find(a=>a.startsWith('--observe-after-stall='))?.split('=')[1]??0);
if(!Number.isFinite(observeAfterStall)||observeAfterStall<0||observeAfterStall>300)throw Error('Stall observation must be 0..300 seconds');
const ruleContext=g=>({
  rules:Object.fromEntries(['bLilDPMB','bMultiBallMode','LilDPHits','LilDPHitsNeeded(CurrentPlayer)','LilDPJackpot(CurrentPlayer)','bChooseBattle','Tilted'].map(name=>[name,g.rules.value(name)])),
  targets:[...g.targetMotions].map(([name,target])=>({name,dropped:target.dropped,offset:target.offset,moving:target.moving,down:target.down,collidable:target.collidable})),
  pendingTimers:[...g.rules.timers.values()].filter(t=>/LilDP|DropTarget/i.test(t.handler)).map(t=>({handler:t.handler,at:t.at,interval:t.object.interval})),
  pendingStatements:g.rules.delays.map(d=>({...d})),
});
const seedArgument=process.argv.find(a=>a.startsWith('--seed-start=')),firstSeed=Number(seedArgument?.split('=')[1]??0);
const reportName=(process.argv.includes('--flippers')?'flippers':process.argv.includes('--full')?`full${multiball?'-multiball':''}`:'launches')+(nudged?'-nudges':'')+(runtimeRandom?'-runtime-random':'')+(observeAfterStall?`-observe${observeAfterStall}`:'')+(seedArgument?`-seed${firstSeed}`:'')+(renderHz?`-render${renderHz}`:'');
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
  const option=(name,fallback)=>Number(process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback);
  const seconds=option('seconds',60),cases=option('cases',24);
  for(let seed=firstSeed;seed<firstSeed+cases;seed++){
    const g=full?await createFullGame(layout,specs,source,()=>{},undefined,{frameAnimations:!!renderHz}):await createGame(layout);
    let renderFrames=0,nextRender=0;
    let randomState=seed+1243;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
    const initialPhysicsRandom=runtimeRandom?g.random.getState():undefined;
    if(!runtimeRandom)g.random=random;
    g.start();if(full)g.rules.execute(`Randomize ${seed+1}`);
    const initialScriptRandom=runtimeRandom&&full?g.rules.scriptRandom.getState():undefined;
    let stuck=null,error=null,completedGames=0,flips=0,maximumBalls=0,launched=0,maximumSpeed=0,qualified=false;
    let firstStallTime,firstStallContext,stallRecovery;
    let nudgeCount=0,nextNudge=5;
    const motion=new Map(),captures=new Map(),flipUntil={left:0,right:0},nextFlip={left:0,right:0};
    let charge=seed<3?.4+seed*.3:.6+random()*.6;
    if(!full){g.charge=seed%4*.4;g.launch();}
    for(let i=0;i<seconds/STEP;i++){
      try{
      if(full&&g.inLane&&!g.plunger.fireTimer){g.input('launch',true);if(g.charge>=charge-1e-6){g.input('launch',false);launched++;charge=Math.min(1.2,charge+.05);}}
      if(full&&i%120===0&&g.rules.value('bChooseBattle')){g.input('action',true);g.input('action',false);}
      if(full&&i%120===0&&g.gameState.entering){
        g.rules.execute('hsCurrentDigit=0:hsCurrentLetter=InStr(hsValidLetters,"T"):Table1_KeyDown PlungerKey:hsCurrentLetter=InStr(hsValidLetters,"S"):Table1_KeyDown PlungerKey:hsCurrentLetter=InStr(hsValidLetters,"T"):Table1_KeyDown PlungerKey');
      }
      if(full&&g.state==='over'){completedGames++;qualified=false;g.start();}
      if(full&&nudged&&g.time>=nextNudge&&g.state==='playing'&&!g.inLane){
        const action=['nudgeLeft','nudgeForward','nudgeRight'][Math.floor(random()*3)];
        g.input(action,true);g.input(action,false);nudgeCount++;nextNudge=g.time+5+random()*8;
      }
      // Qualify via the original lock rules, then exercise their queued physical
      // releases and ball/ball contacts using the same randomized controls.
      if(full&&multiball&&!qualified){
        const active=g.records.find(r=>!r.held&&r.body.translation().y>10);
        if(active){for(let n=0;n<3;n++)g.rules.hit('lock','Hit',active.proxy);qualified=true;}
      }
      const records=full?g.records:[{body:g.ball,collider:g.ballCollider}];
      maximumBalls=Math.max(maximumBalls,records.length);
      for(const side of ['left','right']){
        const approaching=records.some(r=>!r.held&&r.body.translation().y<5.5);
        if(approaching&&g.time>=nextFlip[side]){flipUntil[side]=g.time+.035+random()*.12;nextFlip[side]=flipUntil[side]+.025+random()*.14;flips++;}
        const down=g.time<flipUntil[side];if(g.held[side]!==down)g.input(side,down);
      }
      for(const rec of records){
        if(rec.held){
          const captured=captures.get(rec.body.handle);
          if(!captured||captured.held!==rec.held)captures.set(rec.body.handle,{held:rec.held,time:g.time});
          else if(g.time-captured.time>30)stuck??={bodyHandle:rec.body.handle,held:rec.held,position:round(rec.body.translation()),at:Number(g.time.toFixed(2))};
          continue;
        }
        captures.delete(rec.body.handle);
        const p=rec.body.translation(),key=rec.body.handle;
        const v=rec.body.linvel(),speed=Math.hypot(v.x,v.y,v.z);maximumSpeed=Math.max(maximumSpeed,speed);
        if(!Number.isFinite(p.x+p.y+p.z+speed)||speed>150)throw Error(`Invalid ball state: ${JSON.stringify({p,v})}`);
        let tracker=motion.get(key);
        if(!tracker||Math.hypot(p.x-tracker.position.x,p.y-tracker.position.y,p.z-tracker.position.z)>.12){tracker={position:{...p},time:g.time};motion.set(key,tracker);}
        if(g.time-tracker.time>4){
          const cradle=g.flippers.some(f=>{
            const dx=p.x-f.p.x,dy=p.y-f.p.y,x=dx*Math.cos(f.angle)+dy*Math.sin(f.angle),y=-dx*Math.sin(f.angle)+dy*Math.cos(f.angle);
            return g.held[f.side]&&x>-.25&&x<f.length+.4&&Math.abs(y)<.55;
          });
          if(!cradle)stuck??={bodyHandle:rec.body.handle,position:round(p),velocity:round(rec.body.linvel()),contacts:contactNames(g,rec.collider),at:Number(g.time.toFixed(2))};
        }
      }
      if(stuck){
        if(firstStallTime===undefined){firstStallTime=g.time;firstStallContext=full?ruleContext(g):{};if(nudged)firstStallContext.nextNudge=nextNudge;}
        if(!observeAfterStall||g.time-firstStallTime>=observeAfterStall)break;
        const observed=records.find(r=>r.body.handle===stuck.bodyHandle),p=observed?.body.translation();
        if(!stallRecovery&&(!p||Math.hypot(p.x-stuck.position.x,p.y-stuck.position.y,p.z-stuck.position.z)>.5))stallRecovery={at:Number(g.time.toFixed(3)),position:p?round(p):null,removed:!p,...(full?ruleContext(g):{})};
      }
      g.step();
      if(renderHz&&g.time*1000>=nextRender){g.prepareFrame();g.sync();renderFrames++;nextRender+=1000/renderHz;}
      }catch(cause){error={message:cause.message,at:g.time};break;}
    }
    if(full&&stuck){
      Object.assign(stuck,firstStallContext??ruleContext(g));
      if(observeAfterStall)stuck.observation={seconds:g.time-firstStallTime,recovery:stallRecovery??null,finalContext:ruleContext(g)};
    }
    const result={seed,seconds,...(renderHz?{renderHz,renderFrames}:{}),simulatedSeconds:Number(g.time.toFixed(2)),stuck,error,state:g.state,score:g.score,launched,flips,maximumBalls,maximumSpeed:Number(maximumSpeed.toFixed(2)),completedGames,...(nudged?{nudgeCount}:{}),...(runtimeRandom?{random:{algorithm:'MWC64X',initialPhysicsRandom,finalPhysicsRandom:g.random.getState(),physicsDraws:g.random.calls,initialScriptRandom,finalScriptRandom:g.rules?.scriptRandom.getState()}}:{}),physicsStats:g.physicsStats};results.push(result);console.log(JSON.stringify(result));g.dispose();
    fs.mkdirSync('.work/three-physics',{recursive:true});fs.writeFileSync(`.work/three-physics/${seedArgument?`progress-${reportName}`:multiball?'progress-multiball':'progress'}.json`,JSON.stringify(results,null,2));
  }
}
fs.mkdirSync('.work/three-physics',{recursive:true});
fs.writeFileSync(`.work/three-physics/${reportName}.json`,JSON.stringify(results,null,2));
if(process.argv.includes('--flippers'))console.log(JSON.stringify(results));
else if(results.some(r=>r.stuck||r.error)||multiball&&results.every(r=>r.maximumBalls<2))process.exitCode=1;
