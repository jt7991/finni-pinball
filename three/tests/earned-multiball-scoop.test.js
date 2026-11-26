import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {partyChooserScript} from '../../browser/party-chooser.js';
import {createFullGame} from '../full-game.js';
import {mainPlayerSettings,mainScriptBudget} from '../player-settings.js';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import {earnedScoopFields,earnedScoopBooleans,observeEarnedScoop,runEarnedScoop} from '../../scripts/earned-multiball-scoop-scenario.mjs';

for(const version of [
  {name:'6f8116d',file:'vpx-earned-multiball-scoop.json',sha256:'4bb3cec2893a7a77956f926af9bb18d69d01af881140d2c44be602aa2e5a7eae',source:'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5'},
  {name:'cc6f04f',file:'vpx-earned-multiball-scoop-cc6f04f.json',sha256:'c8f54b93489153bfbd1a2cf4b78f15beab804f59cdc9491739f2952a7c2fe459',source:'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997'}
])test(version.name+' physical locks earn multiball and five scoop entries retain one chooser and every original ejection',async()=>{
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const bytes=fs.readFileSync(new URL('fixtures/'+version.file,import.meta.url));
  assert.equal(sha(bytes),version.sha256);
  const native=JSON.parse(bytes);assert.equal(native.native,true);assert.equal(native.engineBytesVerified,true);assert.deepEqual(native.errors,[]);
  assert.equal(native.metadata.sourceSha256,version.source);
  assert.equal(native.metadata.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(native.scenarioSHA256,sha(fs.readFileSync(new URL('../../scripts/earned-multiball-scoop-scenario.mjs',import.meta.url))));
  assert.equal(native.probeSHA256,sha(fs.readFileSync(new URL('../../scripts/probe-earned-multiball-scoop.mjs',import.meta.url))));
  assert.equal(native.partyChooserSHA256,sha(partyChooserScript));
  const assets=nativeSourceAssets(version.source),readJSON=name=>assets.json(name+'.json');
  const source=assets.text('rules.vbs');
  const game=await createFullGame(readJSON('layout'),readJSON('objects'),source,()=>{},undefined,{protectPartyChooser:true,frameAnimations:true,playerSettings:mainPlayerSettings,scriptBudget:mainScriptBudget});
  let ticks=0;
  const advance=count=>{for(let i=0;i<count;i++){game.step();if(++ticks%17===0){game.prepareFrame();game.finishFrame();}}};
  const read=()=>Object.fromEntries(Object.entries(earnedScoopFields).map(([key,expression])=>{
    const value=game.rules.value(expression);
    return[key,key==='ids'?String(value).split(',').filter(Boolean).map(Number):earnedScoopBooleans.has(key)?!!value:Number(value)];
  }));
  try{
    game.start();advance(2200);game.rules.execute(observeEarnedScoop(source));
    game.input('launch',true);advance(650);game.input('launch',false);
    for(let i=0;i<10000&&game.inLane;i++)advance(1);assert.equal(game.inLane,false);
    const result=await runEarnedScoop({read,execute:statement=>game.rules.execute(statement),input:(action,down)=>game.input(action,down),advance,assert});
    assert.equal(native.instrumentation,observeEarnedScoop(source));
    // Compare every observed rule field and public ball identity. The two
    // independent players keep their own clocks and trajectories between shots;
    // timestamps are recorded, not fitted or restored into the other engine.
    const logical=rows=>rows.map(({ms,...row})=>row);
    assert.deepEqual(logical(result.rows),logical(native.rows));
    assert.deepEqual(result.actions.map(({ms,...action})=>action),native.actions.map(({ms,...action})=>action));
    assert.deepEqual(result.rows.map(r=>[r.phase,r.hole,r.scoopKicks,r.starts]),[
      ['launched',0,0,0],['lock-1',0,0,0],['lock-2',0,0,0],['lock-3',0,0,0],
      ['earned-multiball',0,0,0],['chooser-holds-three',3,0,0],['confirmed-once',3,0,1],
      ['authored-delay',3,0,1],['released-three',0,3,1],['active-mode-holds-two',2,3,1],['active-mode-released',0,5,1]
    ]);
    // Qualification is earned by collisions, rather than assignments or direct
    // rule callbacks. Only declared pose inputs and original keys are supplied.
    for(const action of result.actions)assert.doesNotMatch(action.statement??'',/\b(?:bNinjaMB|bMultiBallMode|bChooseBattle|bBattleReady|BallsInHole|BallsOnPlayfield|LifeLeft|Battle|Dead|Pool|EarnedQ(?:LockReleases|ScoopHits|ScoopKicks|Starts))\s*(?:\([^)]*\))?\s*=|\b(?:CreateNewBall|AddMultiball|StartBattle|StartChooseBattle|\w+_Hit|Randomize)\b/i);
  }finally{game.dispose();}
});
