import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createFullGame} from '../full-game.js';
import {mainPlayerSettings} from '../player-settings.js';
import {activeBallQueries,observeScoopActiveBall,activeBallApproach,verifyActiveBallObservation} from '../../scripts/active-ball-lifecycle-scenario.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(name,expected){const bytes=fs.readFileSync(new URL('./fixtures/'+name,import.meta.url));assert.equal(sha(bytes),expected);const r=JSON.parse(bytes);assert.equal(r.engineBytesVerified??r.provenance.engineBytesVerified,true);assert.deepEqual(r.errors,[]);return r;}
async function scenario(script=source){
  const game=await createFullGame(read('layout'),read('objects'),script,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings});
  let ticks=0;const step=ms=>{for(let i=0;i<ms;i++){game.step();if(++ticks%17===0){game.prepareFrame();game.finishFrame();}}};
  game.start();step(2200);return {game,step};
}
async function scoop(extra=2){
  const s=await scenario(),g=s.game;g.rules.execute(observeScoopActiveBall(source));for(let i=0;i<extra;i++)g.rules.run('CreateNewBall');g.rules.execute(activeBallApproach);
  for(let ms=0;ms<1000&&!g.rules.value('ActiveQCaptured');ms++)s.step(1);
  assert.equal(g.rules.value('ActiveQCaptured'),true);return s;
}
test('original scoop destruction advances global ActiveBall while preserving the saved Ball reference',async()=>{
  const native=fixture('vpx-active-ball-lifecycle.json','a808a2147a810bb76161a382054c932eacba0634e90b33f95c3e7250f1ce60a3');
  assert.equal(native.provenance.metadata.sourceSha256,read('source-table').sourceTableSHA256);assert.equal(native.provenance.metadata.engineSHA256,read('source-table').engineSHA256);
  assert.equal(observeScoopActiveBall(source),native.instrumentation);assert.equal(sha(native.instrumentation),native.instrumentationSHA256);assert.equal(activeBallApproach,native.approach);
  const {game:g}=await scoop();try{const actual=Object.fromEntries(activeBallQueries.map(name=>[name,g.rules.value(name)]));verifyActiveBallObservation(actual,assert);assert.deepEqual(actual,native.values);}finally{g.dispose();}
});
test('frame animation callbacks preserve the native ActiveBall selection',async()=>{
  const native=fixture('vpx-active-ball-frame.json','431e33882f58b79227d06cf8a84c4fb9d3d2938c9fd59bee4ded1af74315e0cd');
  assert.equal(native.metadata.engineSHA256,read('source-table').engineSHA256);assert.equal(native.before.ms,native.after.ms);
  // Reserve the added handler at parser setup, but install its observer only
  // after normal startup, like the original-engine component.
  const {game:g}=await scenario(source+'\nSub Bumper1_Animate()\nEnd Sub');
  try{
    g.rules.execute(native.instrumentation);const motion=g.visualMotions.get('bumper1');motion.update(2000);motion.update(2000);
    g.rules.execute('FrameActiveCalls=0:FrameActiveInside=-1:FrameActiveAfter=-1:FrameActiveBefore=ActiveBall.ID');assert.equal(g.rules.value('FrameActiveBefore'),native.before.active);
    g.rules.execute('Bumper1.PlayHit');motion.update(16);g.rules.execute('FrameActiveAfter=ActiveBall.ID');
    for(const [query,key]of [['ActiveBall.ID','active'],['FrameActiveBefore','before'],['FrameActiveInside','inside'],['FrameActiveAfter','after'],['FrameActiveCalls','calls']])assert.equal(g.rules.value(query),native.after[key],query);
  }finally{g.dispose();}
});
test('a resolved floor collision selects ActiveBall even when it emits no authored Hit handler',async()=>{
  const {game:g,step}=await scoop(1);
  try{
    assert.equal(g.rules.value('ActiveBall.ID'),0);const record=g.records.find(r=>r.scriptID===4);assert.ok(record);let events=0;
    const hit=g.rules.hit.bind(g.rules);g.rules.hit=(name,kind,ball,...args)=>{if(ball===record.proxy)events++;return hit(name,kind,ball,...args);};
    // Explicit open-playfield approach; the source PhysicsEngine selects its
    // collision ball before Collide, independently of the optional Hit event.
    for(const [key,value]of Object.entries({x:450,y:1400,z:26,velx:0,vely:0,velz:-1}))record.proxy.setProperty(key,{type:'Single',value});
    for(let ms=0;ms<30&&g.rules.value('ActiveBall.ID')!==4;ms++)step(1);
    assert.equal(g.rules.value('ActiveBall.ID'),4);assert.equal(events,0);
  }finally{g.dispose();}
});
