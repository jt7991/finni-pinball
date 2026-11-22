// Compare the complete worker publication payload with and without property
// revision reuse. No physics steps, callbacks or published fields are omitted.
import fs from 'node:fs';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';import {createFullGame} from '../three/full-game.js';import {snapshotGame} from '../three/game-snapshot.js';
const json=name=>JSON.parse(fs.readFileSync('three/public/'+name+'.json')),game=await createFullGame(json('layout'),json('objects'),fs.readFileSync('three/public/rules.vbs','utf8'),()=>{},undefined,{frameAnimations:true}),names=new Set(game.rules.objects.keys()),queries=new Set(['bChooseBattle']),revision=game.rules.snapshotRevision,baseline=new Map(),candidate=new Map(),phases=[];
const snapshot=(reuse,previous)=>{game.rules.snapshotRevision=reuse?revision:undefined;try{return structuredClone(snapshotGame(game,names,queries,previous));}finally{game.rules.snapshotRevision=revision;}};
const compare=name=>{const expected=snapshot(false,baseline),actual=snapshot(true,candidate);assert.deepEqual(actual,expected,name);phases.push({name,changedObjects:actual.objects.length,fields:actual.objects.reduce((n,[,state])=>n+Object.keys(state).length,0)});};
try{
 compare('initial');compare('unchanged');game.start();for(let i=0;i<2100;i++)game.step();game.prepareFrame();compare('ordinary start');
 game.rules.execute('Primitive077.RotX=17:Primitive077.Visible=False:digit001.ImageA="d_7":LightShootAgain.IntensityScale=0.37');compare('authored script setters');
 for(let i=0;i<17;i++)game.step();game.prepareFrame();compare('lamp fade and frame animation');
 Object.assign(game.visualMotions.get('bumper1'),{ringOffset:-6,rotx:5,roty:-3});game.targetMotions.get('target010').setDropped(true);compare('native mechanism getters change without object setters');
 for(const sequence of game.rules.sequences.values())sequence.stop();compare('sequencer state');compare('repeated unchanged');
 const reports=[];for(const reuse of [false,true]){const previous=new Map();snapshot(reuse,previous);const count=1000,start=performance.now();for(let i=0;i<count;i++)snapshot(reuse,previous);reports.push({reuse,count,milliseconds:performance.now()-start});}
 const report={objects:names.size,phases,reports,scope:'Same live game and identical complete snapshot payloads. Timing measures paused publication work only, not phone FPS or native-gameplay parity.'};fs.mkdirSync('.work/three-review',{recursive:true});fs.writeFileSync('.work/three-review/snapshot-revision-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{game.rules.snapshotRevision=revision;game.dispose();}
