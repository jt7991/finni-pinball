import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createRules} from '../rules.js';
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const specs=JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url)));
const ball={x:500,y:1000,z:25,velx:0,vely:0,velz:0};
test('native collection events receive member index and ActiveBall before optional individual events',()=>{
  const eventSource=`Dim EventTrace
Sub GateSounds_Hit(idx)
 EventTrace=EventTrace & "group" & idx & ":" & ActiveBall.X & ";"
End Sub
Sub Gate002_Hit()
 EventTrace=EventTrace & "single;"
End Sub`;
  for(const stop of [false,true]){
    const r=createRules(eventSource,{objects:[{name:'Gate001',kind:'Gate'},{name:'Gate002',kind:'Gate'}],collections:[{name:'GateSounds',items:['Gate001','Gate002'],fire_events:true,stop_single_events:stop}]});
    r.execute('EventTrace=""');r.hit('Gate002','Hit',new Proxy({x:321},{get:(target,key)=>target[String(key).toLowerCase()]}));
    assert.equal(r.value('EventTrace'),'group1:321;'+(stop?'':'single;'));
  }
});
function setup(){const r=createRules(source,specs,{createBall:()=>ball});r.init();r.key('start',true);for(let i=0;i<100;i++)r.tick(.02);return r;}
test('original startup, four players, skill shot and DMD timers execute',()=>{
  const r=setup();assert.equal(r.value('CurrentPlayer'),1);assert.equal(r.value('BallsOnPlayfield'),1);
  for(let i=0;i<3;i++)r.key('start',true);assert.equal(r.value('PlayersPlayingGame'),4);
  r.hit('swPlungerRest');r.hit('swPlungerRest','UnHit');
  r.hit('Trigger006','Hit',ball);
  for(let i=0;i<1000;i++)r.tick(.02);
  assert.ok(r.value('Score(1)')>0);
});
for(let mode=1;mode<=7;mode++)test(`original mission ${mode} initializes, progresses, completes and awards scoop jackpot`,()=>{
  const r=setup();r.execute('bBattleReady=False');r.run('StartBattle',mode);assert.equal(r.value('Battle(1,0)'),mode);
  r.execute(`LifeLeft(1,${mode})=0.1`);r.run('CheckBattle');
  if(mode!==7)assert.equal(r.value(`Battle(1,${mode})`),1);
  assert.equal(r.value('bEndBattleJackpot'),true);
  r.hit('HellHouse','Hit',ball);for(let i=0;i<200;i++)r.tick(.02);
  assert.ok(r.value('Score(1)')>=3000000);
});
test('three original virtual locks qualify Friendship multiball',()=>{
  const r=setup();for(let i=0;i<3;i++)r.hit('lock','Hit',ball);
  assert.equal(r.value('bNinjaMB'),true);assert.equal(r.value('BallsInLock(1)'),0);
  for(let i=0;i<600;i++){r.execute('bBallInPlungerLane=False');r.tick(.02);}
  assert.ok(r.value('BallsOnPlayfield')>=3);
});
test('all authored shot and target handlers run against initialized rules',()=>{
  const r=setup();
  for(const name of ['Bumper1','Bumper2','Bumper3',...Array.from({length:17},(_,i)=>`Trigger${String(i+1).padStart(3,'0')}`),...Array.from({length:14},(_,i)=>`Target${String(i+1).padStart(3,'0')}`)]){
    r.hit(name,/Target00[9]$|Target01[01]$/.test(name)?'Dropped':'Hit',ball);
  }
  r.hit('Spinner001','Spin',ball);r.hit('Spinner002','Spin',ball);
  for(let i=0;i<500;i++)r.tick(.02);
  assert.ok(r.value('Score(1)')>0);
});
test('Cake Time, Disco, supplies multiball and timed features retain their rules',()=>{
  const r=setup();
  r.execute('LilDPHits=LilDPHitsNeeded(1)-1');r.run('LilDPCheckHits');assert.equal(r.value('bLilDPMB'),true);
  r.run('StopLilDPMB');
  r.execute('LeftSpinnerCount(1)=100');r.run('CheckDisco');assert.equal(r.value('bDiscoMBEnabled'),true);
  r.run('StopDiscoMB');r.run('StartMechSuitMB');assert.equal(r.value('bMechSuitMBStarted'),true);
  r.run('StopMechSuitMB');r.run('StartBerserker');assert.equal(r.value('bBerserker'),true);
  r.run('StartKatanarama');assert.equal(r.value('bKatanaramaTime'),true);
  r.run('ChooseMysteryAward');r.run('AwardExtraBall');assert.ok(r.value('ExtraBallsAwards(1)')>0);
  r.run('StopBerserker');r.run('StopKatanarama');
  for(let i=0;i<1000;i++)r.tick(.02);
});
test('animated DMD assignments resolve to installed sprites',()=>{
  const atlas=JSON.parse(fs.readFileSync(new URL('../public/dmd-atlas.json',import.meta.url)));
  const r=setup(),missing=new Set();
  for(let mode=1;mode<=7;mode++){
    r.run('StartBattle',mode);
    for(let i=0;i<200;i++){
      r.tick(.02);
      for(let j=1;j<=41;j++){
        const name=String(r.objects.get(`digit${String(j).padStart(3,'0')}`).imagea).toLowerCase();
        if(name&&!atlas[name])missing.add(name);
      }
    }
    r.run('StopBattle');
  }
  assert.deepEqual([...missing],[]);
});
test('object arguments remain callable after Option Explicit, including ramp assists',()=>{
  const r=setup(),ball=new Proxy({x:270,y:313.75,z:40,velx:-15,vely:-15,velz:0},{
    get:(target,key)=>target[String(key).toLowerCase()],
    set:(target,key,value)=>{target[String(key).toLowerCase()]=value;return true;},
  });
  r.run('FinniLockRampAssist',ball);
  assert.ok(Math.hypot(ball.velx,ball.vely)>=23.9);
  r.run('OnBallBallCollision',ball,{...ball,x:280},3);
});
test('lowercase native sound calls work throughout initials entry and commit',()=>{
  const r=setup();r.execute('HighScoreEntryInit');
  r.key('right',true);
  for(let i=0;i<3;i++)r.key('launch',true);
  assert.equal(r.value('hsbModeActive'),false);
});
test('live-catch elasticity lasts ten milliseconds rather than ten physics frames',()=>{
  const r=setup();
  r.execute('LeftFlipper.StartAngle=120:LeftFlipper.EndAngle=68:LeftFlipper.CurrentAngle=68:LeftFlipperOn=1:LLiveCatchTimer=0');
  r.tick(.004);assert.equal(r.objects.get('leftflipper').elasticity,0);
  r.tick(.008);assert.equal(r.objects.get('leftflipper').elasticity,.6);
  assert.equal(r.value('LLiveCatchTimer'),10);
});

test('the authored Cake spinner timeout disables its own timer through the bound event object',()=>{
  const r=setup();r.execute('bLilDPMB=True:LilDPSpinner.Interval=1:LilDPSpinner.Enabled=True');
  assert.equal(r.objects.get('lildpspinner').enabled,true);r.tick(.002);
  assert.equal(r.objects.get('lildpspinner').enabled,false);
  assert.equal(r.value('VarType(LilDPSpinner.Enabled)'),11,'native timer getters return a Boolean Variant');
});
