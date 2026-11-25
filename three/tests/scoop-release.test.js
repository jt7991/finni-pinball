import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFullGame} from '../full-game.js';
import {mainPlayerSettings} from '../player-settings.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url))),source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
async function scenario(){
  const game=await createFullGame(read('layout'),read('objects'),source,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings});
  let ticks=0;const kicks=[],kick=game.kick.bind(game);
  game.kick=(name,...args)=>{if(name.toLowerCase()==='hellhouse')kicks.push({time:game.time,id:game.captures.get('hellhouse')?.scriptID});return kick(name,...args);};
  const step=count=>{for(let i=0;i<count;i++){game.step();if(++ticks%17===0){game.prepareFrame();game.finishFrame();}}};
  function enter(record){
    const before=game.rules.value('BallsInHole');
    for(const[key,value]of Object.entries({x:293.68433,y:530,z:25,velx:0,vely:-8,velz:0}))record.proxy.setProperty(key,{type:'Single',value});
    for(let i=0;i<1000&&game.rules.value('BallsInHole')===before;i++)step(1);
    assert.equal(game.rules.value('BallsInHole'),before+1,'original scoop collider captures the approach');return game.time;
  }
  game.start();step(2200);return {game,kicks,step,enter};
}

test('a rejected chooser with an active mode returns the captured ball on the ordinary 1500ms eject path',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    // Explicit stale-ready qualification isolates the protective branch; it
    // is not a claim that this assignment reproduces natural qualification.
    g.rules.execute('Battle(CurrentPlayer,0)=1:bBattleReady=True');
    const at=enter(g.records[0]);assert.equal(g.rules.value('bChooseBattle'),false);assert.equal(g.records.length,0);
    step(1000);assert.equal(g.rules.value('BallsInHole'),1,'retain the authored eject delay');
    step(600);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(g.records.length,1);assert.equal(g.records[0].held,null);
    assert.equal(kicks.length,1);assert.ok(kicks[0].time-at>=1.44&&kicks[0].time-at<=1.52,'native 40ms timer pulse quantizes the 1500ms request');
    assert.equal(g.rules.value('Battle(CurrentPlayer,0)'),1);assert.equal(g.rules.value('bChooseBattle'),false);
  }finally{g.dispose();}
});

test('three multiball scoop captures all return without opening a second mode chooser',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    g.rules.execute('Battle(CurrentPlayer,0)=1:bBattleReady=True');
    // Authored creation enrolls the additional balls and their counters.
    // The three incoming poses are explicit physical scenario inputs.
    g.rules.run('CreateNewBall');g.rules.run('CreateNewBall');assert.equal(g.records.length,3);assert.equal(g.rules.value('bMultiBallMode'),true);
    const incoming=[...g.records];
    for(const record of incoming){enter(record);step(80);}
    assert.equal(g.rules.value('BallsInHole'),3);assert.equal(g.rules.value('bChooseBattle'),false);
    step(2500);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(kicks.length,3);assert.equal(new Set(kicks.map(k=>k.id)).size,3);assert.ok(kicks.every(k=>k.id!==undefined));
    assert.equal(g.rules.value('Battle(CurrentPlayer,0)'),1);assert.equal(g.rules.value('bChooseBattle'),false);
  }finally{g.dispose();}
});

test('a legitimate mode chooser keeps its ball until confirmation and then uses the authored 3000ms delay',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    enter(g.records[0]);step(3500);assert.equal(g.rules.value('bChooseBattle'),true);assert.equal(g.rules.value('BallsInHole'),1);assert.equal(kicks.length,0);
    g.input('action',true);g.input('action',false);step(2500);assert.equal(g.rules.value('BallsInHole'),1);
    step(700);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(kicks.length,1);
  }finally{g.dispose();}
});

test('mystery retains its original award and delayed ejection rather than taking the rejected-chooser path',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    g.rules.execute('Battle(CurrentPlayer,0)=1:bBattleReady=True:li037.State=1');enter(g.records[0]);
    step(4000);assert.equal(g.rules.value('BallsInHole'),1);assert.equal(kicks.length,0);
    step(2000);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(kicks.length,1);
  }finally{g.dispose();}
});

test('balls entering an existing chooser during multiball all eject after one confirmation',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    g.rules.run('CreateNewBall');g.rules.run('CreateNewBall');
    for(const record of [...g.records]){enter(record);step(80);}
    step(2500);assert.equal(g.rules.value('BallsInHole'),3);assert.equal(g.rules.value('bChooseBattle'),true);assert.equal(kicks.length,0);
    g.input('action',true);g.input('action',false);step(2500);assert.equal(g.rules.value('BallsInHole'),3);
    step(1400);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(kicks.length,3);assert.equal(new Set(kicks.map(k=>k.id)).size,3);
    assert.equal(g.rules.value('bChooseBattle'),false);assert.equal(g.rules.value('FinniChooserGeneration'),1);
  }finally{g.dispose();}
});

test('qualified supplies multiball retains its own scoop release and drains the captured queue',async()=>{
  const {game:g,kicks,step,enter}=await scenario();
  try{
    // The supplied qualification isolates the authored StartMechSuitMB path.
    g.rules.execute('bMechSuitMBLight(CurrentPlayer)=True');
    g.rules.run('CreateNewBall');g.rules.run('CreateNewBall');
    for(const record of [...g.records]){enter(record);step(80);}
    assert.equal(g.rules.value('bMechSuitMBStarted'),true);assert.equal(g.rules.value('bChooseBattle'),false);
    step(800);assert.equal(g.rules.value('BallsInHole'),3);assert.equal(kicks.length,0);
    step(1700);assert.equal(g.rules.value('BallsInHole'),0);assert.equal(kicks.length,3);assert.equal(g.rules.value('bChooseBattle'),false);
  }finally{g.dispose();}
});
