import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createRules} from '../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-vpm-timers-native.json',import.meta.url)));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
test('native core timer pulses retain delay quantization, callback order, nested additions, idle queue and capacity',()=>{
 const callbacks=[],source=fixture.declarations.replace(/Debug.Print "VPM_EVENT\|callback\|" & GameTime & "\|" & label/,'PlaySound label').replace(/Sub PulseTimer_Timer[\s\S]*?End Sub/,''),r=createRules(source,{objects:[{name:'PulseTimer',kind:'Timer',timer_interval:50,is_timer_enabled:true}],collections:[]},{sound:label=>callbacks.push({phase:'callback',ms:Math.round(r.time*1000),label})});
 const inputs=new Map(fixture.events.filter(row=>row.phase==='input').map(row=>[row.ms,row.label]));
 for(let ms=1;ms<=fixture.events.at(-1).ms;ms++){
  r.tick(.001);const input=inputs.get(ms);
  if(input==='batch')r.execute([...fixture.delays.map(delay=>`vpmtimer.addtimer ${delay},"RefVpmObserve ""d${delay}"" '"`),'vpmtimer.addtimer 40,"RefVpmParent \'"'].join(':'));
  if(input==='after-idle')r.execute('vpmtimer.addtimer 80,"RefVpmObserve ""after-idle"" \'"');
  if(input==='function')r.execute('vpmtimer.addtimer2 80,GetRef("RefVpmFunction"),37');
  if(input==='capacity')r.execute('For RefVpmIndex=1 To 51:vpmtimer.addtimer 40,"RefVpmObserve ""cap" & RefVpmIndex & """ \'":Next');
 }
 assert.deepEqual(callbacks,fixture.events.filter(row=>row.phase==='callback'));assert.equal(r.engine.error,null);assert.equal(r.objects.get('pulsetimer').interval,40);
});
