import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createFullGame} from '../full-game.js';
import {mainPlayerSettings} from '../player-settings.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const bytes=fs.readFileSync(new URL('./fixtures/vpx-kicker-destroy-ownership.json',import.meta.url));
const reference=JSON.parse(bytes);
const ids=game=>game.physicalRecords.map(record=>record.scriptID);
async function scenario(){
  const game=await createFullGame(read('layout'),read('objects'),source,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings});
  const step=ms=>{for(let i=0;i<ms;i++)game.step();};
  game.start();step(2200);
  game.rules.execute('Dim OwnerHeld,OwnerHeldID,OwnerResult1,OwnerResult2:Set OwnerHeld=HellHouse.CreateBall:OwnerHeldID=OwnerHeld.ID');
  game.input('launch',true);step(650);game.input('launch',false);step(400);
  return game;
}

test('DestroyBall matches original VPX ownership and Long result with an unrelated ActiveBall',async()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'7554d1d532e61a2f2867f2a77ab370546fb07c1d2580a1574492d441c392591a');
  assert.equal(reference.native,true);assert.equal(reference.provenance.engineBytesVerified,true);
  assert.equal(reference.provenance.metadata.sourceSha256,read('source-table').sourceTableSHA256);
  assert.equal(reference.provenance.metadata.engineSHA256,read('source-table').engineSHA256);
  assert.deepEqual(reference.errors,[]);
  const game=await scenario();
  try{
    assert.equal(game.rules.value('ActiveBall.ID'),reference.before.active);
    assert.equal(game.rules.value('OwnerHeldID'),reference.before.held);
    assert.deepEqual(ids(game),reference.before.ids);
    game.rules.execute('OwnerResult1=HellHouse.DestroyBall');
    assert.equal(game.rules.value('OwnerResult1'),reference.first.first);
    assert.equal(game.rules.value('VarType(OwnerResult1)'),reference.first.firstType);
    assert.deepEqual(ids(game),reference.first.ids);
    assert.equal(game.captures.has('hellhouse'),false);
    game.rules.execute('OwnerResult2=HellHouse.DestroyBall');
    assert.equal(game.rules.value('OwnerResult2'),reference.second.second);
    assert.equal(game.rules.value('VarType(OwnerResult2)'),reference.second.secondType);
    assert.deepEqual(ids(game),reference.second.ids);
  }finally{game.dispose();}
});

test('an empty drain cannot destroy another kicker’s held ball or the unrelated ActiveBall',async()=>{
  const game=await scenario();
  try{
    const before=ids(game),held=game.captures.get('hellhouse');
    assert.equal(game.captures.has('drain'),false);
    game.rules.execute('OwnerResult1=Drain.DestroyBall');
    assert.equal(game.rules.value('OwnerResult1'),0);
    assert.equal(game.rules.value('VarType(OwnerResult1)'),3);
    assert.deepEqual(ids(game),before);
    assert.equal(game.captures.get('hellhouse'),held);
  }finally{game.dispose();}
});
