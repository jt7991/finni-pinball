import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createFullGame} from '../full-game.js';
import {mainPlayerSettings} from '../player-settings.js';
import {creationQueries,kickerCreationStatement,verifyCreationCase} from '../../scripts/kicker-creation-scenario.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const bytes=fs.readFileSync(new URL('fixtures/vpx-kicker-creation.json',import.meta.url)),fixture=JSON.parse(bytes);
for(const reference of fixture.cases)test('occupied kicker retains original VPX creation and release semantics: '+reference.order,async()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'39f72d26601a5968198a141d50de371a4a5d43fd8e8b1430f1a0a4feff8698b0');
  assert.equal(fixture.native,true);assert.equal(fixture.provenance.engineBytesVerified,true);
  assert.deepEqual(fixture.errors,[]);
  assert.equal(fixture.provenance.metadata.engineSHA256,read('source-table').engineSHA256);
  assert.equal(fixture.provenance.metadata.sourceSha256,read('source-table').sourceTableSHA256);
  const statement=kickerCreationStatement(reference.order);
  assert.equal(statement,reference.statement);
  assert.equal(createHash('sha256').update(statement).digest('hex'),reference.statementSHA256);
  const game=await createFullGame(read('layout'),read('objects'),source,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings});
  try{
    game.start();for(let ms=0;ms<2200;ms++)game.step();
    game.rules.execute(statement);
    const row={order:reference.order,values:Object.fromEntries(creationQueries.map(name=>[name,game.rules.value(name)]))};
    const {before,final}=verifyCreationCase(row,assert);
    assert.deepEqual(row.values,reference.values,'all immediate native script observations agree');
    assert.equal(game.captures.has('hellhouse'),false);
    assert.equal(game.kickers.find(k=>k.key==='hellhouse').captured,null);
    assert.deepEqual(game.physicalRecords.map(r=>r.scriptID),final.ids);
    assert.equal(game.records.find(r=>r.scriptID===before.second[0]).held,null,'new ball remains physically free');
    if(reference.order==='kick-destroy')assert.equal(game.records.find(r=>r.scriptID===before.first[0]).held,null,'original captured ball was released rather than orphaned');
  }finally{game.dispose();}
});
