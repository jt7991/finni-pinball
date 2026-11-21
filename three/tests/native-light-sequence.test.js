import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';
import{LightSequence,SEQ}from'../light-sequence.js';import{nativeRandom}from'../native-random.js';import{createRules}from'../rules.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/vpx-lightseq-native-state.json.gz',import.meta.url))));

test('all native sequence patterns, frame catch-up, lamp locks and MWC progression match compiled VPX',()=>{
  assert.equal(fixture.cases.length,90);let frames=0;
  for(const c of fixture.cases){
    const random=nativeRandom(...fixture.seed);let events=0;
    const elements=fixture.points.map(([x,y],i)=>({spec:{kind:'Light'},state:{x:x*20,y:y*20,state:fixture.states[i],sequenceactive:false,sequencestate:0}}));
    const seq=new LightSequence({pos_x:450,pos_y:1250,update_interval:c.rate},elements,{random,onDone:()=>events++});
    seq.play(c.animation,c.tail,c.repeat,c.pause);
    for(const frame of c.frames){
      seq.update(frame.time);frames++;
      assert.deepEqual({time:frame.time,lights:elements.map(e=>[e.state.sequenceactive?e.state.sequencestate:e.state.state,e.state.sequenceactive?1:0]),playing:seq.playing,pause:seq.paused,next:seq.next,events,rng:random.getState()},frame,`native effect ${c.animation} at ${frame.time}ms`);
    }
  }
  assert.equal(frames,16282);
});

test('authored sequencers expose native constants, omitted arguments, immediate overrides and the saved script state',()=>{
  const source=`Dim Completions
Sub Seq_PlayDone()
 Completions=Completions+1
End Sub`;
  const objects=[{name:'Lamp',kind:'Light',center:{x:40,y:40},state:2},{name:'Seq',kind:'LightSequencer',collection:'Lamps',pos_x:450,pos_y:1250,update_interval:25}];
  const rules=createRules(source,{objects,collections:[{name:'Lamps',items:['Lamp']}]},{random:nativeRandom(123456789,987654321)}),lamp=rules.objects.get('lamp'),seq=rules.sequences.get('seq');
  assert.equal(rules.value('SeqRandom'),1003);assert.equal(rules.value('SeqStripe2VertOn'),31);
  rules.execute('Completions=0:Seq.Play SeqAllOff');assert.equal(lamp.sequenceactive,true);assert.equal(lamp.sequencestate,0);assert.equal(rules.value('Lamp.State'),2);assert.equal(seq.queue.length,0);
  rules.execute('Lamp.State=1:Seq.StopPlay');assert.equal(lamp.sequenceactive,false);assert.equal(lamp.state,1);
  rules.execute('Seq.UpdateInterval=20:Seq.Play SeqBlinking,,2,10:Seq.UpdateInterval=3:Seq.Play SeqDownOn,25,3');
  assert.deepEqual(seq.queue,[{animation:1002,tail:0,repeat:2,pause:10,rate:20},{animation:3,tail:25,repeat:3,pause:0,rate:3}]);
  assert.equal(seq.centerX,450);assert.equal(seq.centerY,1250);
  // Rules/physics ticks do not create render frames or consume sequence RNG.
  for(let i=0;i<100;i++)rules.tick(.001);assert.equal(seq.playing,false);
  for(let time=100;time<10000;time+=17)seq.update(time);
  assert.equal(rules.value('Completions'),1);assert.equal(lamp.sequenceactive,false);
});

test('native queue overflow, captured update rates and mixed Light/Flasher/Primitive overrides',()=>{
  const recording=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/vpx-lightseq-native-queue.json.gz',import.meta.url))));let frames=0;
  for(const c of recording.cases){
    const random=nativeRandom(...recording.seed);let events=0;
    const elements=recording.points.map(([x,y],i)=>({spec:{kind:recording.kinds[i]},state:{x:x*20,y:y*20,state:recording.states[i],visible:!!recording.states[i],sequenceactive:false,sequencestate:recording.states[i]}}));
    const seq=new LightSequence({pos_x:450,pos_y:1250},elements,{random,onDone:()=>events++});
    for(const frame of c.frames){
      for(const [op,args,result]of frame.actions){
        if(op==='interval')seq.updateInterval=Math.max(1,args[0]);
        else if(op==='set')elements[args[0]].state.state=args[1];
        else assert.equal(seq[op](...args),result);
      }
      seq.update(frame.time);frames++;
      const {actions,...expected}=frame;
      assert.deepEqual({time:frame.time,lights:elements.map(e=>[e.spec.kind==='Light'&&!e.state.sequenceactive?e.state.state:e.state.sequencestate,e.state.sequenceactive?1:0]),playing:seq.playing,pause:seq.paused,next:seq.next,events,rng:random.getState()},expected,`${c.name} at ${frame.time}ms`);
    }
  }
  assert.equal(frames,636);
});
