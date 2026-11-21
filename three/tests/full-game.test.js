import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createFullGame} from '../full-game.js';
import {STEP} from '../physics.js';
const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const ticks=(g,s)=>{for(let i=0;i<s/STEP;i++)g.step();};
test('full runtime launches, feeds real switches and creates Friendship balls',async()=>{
  const events=[],g=await createFullGame(json('layout'),json('objects'),source,e=>events.push(e.type));
  try{
    g.start();ticks(g,1.7);assert.equal(g.records.length,1);assert.equal(g.inLane,true);
    g.input('launch',true);ticks(g,1);g.input('launch',false);assert.equal(g.records[0].held,null);
    ticks(g,1);assert.ok(g.records[0].body.translation().y>10,'ball feeds onto main playfield');
    const before=g.score;
    g.rules.hit('Bumper1','Hit',g.records[0].proxy);g.sync();assert.ok(g.score>before);
    for(let i=0;i<3;i++)g.rules.hit('lock','Hit',g.records[0].proxy);
    let maximum=0;for(let i=0;i<15/STEP;i++){g.step();maximum=Math.max(maximum,g.records.length);}
    assert.equal(g.rules.value('bNinjaMB'),true);assert.ok(maximum>=3,`physical multiball count ${maximum}`);
    assert.ok(events.includes('start'));
  }finally{g.dispose();}
});
test('native bonus, game over and replay complete across three physical drains',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),source,()=>{});
  try{
    g.start();ticks(g,1.7);
    for(let ball=1;ball<=3;ball++){
      const rec=g.records.find(r=>r.held==='lane');assert.ok(rec,`ball ${ball} released`);
      g.rules.execute('bBallSaverActive=False:bBallSaverReady=False');
      g.rules.hit('Drain','Hit',rec.proxy);ticks(g,20);
    }
    assert.equal(g.state,'over');assert.equal(g.records.length,0);
    g.start();ticks(g,1.7);assert.equal(g.state,'playing');assert.equal(g.ballNumber,1);assert.equal(g.records.length,1);
  }finally{g.dispose();}
});
