import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSimulationHost} from '../simulation-host.js';
import {nativeBallVisible} from '../native-ball-render.js';

test('a ball removed before preparation retains the native final main draw until FinishFrame',async()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-retired-ball-frame-native.json',import.meta.url)));
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.sourceCaptureSHA256,'3646c9fdb6615efba7bf6d8b0eba5b02eb25dc3d98ff2e97db77b2063e5bb3cd');
  const json=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
  const messages=[],host=createSimulationHost(message=>messages.push(structuredClone(message)),{allowDebug:true});
  const response=id=>messages.find(message=>message.type==='response'&&message.id===id).result;
  try{
    await host.receive({type:'init',assets:{layout:json('layout'),specs:json('objects'),source:fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8')}});
    const game=host.game,ball=game.spawn('BallRelease');
    const identities=new Map(game.renderRecords.map(record=>[record.body.handle,record.scriptID]));
    game.remove('BallRelease',ball);
    assert.deepEqual(game.physicalRecords.map(record=>record.scriptID),fixture.native.physicalIDs);
    await host.receive({type:'frame',retainSubmission:true,id:1});
    const scheduled=messages.filter(message=>message.type==='snapshot').at(-1).snapshot;
    const balls=scheduled.renderBalls.map(ball=>({...ball,reflectionEnabled:ball.reflectionenabled,forceReflection:ball.forcereflection}));
    const drawIDs=[true,false].flatMap(reflection=>balls.filter(ball=>nativeBallVisible(ball,reflection)).map(ball=>identities.get(ball.id)));
    assert.deepEqual(drawIDs,fixture.native.submissionIDs);
    await host.receive({type:'submission',frame:response(1).frame,id:2});
    const retired=response(2).balls.find(ball=>identities.get(ball.id)===fixture.native.retired.id);
    assert.equal(retired.locked,fixture.native.retired.locked);
    assert.equal(retired.radius,fixture.native.retired.radius);
    await host.receive({type:'finishFrame',frame:response(1).frame});
    await host.receive({type:'frame',retainSubmission:true,id:3});
    await host.receive({type:'submission',frame:response(3).frame,id:4});
    assert.deepEqual(response(4).balls.map(ball=>identities.get(ball.id)),fixture.native.physicalIDs);
  }finally{await host.receive({type:'dispose'});}
});
