import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {collideNativeFlipper} from '../native-flipper-contact.js';
import {createRules} from '../rules.js';

test('twenty-four native flipper recordings retain face/base/tip events, impact-speed arguments, idle suppression and moving shots',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-flipper-events.mjs','--check','--json','--report=.work/three-review/flipper-events-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:6*1024*1024}));
  assert.equal(reports.length,24);assert.ok(reports.reduce((sum,r)=>sum+r.nativeRandomAudit.length,0)>4800);
  for(const report of reports){
    assert.ok(report.nativeRandomAudit.every(row=>row.agrees),report.name+' physics RNG');
    assert.equal(report.events.length,report.name.endsWith('quiet')?0:report.name.endsWith('repeat-500')?2:1,report.name);
    for(const event of report.events)assert.equal(event.parameters.length,event.event==='Collide'?1:0);
  }
});

test('flipper event idle time belongs to the flipper and every resolved collision renews it',()=>{
  const flipper={p:{x:0,y:21.15},contactTorque:0,nativeMotion:{speed:0,inertia:4000,nativeImpulse(){}}},events=[];
  const body=()=>{
    let ball={p:{x:50,y:50,z:25},v:{x:0,y:2,z:0},m:{x:0,y:0,z:0},mass:1,inertia:250};
    return {native:{snapshot:()=>structuredClone(ball),commit:value=>{ball=value;}},reset:speed=>{ball.v={x:0,y:speed,z:0};}};
  };
  const a=body(),b=body(),material={elasticity:.8,elasticity_falloff:0,friction:0},attempt=(ball,ms,speed=2,base=false)=>{
    ball.reset(speed);return collideNativeFlipper(ball,flipper,{normal:{x:0,y:1,z:0},gap:0,hitMomentBit:base},material,.25,ms,(event,value)=>events.push({ms,event,value}));
  };
  attempt(a,250);assert.equal(events.length,0,'250ms is still suppressed');attempt(a,501);assert.deepEqual(events,[{ms:501,event:'Collide',value:2}]);
  attempt(b,650,.2);assert.equal(flipper.lastCollisionMs,650,'quiet second-ball impact renews the shared clock');
  attempt(a,900);assert.equal(events.length,1,'renewing contact at exactly 250ms remains suppressed');
  attempt(a,1151);attempt(b,1402,2,true);assert.deepEqual(events.slice(1),[{ms:1151,event:'Collide',value:2},{ms:1402,event:'Hit',value:undefined}]);
  assert.equal(attempt(a,1500,-2),false);assert.equal(flipper.lastCollisionMs,1402,'receding non-collision does not renew the clock');
});

test('parameterized flipper Collide dispatch passes native speed and ActiveBall directly despite collection suppression',()=>{
  const source=`Dim Result
Sub Flippers_Collide(index)
 Result="unexpected collection"
End Sub
Sub LeftFlipper_Collide(speed)
 Result=CStr(speed) & ":" & CStr(ActiveBall.X)
End Sub`;
  const rules=createRules(source,{objects:[{name:'LeftFlipper',kind:'Flipper'}],collections:[{name:'Flippers',items:['LeftFlipper'],fire_events:true,stop_single_events:true}]});
  rules.hit('LeftFlipper','Collide',new Proxy({x:321},{get:(target,key)=>target[String(key).toLowerCase()]}),12.5);
  assert.equal(rules.value('Result'),'12.5:321');
});
