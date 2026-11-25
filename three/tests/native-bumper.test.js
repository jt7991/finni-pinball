import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {collideNativeBumper} from '../native-bumper.js';
import {createFullGame} from '../full-game.js';
import {nativePitchFactor,nativeSoundRate} from '../native-sound.js';
import {withAudio} from './helpers/audio-public-host.js';

test('fourteen native bumper recordings retain kicks, clocks, live settings, scores, spin and physics RNG',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-bumpers.mjs','three/tests/fixtures/vpx-bumpers-native-state.json','--check','--json','--report=.work/three-review/bumper-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:3*1024*1024}));
  assert.equal(reports.length,14);assert.ok(reports.reduce((sum,r)=>sum+r.nativeRandomAudit.length,0)>1400);
  for(const report of reports)assert.ok(report.nativeRandomAudit.every(row=>row.agrees),report.name+' native physics RNG');
  const repeat=reports.find(r=>r.name==='Bumper1-repeat');assert.equal(repeat.events.length,2);assert.ok(repeat.events[1].ms-repeat.events[0].ms<100);assert.equal(repeat.samples.at(-1).actual[12],2000);
});

test('bumper force is a velocity increment for every ball mass; native event flags and thresholds control the kick',()=>{
  const impact=(mass,overrides={})=>{
    let ball={p:{x:0,y:0,z:25},v:{x:-2,y:0,z:0},m:{x:0,y:0,z:0},inertia:250*mass,mass},events=0;
    const native={snapshot:()=>structuredClone(ball),commit:value=>{ball=value;}},bumper={force:10,threshold:1,hit_event:true,...overrides};
    collideNativeBumper({native},{normal:{x:1,y:0,z:0},gap:0},bumper,{elasticity:.3,elasticity_falloff:0,friction:.3,scatter:0,difficulty:1},.25,()=>{throw Error('zero scatter should not draw');},()=>events++);
    return {speed:ball.v.x,events};
  };
  assert.deepEqual(impact(1),impact(2));assert.equal(impact(1).events,1);assert.ok(Math.abs(impact(1).speed-10.6)<1e-6);
  for(const settings of [{hit_event:false},{threshold:100}]){const result=impact(1,settings);assert.equal(result.events,0);assert.ok(Math.abs(result.speed-.6)<1e-6);}
});

test('authored sound pitch shares physics randomness, and live bumper properties remain local to their game',async()=>{
  const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url))),layout=json('layout'),specs=json('objects'),original=JSON.stringify(layout),sounds=[];
  const game=await createFullGame(layout,specs,fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{},{play:(...args)=>sounds.push(args),stop:()=>{}});
  try{
    let draws=0;game.random=()=>{draws++;return draws%2?.5:.25;};
    game.rules.execute('PlaySound "fx_bumper",0,0.8,0.1,0.2,100,True,False,0.3');
    assert.equal(draws,2);const [name,settings]=sounds.at(-1);assert.equal(name,'fx_bumper');assert.equal(settings.pitch,100);assert.equal(settings.randomPitch,.2);assert.equal(settings.useExisting,true);assert.equal(settings.frontRearFade,.3);
    assert.ok(Math.abs(settings.pitchFactor-1.04375)<1e-7);
    game.rules.execute('PlaySound "unknown-native-sound",0,1,0,0.2:PlaySound "fx_bumper",0,1,0,0');assert.equal(draws,2,'missing sounds and zero variation do not draw');
    game.rules.execute('Bumper1.Threshold=100:Bumper1.Force=4:Bumper1.HasHitEvent=False:Bumper1.Collidable=False');
    const state=game.nativeBumpers.get('bumper1');assert.equal(state.bumper.force,4);assert.equal(state.bumper.threshold,100);assert.equal(state.bumper.hit_event,false);assert.equal(state.collider.isEnabled(),false);
    assert.equal(game.rules.value('Bumper1.HasHitEvent'),false);assert.equal(game.rules.value('Bumper1.Force'),4);assert.equal(JSON.stringify(layout),original,'runtime writes must not mutate shared source settings');
  }finally{game.dispose();}
});

test('native pitch consumes two draws in order and rounds COM pitch offsets to even',()=>{
  const values=[.5,.25];assert.ok(Math.abs(nativePitchFactor(.2,()=>values.shift())-1.04375)<1e-7);assert.equal(values.length,0);
  assert.equal(nativePitchFactor(0,()=>{throw Error('unexpected draw');}),1);
  assert.equal(nativeSoundRate(22050,11025,1),1.5);assert.equal(nativeSoundRate(100,2.5,1),Math.fround(1.02));assert.equal(nativeSoundRate(100,3.5,1),Math.fround(1.04));
});

test('shared native audio preserves source rate and updates an existing pitched loop',()=>withAudio(async({audio,tick,stats,requests,responses})=>{
 await audio.play('effect',{loop:-1,useExisting:true,pitch:11025,pitchFactor:1.05});await tick(2);
 const first=requests.find(r=>r.type==='play-effect');assert.equal(first.source.rate,22050);assert.equal(first.settings.pitch,11025);assert.equal(first.settings.pitchFactor,1.05);
 await audio.play('effect',{loop:-1,useExisting:true,pitch:0,pitchFactor:1});await tick(2);assert.equal((await stats()).players,1);
 const plays=responses.flatMap(r=>r.applied??[]).filter(c=>c.type==='play');assert.equal(plays[0].playerID,plays[1].playerID,'The original player remains attached while pitch changes');
}));
