import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createFullGame} from '../full-game.js';
import {drainForTest} from './helpers/drain.mjs';
test('main player selection enrolls the roster before the first ball and rotates to player two after a drain',async()=>{
  const json=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url))),g=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start(4);assert.equal(g.rules.value('PlayersPlayingGame'),4);
    for(let ms=0;ms<2100;ms++)g.step();assert.equal(g.records.length,1);assert.equal(g.rules.value('CurrentPlayer'),1);
    drainForTest(g);
    for(let ms=0;ms<20000;ms++)g.step();assert.equal(g.rules.value('CurrentPlayer'),2);assert.equal(g.rules.value('PlayersPlayingGame'),4);assert.equal(g.records.length,1);assert.equal(g.ballNumber,1);
  }finally{g.dispose();}
});
