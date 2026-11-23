import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFullGame} from '../full-game.js';
import {snapshotGame} from '../game-snapshot.js';
import {mainPlayerSettings,mainBallSettings} from '../player-settings.js';

test('main ball decal setting affects subsequent balls and retains existing animation-ball decals',async()=>{
  const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
  const specs=read('objects'),g=await createFullGame(read('layout'),specs,fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{},null,{playerSettings:mainPlayerSettings,ballSettings:mainBallSettings});
  try{
    assert.equal(g.toyRecords.length,3);
    assert.ok(g.toyRecords.every(record=>record.proxy.frontdecal===specs.ball_settings.ball_image_front));
    g.start();for(let ms=0;ms<2100;ms++)g.step();
    assert.equal(g.records.length,1);assert.equal(g.records[0].proxy.frontdecal,'');
    g.rules.execute('Dim BallDecalTest:Set BallDecalTest=BallRelease.CreateBall:BallDecalTest.FrontDecal="JPBall-Scratches"');
    assert.equal(g.rules.value('BallDecalTest.FrontDecal'),'JPBall-Scratches');
    assert.equal(g.records[0].proxy.frontdecal,'','changing another ball retains this ball decal');
    const snapshot=snapshotGame(g,new Set(),new Set());
    assert.equal(snapshot.renderBalls.find(ball=>ball.id===g.records[0].body.handle).frontdecal,'');
    assert.equal(snapshot.renderBalls.at(-1).frontdecal,'JPBall-Scratches');
  }finally{g.dispose();}
});
