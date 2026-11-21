import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{LightAnimation,nativeColor}from'../light-animation.js';import{createRules}from'../rules.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/vpx-lamp-animation-native.json.gz',import.meta.url))));
test('every authored lamp configuration matches native fade, blink, duration, overrides and Animate events',()=>{
  assert.equal(fixture.cases.length,159);let frames=0;
  for(const c of fixture.cases){
    let now=0,events=0;const lamp=new LightAnimation(c.spec,()=>now,()=>events++);
    for(const frame of c.frames){
      now=frame.time;
      for(const [op,...args]of frame.actions){
        if(op==='state')lamp.setState(...args);else if(op==='lock'){lamp.setLocked(args[0]);if(args[0])lamp.setInPlay(args[1]);}
        else if(op==='pattern')lamp.setPattern(...args);else if(op==='interval')lamp.setInterval(...args);else if(op==='intensity')lamp.setIntensity(...args);else if(op==='scale')lamp.setScale(...args);else if(op==='duration')lamp.setDuration(...args);else lamp[op]=Math.fround(args[0]);
      }
      lamp.update(frame.delta);frames++;
      assert.deepEqual({state:lamp.getState(),inplay:lamp.inplay,intensity:lamp.intensity,index:lamp.index,next:lamp.next,duration:lamp.duration,end:lamp.end,events,on:lamp.level()!==0},frame.expected,`${c.spec.name} at ${now}ms`);
    }
  }
  assert.equal(frames,20670);
});
test('VBScript controls native lamp clocks, intensity scale, integer colors and animation callbacks',()=>{
  const r=createRules(`Dim Animations\nSub Lamp_Animate()\n Animations=Animations+1\nEnd Sub`,{objects:[{kind:'Light',name:'Lamp',state:0,intensity:10,fade_speed_up:1,fade_speed_down:.5,blink_interval:125,color:'#204060',color2:'#123456'}],collections:[]}),lamp=r.lamps.get('lamp');
  assert.equal(r.value('Lamp.Color'),nativeColor('#204060'));assert.equal(r.value('Lamp.ColorFull'),0x563412);
  r.execute('Animations=0:Lamp.IntensityScale=2:Lamp.State=0.5');r.tick(.007);lamp.update(7);assert.equal(r.objects.get('lamp').inplayintensity,7);assert.equal(r.value('Animations'),1);
  r.tick(.007);lamp.update(7);assert.equal(r.value('Lamp.GetInPlayIntensity()'),10);assert.equal(r.value('Lamp.GetInPlayState()'),.5);
  r.execute('Lamp.BlinkPattern="000000100000":Lamp.BlinkInterval=125:Lamp.State=2');r.tick(.017);lamp.update(17);assert.equal(lamp.index,1);assert.equal(r.value('Lamp.GetInPlayStateBool()'),false);
  r.execute('Lamp.Color=RGB(255,0,128):Lamp.IntensityScale=3');assert.equal(r.value('Lamp.Color'),0x8000ff);assert.equal(lamp.scale,3);
  r.execute('Lamp.Duration 1,50,0');r.tick(.05);lamp.update(50);assert.equal(r.value('Lamp.State'),1,'native duration expires strictly after the end clock');r.tick(.001);lamp.update(1);assert.equal(r.value('Lamp.State'),0);
});
