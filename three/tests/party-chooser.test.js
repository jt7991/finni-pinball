import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createRules}from'../rules.js';import{createFullGame}from'../full-game.js';import{partyChooserScript}from'../../browser/party-chooser.js';
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),sub=name=>source.match(new RegExp('^Sub '+name+'\\b[^\\n]*[\\s\\S]*?^End Sub','mi'))[0];
test('the shared correction retains all seven authored chooser images, messages and voices',()=>{
 const selection=code=>code.match(/Select Case Battlenr[\s\S]*?End Select/i)[0].replaceAll('\r\n','\n');assert.equal(selection(partyChooserScript),selection(sub('UpdateDMDBattle')));
});
function chooser(){
 const harness=`Dim Battle(4,7),LifeLeft(4,7),CurrentPlayer,Battlenr,BattlesToChoose,BattlesWon(4),bChooseBattle,LastImage,Prompts,Starts,i,BallsInHole
 Const LeftFlipperKey=42,RightFlipperKey=54,PlungerKey=28,StartGameKey=2,LockBarKey=57,eNone=0
 Sub DMD(a,b,c,d,e,f,g,h,j)
  LastImage=c
  If Right(c,7)="_select" Then Prompts=Prompts+1
 End Sub
 Sub DMDFlush
 End Sub
 Function CL(a,b)
  CL=b
 End Function
 Function RL(a,b)
  RL=b
 End Function
 Function ShowLife(n)
  ShowLife=CStr(n)
 End Function
 Sub StartBattle(n)
  Starts=Starts+1:Battle(CurrentPlayer,0)=n
 End Sub
 CurrentPlayer=1:Battlenr=1:BattlesToChoose=3:Prompts=0:Starts=0
 For i=1 To 7:LifeLeft(1,i)=10:Next
 `;
 const rules=createRules([harness,...['NextPartyTask','StartChooseBattle','ChooseBattle','UpdateDMDBattle'].map(sub)].join('\n'),{objects:[{name:'PulseTimer',kind:'Timer',timer_interval:40}],collections:[]});rules.execute(partyChooserScript);return rules;
}
const ticks=(r,n)=>{for(let i=0;i<n;i++)r.tick(.04);};
test('fast confirmation and repeated confirm keys cannot reopen or redraw the chooser',()=>{
 const r=chooser();try{r.run('StartChooseBattle');r.run('ChooseBattle',54);assert.equal(r.value('Prompts'),1);r.run('ChooseBattle',57);assert.equal(r.value('Starts'),1);
  // Real key handlers call ChooseBattle only while choosing. The deferred
  // callback must respect that same boundary after confirmation.
  r.run('StartChooseBattle');ticks(r,80);assert.equal(r.value('bChooseBattle'),false);assert.equal(r.value('Starts'),1);assert.equal(r.value('Battle(1,0)'),2);assert.equal(r.value('Prompts'),1);
 }finally{r.engine.destroy();}
});
test('the delayed intro never repeats a selection already displayed by flippers',()=>{
 const r=chooser();try{r.run('StartChooseBattle');r.run('ChooseBattle',54);for(let i=0;i<50;i++)r.run('UpdateDMDBattle');assert.equal(r.value('Prompts'),1);ticks(r,55);assert.equal(r.value('Prompts'),1);assert.equal(r.value('bChooseBattle'),true);
  r.run('ChooseBattle',54);assert.equal(r.value('Prompts'),2);assert.equal(r.value('Battlenr'),3);
 }finally{r.engine.destroy();}
});
test('an old chooser callback cannot cut short a later chooser intro; idle selection still appears',()=>{
 const r=chooser();try{r.run('StartChooseBattle');ticks(r,25);r.execute('bChooseBattle=False');r.run('StartChooseBattle');ticks(r,25);assert.equal(r.value('Prompts'),0);assert.equal(r.value('LastImage'),'d_finni_choose');ticks(r,26);assert.equal(r.value('Prompts'),1);assert.equal(r.value('LastImage'),'d_finni_presents_select');
 }finally{r.engine.destroy();}
});
test('physical scoop entry plus sixty rapid control presses starts one mode and never returns to selection',async()=>{
 const instrumented='Dim RefChooserStarts\nRefChooserStarts=0\n'+source.replace(/^Sub StartBattle\(n\)\r?$/m,'Sub StartBattle(n)\n RefChooserStarts=RefChooserStarts+1'),read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url))),g=await createFullGame(read('layout'),read('objects'),instrumented,()=>{},undefined,{protectPartyChooser:true});
 const step=n=>{for(let i=0;i<n;i++){g.step();if(Math.round(g.time*1000)%17===0)g.prepareFrame();}};
 try{g.start();step(2200);const rec=g.records[0];for(const[k,v]of Object.entries({x:293.68433,y:530,z:25,velx:0,vely:-8,velz:0}))rec.proxy.setProperty(k,{type:'Single',value:v});for(let i=0;i<1000&&!g.rules.value('bChooseBattle');i++)step(1);assert.equal(g.rules.value('bChooseBattle'),true);
  for(let i=0;i<30;i++){const action=i%2?'left':'right';g.input(action,true);g.input(action,false);}for(let i=0;i<30;i++){g.input('action',true);g.input('action',false);}const selected=g.rules.value('Battle(1,0)');assert.ok(selected>0);step(2200);
  assert.equal(g.rules.value('RefChooserStarts'),1);assert.equal(g.rules.value('Battle(1,0)'),selected);assert.equal(g.rules.value('bChooseBattle'),false);assert.doesNotMatch(g.rules.value('dqText(2,dqHead)'),/_select$/);assert.doesNotMatch(g.rules.value('dLine(2)'),/_select(?:_|$)/);
 }finally{g.dispose();}
});
