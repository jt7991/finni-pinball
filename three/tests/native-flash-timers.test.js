import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createRules} from '../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-flash-timers-native.json',import.meta.url))),authored=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),wrapper=authored.match(/^Sub FlashForMs\([\s\S]*?^End Sub/gmi)[0];
assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(createHash('sha256').update(fixture.originalHelper).digest('hex'),fixture.helperSHA256);
for(const c of fixture.cases)test('authored FlashForMs native timers: '+c.name,()=>{
 const isLamp=c.kind==='light',name=isLamp?'li044':'Flasher007',r=createRules(wrapper,{objects:[{name,kind:isLamp?'Light':'Flasher',state:c.initial,is_visible:!!c.initial,intensity:3.5,fade_speed_up:.1,fade_speed_down:.1,blink_pattern:'10'}],collections:[]}),object=r.objects.get(name.toLowerCase()),lamp=r.lamps.get(name.toLowerCase()),first=c.events[0].values[0],observedTicks=[];
 let now=first;r.tick(first/1000);
 if(isLamp)r.execute(`${name}.State=${c.initial}:${name}.Intensity=3.5:${name}.IntensityScale=1:${name}.FadeSpeedUp=0.1:${name}.FadeSpeedDown=0.1:${name}.BlinkPattern="10"`);
 const flash=input=>r.execute(`FlashForMs ${name},${input.total},${input.period},${input.final}`);
 flash(c);
 for(const row of c.events){
  while(now<row.values[0]){const previous=object.uservalue;r.tick(.001);now++;if(!isLamp&&object.uservalue!==previous)observedTicks.push(now);}
  if(row.phase==='restart')flash(c.restart);
  if(isLamp&&row.phase==='frame')lamp.update(row.values[5]);
  const actual=isLamp?[now,object.state,object.blinkinterval,object.inplayintensity,Number(object.inplayon)]:[now,Number(object.visible),object.uservalue,object.timerinterval,Number(!!object.timerenabled)];
  const expected=row.values.slice(0,actual.length);if(isLamp)expected[3]=Math.fround(expected[3]);
  assert.deepEqual(actual,expected,`${c.name} ${row.phase} at ${row.ms}ms`);
 }
 if(!isLamp)assert.deepEqual(observedTicks,c.events.filter(row=>row.phase==='timer').map(row=>row.values[0]),'all callback times, including the restart phase and zero-step source edge');
 assert.equal(r.engine.error,null);
});
