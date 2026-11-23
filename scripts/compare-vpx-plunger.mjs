import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {KEY} from '../three/rules.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceFixture,summarizeNativePlunger} from './reference-physics.mjs';
const fixture=readReferenceFixture(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-plunger.json');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');
applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const scenario of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{}),ruleAudit=process.argv.includes('--rule-audit')?[]:null;let failure;
  g.random=referenceRandom();
  try{
    const ruleNames=['bSkillShotReady','bBallInPlungerLane','bBallSaverReady','bBallSaverActive','bAutoPlunger','BallSaverTime','Song'];let ruleOrigin;
    const ruleState=()=>Object.fromEntries(ruleNames.map(name=>[name,g.rules.value(name)]));
    if(ruleAudit){const hit=g.rules.hit.bind(g.rules);g.rules.hit=(name,kind,...args)=>{if(ruleOrigin===undefined||kind==='Animate'&&!/plunger/i.test(name))return hit(name,kind,...args);const row={ms:Math.round(g.time*1000)-ruleOrigin,event:name+'_'+kind,before:ruleState(),scriptBefore:g.rules.scriptRandom.getState()};const result=hit(name,kind,...args);row.after=ruleState();row.scriptAfter=g.rules.scriptRandom.getState();ruleAudit.push(row);return result;};for(const method of ['rnd','randomize']){const original=g.rules.scriptRandom[method].bind(g.rules.scriptRandom);g.rules.scriptRandom[method]=argument=>{const before=g.rules.scriptRandom.getState(),result=original(argument);if(ruleOrigin!==undefined)ruleAudit.push({ms:Math.round(g.time*1000)-ruleOrigin,method,argument,before,after:g.rules.scriptRandom.getState()});return result;};}}
    g.start();for(let i=0;i<2/STEP;i++)g.step();let r=g.records[0];
    placeReferenceBall(g,r,{...scenario,vx:0,vy:0,vz:0});
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    r=restoreReferenceBalls(g,fixture,scenario,r);
    const flipperContacts=[];
    if(scenario.flipperContacts){
      const origin=Math.round(g.time*1000),hit=g.rules.hit.bind(g.rules),ids=new Map(g.physicalRecords.map((record,i)=>[record.proxy,scenario.initialBallStates[i][fixture.initialBallStateColumns.indexOf('ID')]]));
      g.rules.hit=(name,kind,ball,...parameters)=>{
        if(kind==='Collide'&&/^(Left|Right)Flipper$/i.test(name))flipperContacts.push({ms:Math.round(g.time*1000)-origin,side:name.toLowerCase().startsWith('left')?'left':'right',speed:parameters[0],id:g.referenceBallID?.(ball)??ids.get(ball)});
        return hit(name,kind,ball,...parameters);
      };
    }
    if(ruleAudit){ruleOrigin=Math.round(g.time*1000);ruleAudit.push({ms:0,initialRules:ruleState()});}
    let clockInputs=0;
    if(scenario.scriptClocks){
      const origin=Math.round(g.time*1000);
      // Replay the independently observed external clock inputs, not RNG
      // outputs. Production retains its actual local Timer implementation.
      g.rules.engine._registerFunction('Timer',()=>{
        const observed=scenario.scriptClocks[clockInputs++];assert.ok(observed,'native clock input exists for this call');assert.equal(observed.type,4);assert.equal(Math.round(g.time*1000)-origin,observed.ms,'Timer called at the independently recorded physics clock');
        return {type:'Single',value:observed.value};
      });
    }
    if(scenario.initialPlungerPosition!==undefined&&!scenario.initialNativeInternals?.plunger){
      // The public native position is Float32; converting it back identifies
      // the rod's VPU coordinate at this snapshot, before PullBack zeros speed.
      g.plunger.pos=Math.fround(g.plunger.end+Math.fround(Math.fround(scenario.initialPlungerPosition/25)*Math.fround(g.plunger.spec.stroke)));
      assert.equal(g.plunger.position,Math.fround(scenario.initialPlungerPosition),'observed native rod position round trip');
      g.plunger.updateNativeShapes();
    }
    g.rules.execute('Plunger.PullBack');g.rules.schedule(scenario.actualDelay,'Plunger.Fire');
    const nativeKeys=new Map(),inputFrames=new Map();let appliedInputs=0;
    for(const input of scenario.inputSequence??[]){
      assert.ok(['left','right','nudgeLeft','nudgeForward','nudgeRight'].includes(input.action)&&Number.isInteger(input.key));assert.equal(typeof input.down,'boolean');
      if(nativeKeys.has(input.action))assert.equal(input.key,nativeKeys.get(input.action));else nativeKeys.set(input.action,input.key);
      // Native SDL logical codes and this host's internal constants identify
      // the same explicitly named authored table actions.
      if(!inputFrames.has(input.ms))inputFrames.set(input.ms,[]);inputFrames.get(input.ms).push(input);
    }
    if(scenario.inputSequence){
      assert.match(fixture.runtimeInputSequence.code,/Sub LeftFlipper_Timer\b[^\n]*\n\s+RefInputAdvance/,'native input driver runs before the authored flipper timer body');
      const origin=Math.round(g.time*1000),execute=g.rules.engine.executeStatementThrows.bind(g.rules.engine);
      g.rules.engine.executeStatementThrows=(statement,...args)=>{
        if(/^LeftFlipper_Timer\s*$/i.test(statement)){
          const ms=Math.round(g.time*1000)-origin,inputs=inputFrames.get(ms)??[];inputFrames.delete(ms);
          for(const input of inputs){execute(`Table1_Key${input.down?'Down':'Up'} ${KEY[input.action]}`);appliedInputs++;}
        }
        return execute(statement,...args);
      };
    }
    let elapsed=0;const samples=[],traceSamples=[],animationAudit=[];
    const animationFrames=scenario.animationFrames?new Map(scenario.animationFrames.map(row=>[row[0],row])):null;
    if(animationFrames){
      assert.ok(scenario.animationFrames.length,'native animation clocks recorded');
      for(let i=1;i<scenario.animationFrames.length;i++)assert.equal(scenario.animationFrames[i][0]-scenario.animationFrames[i-1][0],scenario.animationFrames[i][1],'native frame-clock continuity');
      g.frameAnimations=true;g.lastAnimationTime=Math.round(g.time*1000)+scenario.animationFrames[0][0]-scenario.animationFrames[0][1];
    }
    const prepareObservedFrame=ms=>{
      const expected=animationFrames?.get(ms);if(!expected)return;
      g.prepareFrame();
      const names=fixture.instrumentation.animationFrameTrace.targets??['Target009','Target010','Target011'],targets=names.map(name=>g.targetMotions.get(name.toLowerCase())),actual=[ms,expected[1],...targets.map(target=>target.offset),...targets.map(target=>Number(target.dropped)),g.rules.value('Score(CurrentPlayer)')];
      animationAudit.push({ms,expected,actual,errors:actual.slice(2).map((value,i)=>value-(i<3?Math.fround(expected[i+2]):expected[i+2]))});
    };
    const traceRows=new Map((process.argv.includes('--trace')||fixture.traceRegression?scenario.timerTrace??[]:[]).filter(r=>r[0]==='STATE').map(row=>[row[1]-1,row]));
    const observeTrace=ms=>{
      const row=traceRows.get(ms);if(!row)return;
      const expected=row.slice(2,11);for(let i=3;i<9;i++)expected[i]/=1e6;
      const b=r.proxy,actual=[b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));
      traceSamples.push({ms,expected,actual,positionError:error(0),velocityError:error(3),angularError:error(6)});
    };
    observeTrace(0);
    const advanceTo=ms=>{for(let i=0;i<Math.round((ms-elapsed)/1000/STEP);i++){g.step();observeTrace(elapsed+i+1);prepareObservedFrame(elapsed+i+1);}elapsed=ms;};
    for(const expected of scenario.samples){
      const ms=expected[0];advanceTo(ms);
      // A native script may retain RefBall after DestroyBall; the port keeps
      // the same readable final COM state, without accessing a removed body.
      const b=r.proxy,actual=[ms,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz,...g.flippers.map(f=>90-f.angle*180/Math.PI),g.plunger.position];
      const nativeAngles=['leftflipper','rightflipper'].map(name=>g.rules.objects.get(name).currentangle);
      samples.push({expected,actual,nativeAngles,positionError:Math.hypot(...actual.slice(1,4).map((n,i)=>n-expected[i+1])),velocityError:Math.hypot(...actual.slice(4,7).map((n,i)=>n-expected[i+4])),plungerError:Math.abs(actual[12]-expected[12])});
    }
    if(fixture.nativeBodyRegression?.throughMilliseconds>elapsed)advanceTo(fixture.nativeBodyRegression.throughMilliseconds);
    const bodies=(g.nativeBodyAudit??[]).flatMap(frame=>frame.bodies),nativeBodySummary={frames:g.nativeBodyAudit?.length??0,bodies:bodies.length};
    for(const key of ['positionError','velocityError','momentumError','orientationError'])nativeBodySummary[key]=bodies.reduce((max,body)=>Math.max(max,body[key]??0),0);
    if(fixture.liveBodyState)Object.assign(nativeBodySummary,{identityMismatches:g.nativeBodyAudit.filter(frame=>frame.missingIDs.length||frame.unexpectedIDs.length).length,lifecycles:g.nativeBodyAudit.filter((frame,i,a)=>i===0||String(frame.actualIDs)!==String(a[i-1].actualIDs)).map(frame=>({ms:frame.ms,ids:frame.actualIDs}))});
    const nativePlungerSummary=summarizeNativePlunger(g.nativePlungerAudit);
    const report={name:scenario.name,actualDelay:scenario.actualDelay,maxPositionError:Math.max(...samples.map(r=>r.positionError)),maxVelocityError:Math.max(...samples.map(r=>r.velocityError)),maxPlungerError:Math.max(...samples.map(r=>r.plungerError)),maxNativeSpeed:Math.max(...samples.map(r=>Math.hypot(...r.expected.slice(4,6)))),maxModelSpeed:Math.max(...samples.map(r=>Math.hypot(...r.actual.slice(4,6)))),physicsStats:g.physicsStats,samples,...(traceRows.size?{traceSamples}:{}),...(g.nativeRandomAudit?{nativeRandomAudit:g.nativeRandomAudit,nativeBodySummary}:{}),...(nativePlungerSummary?{nativePlungerSummary}:{}),...(process.argv.includes('--body-audit')?{nativeBodyAudit:g.nativeBodyAudit,nativePlungerAudit:g.nativePlungerAudit}:{})};reports.push(report);
    if(animationFrames)Object.assign(report,{animationAudit,animationSummary:{frames:animationAudit.length,offsetError:Math.max(0,...animationAudit.flatMap(row=>row.errors.slice(0,3).map(Math.abs))),stateMismatches:animationAudit.filter(row=>row.errors.slice(3).some(Boolean)).length},nativeScriptRandomAudit:g.nativeScriptRandomAudit});
    if(ruleAudit)report.ruleAudit=ruleAudit;
    if(scenario.scriptClocks)report.scriptClockInputs=clockInputs;
    if(scenario.inputSequence)report.nativeFlipperSummary={frames:samples.length,angleErrors:[0,1].map(index=>Math.max(0,...samples.map(row=>Math.abs(row.nativeAngles[index]-Math.fround(row.expected[10+index]))))),inputs:appliedInputs};
    if(scenario.flipperContacts)report.flipperContacts=flipperContacts;
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,traceSamples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined,nativePlungerAudit:undefined,animationAudit:undefined,nativeScriptRandomAudit:undefined}));
  }catch(error){failure=error;fs.writeFileSync((process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-plunger-comparison.json')+'.partial',JSON.stringify({error:String(error),stack:error.stack,time:g.time,bodyAudit:g.nativeBodyAudit,randomAudit:g.nativeRandomAudit,scriptRandomAudit:g.nativeScriptRandomAudit,ruleAudit,delays:g.rules.delays},null,2));throw error;}finally{try{g.dispose();}catch(error){if(!failure)throw error;}}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-plunger-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
// These gates cover rod movement and initial launch energy. Downstream shooter
// deflector/ramp contacts still diverge and are retained in the full report.
if(process.argv.includes('--check'))for(const r of reports){
  assert.ok(r.maxPlungerError<.08,`${r.name} native plunger scale error: ${r.maxPlungerError}`);
  const first=r.samples.find(s=>Math.abs(s.expected[5])>1);
  if(first){assert.ok(Math.abs(r.maxNativeSpeed-r.maxModelSpeed)<.03,`${r.name} peak launch speed`);assert.ok(first.positionError<2.2,`${r.name} first launch position`);assert.ok(first.velocityError<.6,`${r.name} first launch velocity`);}
  else assert.ok(r.maxModelSpeed<.1,`${r.name} weak pull must not launch`);
  if(fixture.initialTrajectory){
    const limit=fixture.initialTrajectory;
    for(const sample of r.samples.filter(s=>s.expected[0]<=limit.throughMilliseconds)){
      assert.ok(sample.positionError<limit.position,`${r.name} initial native path at ${sample.expected[0]}ms`);
      assert.ok(sample.velocityError<limit.velocity,`${r.name} initial native velocity at ${sample.expected[0]}ms`);
      assert.ok(sample.plungerError<limit.plunger,`${r.name} initial native rod at ${sample.expected[0]}ms`);
    }
  }
  if(fixture.nativeBodyRegression){
    const limit=fixture.nativeBodyRegression;assert.ok(r.nativeBodySummary.frames>=limit.frames,'complete native physics-frame coverage');
    for(const key of ['positionError','velocityError','momentumError','orientationError'])if(limit[key]!==undefined)assert.ok(r.nativeBodySummary[key]<=limit[key],`${r.name} every native body ${key}: ${r.nativeBodySummary[key]}`);
    if(fixture.liveBodyState)assert.equal(r.nativeBodySummary.identityMismatches,0,'all live native body identities at every boundary');
  }
  if(fixture.nativePlungerRegression){
    const limit=fixture.nativePlungerRegression;assert.ok(r.nativePlungerSummary?.frames>=limit.frames,'complete native plunger-frame coverage');
    for(const [key,value]of Object.entries(limit.observations??{}))assert.ok(r.nativePlungerSummary.observations[key]>=value,`${r.name} native plunger ${key} observation coverage`);
    for(const [key,value]of Object.entries(limit.errors))assert.ok(r.nativePlungerSummary.errors[key]<=value,`${r.name} native plunger ${key}: ${r.nativePlungerSummary.errors[key]}`);
  }
  if(fixture.animationRegression){assert.equal(r.animationSummary.frames,fixture.animationRegression.frames);assert.equal(r.animationSummary.offsetError,0);assert.equal(r.animationSummary.stateMismatches,0);}
  if(fixture.scriptClockRegression){assert.equal(r.scriptClockInputs,fixture.scriptClockRegression.calls);assert.equal(r.nativeScriptRandomAudit.length,fixture.nativeBodyRegression.frames);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));}
  if(fixture.inputSequenceRegression){assert.equal(r.nativeFlipperSummary.inputs,fixture.inputSequenceRegression.inputs);assert.ok(r.nativeFlipperSummary.frames>=fixture.inputSequenceRegression.angleFrames);assert.deepEqual(r.nativeFlipperSummary.angleErrors,[0,0]);assert.deepEqual(r.flipperContacts,fixture.cases.find(c=>c.name===r.name).flipperContacts,'every actual native flipper collision clock, side, speed and body');}
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
