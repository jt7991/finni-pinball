// SPDX-License-Identifier: GPL-3.0-or-later
// Collection event dispatch follows Visual Pinball eventproxy.h / ieditable.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {VbsEngine,jsToVb,vbToJs} from '@devscholar/vbs-engine-js';
import {createImpulsePlunger} from './impulse-plunger.js';
import {createScriptRandom,registerScriptRandom} from './script-random.js';
import {LightSequence,SEQ} from './light-sequence.js';
import {LightAnimation,nativeColor} from './light-animation.js';
import {runtimeNativeRandom} from './native-random.js';
import {nativeFlasherLong} from './native-flasher-state.js';
import {registerNativeTimer} from './script-timer.js';
import {createVpmTimer} from './vpm-timer.js';

export const KEY={left:42,right:54,launch:28,start:2,action:57,nudgeLeft:44,nudgeForward:45,nudgeRight:53};
const empty=()=>{};
const frameEvents=new Set(['animate','dropped','raised']);
// Native COM return types for properties read by the authored rules. A
// numerically integral float is still VT_R4; aliases must retain that type.
const singleProperties={Flipper:new Set(['x','y','currentangle','startangle','endangle','strength','elasticity','eostorque','eostorqueangle']),Bumper:new Set(['x','y','threshold']),Kicker:new Set(['x','y']),Primitive:new Set(['x','y','z','rotx','roty','rotz']),Flasher:new Set(['rotz']),Light:new Set(['x','y','state']),Trigger:new Set(['x','y']),Plunger:new Set(['x','y']),Gate:new Set(['x','y']),Spinner:new Set(['x','y']),Table:new Set(['width','height','slopemin','slopemax'])};
const longProperties={Light:new Set(['blinkinterval']),LightSequencer:new Set(['updateinterval']),Timer:new Set(['interval'])};
const booleanProperties={HitTarget:new Set(['isdropped']),Flasher:new Set(['visible']),Gate:new Set(['open']),Timer:new Set(['enabled'])};
const liveProperties={Gate:new Set(['currentangle','collidable','open','hitthreshold']),HitTarget:new Set(['isdropped','currentanimoffset','hitthreshold']),Trigger:new Set(['currentanimoffset']),Bumper:new Set(['threshold','force','scatter','hashitevent','collidable','currentringoffset','rotx','roty','enableskirtanimation','ringspeed','ringdropoffset']),Wall:new Set(['disabled','slingshotthreshold','hitthreshold']),Primitive:new Set(['hitthreshold'])};
// Lamp getters depend on these existing animation fields. Observe them directly
// so unchanged lamps need no repeated proxy reads during worker publication.
// This also catches frame/sequence updates that bypass an object setter.
const lampSnapshotFields=['stored','inplay','locked','base','scale','interval','pattern','index','intensity','up','down'];

// Isolated JavaScript VBScript execution preserves the authored rules and numeric
// semantics. No Visual Pinball, COM, native scripting host or global integration.
export function createRules(source,specs,host={}) {
  const engine=new VbsEngine({hostIntegration:false,maxExecutionTime:2000});
  const scriptRandom=createScriptRandom({clock:host.scriptRandomClock});registerScriptRandom(engine,scriptRandom);registerNativeTimer(engine,undefined,host.scriptTimerSeconds);
  const objects=new Map(),timers=new Map(),delays=[],sequences=new Map(),lamps=new Map(),generatedEvents=new Map(),snapshotObjects=new WeakMap();
  const sequenceRandom=host.random??runtimeNativeRandom();
  const methods=new Set([...source.matchAll(/^\s*(?:Sub|Function)[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  const functions=new Set([...source.matchAll(/^\s*Function[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  let time=0,milliseconds=0,activeBall=null;
  const intervalMilliseconds=value=>Math.max(1,Number(value));
  const createTimer=(object,handler,interval,property)=>{
    const timer={object,handler,nextMilliseconds:milliseconds+intervalMilliseconds(interval),property};
    // Keep the seconds-based diagnostic accessor; runtime delivery uses the
    // same millisecond units as native HitTimer, without repeated fractions.
    Object.defineProperty(timer,'at',{enumerable:true,get(){return this.nextMilliseconds/1000;},set(value){this.nextMilliseconds=Number(value)*1000;}});
    return timer;
  };
  // ScriptGlobalTable::get_GameTime exposes the player's millisecond clock
  // as a signed COM LONG, independently of the wall-clock Timer function.
  engine._getContext().functionRegistry.register('GameTime',()=>({type:'Long',value:Math.round(time*1000)|0}),{minArgs:0,maxArgs:0});
  const runCallback=(name,...args)=>{
    const generated=generatedEvents.get(name.toLowerCase());if(generated)return generated(...args);
    if(!methods.has(name.toLowerCase()))return;
    try{
      const parameters=args.map((arg,i)=>{
        if(typeof arg==='number')return String(arg);if(typeof arg==='boolean')return arg?'True':'False';
        if(typeof arg==='string')return `"${arg.replaceAll('"','""')}"`;
        const key=`HostArg${i}`;engine.addObject(key,arg);if(engine.error)throw Error(JSON.stringify(engine.error));return key;
      });
      if(functions.has(name.toLowerCase()))return value(`${name}(${parameters.join(',')})`);
      return engine.executeStatementThrows(`${name} ${parameters.join(',')}`);
    }catch(error){throw new Error(`Rules ${name}: ${error.message}`,{cause:error});}
  };
  const run=host.scriptProfiler?(name,...args)=>host.scriptProfiler.measure(()=>runCallback(name,...args)):runCallback;
  const qualify=statement=>statement.replace(/(?<![\w.])[A-Za-z_]\w*/g,name=>nativeFunctions.has(name.toLowerCase())?`Native.${nativeFunctions.get(name.toLowerCase())}`:name);
  const execute=statement=>engine.executeStatementThrows(qualify(statement));
  const value=expression=>{const result=engine.eval(expression);if(engine.error)throw Error(JSON.stringify(engine.error));return result;};
  const schedule=(ms,statement)=>{delays.push({at:time+Number(ms)/1000,statement});};

  function object(spec){
    const name=spec.name,lower=name.toLowerCase();
    const lamp=spec.kind==='Light'?new LightAnimation(spec,()=>Math.round(time*1000),()=>{
      if(methods.has(lower+'_animate')||(eventGroups.get(lower)??[]).some(g=>g.collection.fire_events&&methods.has(g.collection.name.toLowerCase()+'_animate')))hit(name,'Animate',activeBall);
    }):null;
    const state={name,x:spec.center?.x??spec.position?.x??spec.pos_x??0,y:spec.center?.y??spec.position?.y??spec.pos_y??0,z:spec.position?.z??0,radius:spec.radius??0,
      state:spec.state_u32??spec.state??0,visible:spec.kind==='Wall'?(spec.is_top_bottom_visible??true):(spec.is_visible??spec.visible??true),sidevisible:spec.is_side_visible??true,basevisible:spec.is_base_visible??true,capvisible:spec.is_cap_visible??true,ringvisible:spec.is_ring_visible??true,skirtvisible:spec.is_socket_visible??true,showbracket:spec.show_bracket??false,collidable:spec.is_collidable??true,
      enabled:spec.is_enabled??false,timerenabled:false,timerinterval:spec.timer_interval??100,
      interval:spec.timer_interval??100,blinkinterval:spec.blink_interval??125,intensity:spec.intensity??1,
      blinkpattern:spec.blink_pattern??'10',intensityscale:1,inplayintensity:0,inplayon:false,fadespeedup:spec.fade_speed_up??1,fadespeeddown:spec.fade_speed_down??1,
      updateinterval:spec.update_interval??25,centerx:spec.pos_x??0,centery:spec.pos_y??0,
      color:lamp?nativeColor(spec.color??0xffffff):spec.color??0xffffff,colorfull:lamp?nativeColor(spec.color2??0xffffff):spec.color2??0xffffff,imagea:'d_empty',userValue:0,
      isdropped:spec.is_dropped??false,open:false,rotx:spec.rot_and_tra?.[0]??0,roty:spec.rot_and_tra?.[1]??0,rotz:spec.rot_z??spec.rot_and_tra?.[2]??0,
      currentangle:0,startangle:0,endangle:0,transz:0,height:spec.height??50,sequenceactive:false,sequencestate:['Flasher','Primitive'].includes(spec.kind)?Number(spec.is_visible??true):spec.state??0,
      threshold:spec.threshold??0,force:spec.force??0,scatter:spec.scatter??0,hashitevent:spec.use_hit_event??spec.hit_event??false,hitthreshold:0,disabled:false,slingshotthreshold:spec.slingshot_threshold??0};
    if(spec.kind==='Flasher'){const filter=spec.filter??'none';Object.assign(state,{color:nativeColor(spec.color??0xffffff),rotx:spec.rot_x??0,roty:spec.rot_y??0,imagea:spec.image_a??'',imageb:spec.image_b??'',opacity:spec.alpha??100,modulatevsadd:spec.modulate_vs_add??.9,addblend:spec.add_blend==='add',filter:filter[0].toUpperCase()+filter.slice(1),amount:spec.filter_amount??100});}
    // Native COM coordinates and rotations are float fields, including the
    // kicker centers subtracted by the authored toy-arm animation timer.
    for(const key of ['x','y','z','radius','height','rotx','roty','rotz'])state[key]=Math.fround(state[key]);
    const actions={
      createball:()=>host.createBall?.(name)??{x:state.x,y:state.y,z:25,velx:0,vely:0,velz:0},
      createsizedball:radius=>host.createBall?.(name,radius,1)??{x:state.x,y:state.y,z:radius,radius,mass:1,velx:0,vely:0,velz:0},
      createsizedballwithmass:(radius,mass)=>host.createBall?.(name,radius,mass)??{x:state.x,y:state.y,z:radius,radius,mass,velx:0,vely:0,velz:0},
      destroyball:()=>host.destroyBall?.(name,activeBall),
      kick:(angle,speed,inclination=0)=>host.kick?.(name,activeBall,angle,speed,inclination),
      rotatetoend:()=>host.flipper?.(lower.startsWith('left')?'left':'right',true),
      rotatetostart:()=>host.flipper?.(lower.startsWith('left')?'left':'right',false),
      pullback:()=>host.plunger?.(true),fire:()=>host.plunger?.(false),
      duration:(start,milliseconds,end)=>lamp?.setDuration(start,milliseconds,end),
      getinplaystate:()=>lamp?.inplay??0,getinplaystatebool:()=>lamp?lamp.level()!==0:false,getinplayintensity:()=>lamp?.intensity??0,
      play:(code,tail=0,repeat=1,pause=0)=>sequences.get(lower)?.play(code,Number(tail),Number(repeat),Number(pause)),
      stopplay:()=>sequences.get(lower)?.stop(),
      stop:empty,initimpulsep:empty,random:empty,initexitsnd:empty,createevents:empty,
      autofire:()=>host.autofire?.(),playhit:()=>host.mechanism?.(name,'playhit',true),
      option:(_name,_min,_max,_step,def)=>def,
      getballs:()=>host.balls?.()??[],
    };
    const snapshotInfo={revision:0,lamp,lampRevision:0,lampState:[],live:liveProperties[spec.kind],keys:new WeakMap()};
    const singles=singleProperties[spec.kind],longs=longProperties[spec.kind],booleans=booleanProperties[spec.kind];
    const dispatch=singles||longs||booleans?{
      getproperty(name){
        const key=String(name).toLowerCase(),value=proxy[key];
        if(spec.kind==='Table'&&key==='option')return {type:'Object',value:{call:(...args)=>engine._getContext().functionRegistry.call('CSng',[args[4]])}};
        if(singles?.has(key))return {type:'Single',value:Math.fround(value)};
        if(longs?.has(key))return {type:'Long',value:Number(value)};
        // HitTarget::get_IsDropped deliberately returns a BOOL payload of
        // +1 rather than -1. Preserve it through VB aliases and operators.
        if(booleans?.has(key))return {type:'Boolean',value:!!value,...(spec.kind==='HitTarget'&&key==='isdropped'&&value?{nativeBoolean:1}:{})};
        const variant=jsToVb(value);if(typeof value==='function')variant.value.thisArg=proxy;return variant;
      },
      setproperty(name,variant){const key=String(name).toLowerCase();if(singles?.has(key)){let value=0;try{value=engine._getContext().functionRegistry.call('CSng',[variant]).value;}catch{}proxy[key]=value;}else proxy[key]=vbToJs(variant);},
      hasmethod:()=>false,
    }:null;
    const proxy=new Proxy(state,{
      get(target,key){if(typeof key==='symbol')return target[key];const k=key.toLowerCase();if(dispatch&&Object.hasOwn(dispatch,k))return dispatch[k];if(lamp){const value=lamp.get(k);if(value!==undefined)return value;}if(spec.kind==='Plunger'&&k==='position')return host.plungerPosition?.()??0;if(liveProperties[spec.kind]?.has(k)){const value=host.mechanismValue?.(name,k);if(value!==undefined)return value;}return k in actions?actions[k]:target[k]??0;},
      set(target,key,v){const k=String(key).toLowerCase();if(lamp?.set(k,v))return true;const previous=target[k];target[k]=lamp&&['color','colorfull'].includes(k)?nativeColor(v):v;
        if(spec.kind==='Flasher'){
          if(k==='color')target[k]=nativeColor(v);
          else if(['opacity','amount'].includes(k))target[k]=Math.max(0,nativeFlasherLong(v));
          else if(['rotx','roty','rotz','height','intensityscale','modulatevsadd'].includes(k))target[k]=Math.fround(Number(v));
          else if(k==='filter'){const filter=String(v).toLowerCase();target[k]=['none','additive','overlay','multiply','screen'].includes(filter)?filter[0].toUpperCase()+filter.slice(1):previous;}
          else if(['visible','addblend'].includes(k))target[k]=!!v;
        }
        if(spec.kind==='Primitive'&&['x','y','z','rotx','roty','rotz'].includes(k))target[k]=Math.fround(Number(v));
        if(spec.kind==='LightSequencer'){
          const seq=sequences.get(lower);
          if(k==='updateinterval'){target[k]=Math.max(1,Math.trunc(v));if(seq)seq.updateInterval=target[k];}
          if(seq&&(k==='centerx'||k==='centery')){seq.setCenter(k==='centerx'?'x':'y',v);target[k]=k==='centerx'?seq.centerX:seq.centerY;}
        }
        if(k==='enabled'&&spec.kind==='Timer'||k==='timerenabled'){
          const enabled=!!v,timerKey=k==='enabled'?lower:`${lower}:timer`;
          target[k]=enabled;
          // IEditable::put_TimerEnabled changes scheduling only when the
          // Boolean state changes. Repeated True must retain its deadline.
          if(enabled!==!!previous){
            if(enabled)timers.set(timerKey,createTimer(proxy,`${name}_Timer`,k==='enabled'?target.interval:target.timerinterval,k));
            else timers.delete(timerKey);
          }
        }
        if(k==='interval'&&spec.kind==='Timer'||k==='timerinterval'){
          // IEditable::put_TimerInterval always calls HitTimer::SetInterval,
          // even for the same value and from inside the timer callback.
          const timer=timers.get(k==='interval'?lower:`${lower}:timer`);
          if(timer)timer.nextMilliseconds=milliseconds+intervalMilliseconds(v);
        }
        if(k==='isdropped'||k==='collidable'||k==='open'||k==='enabled'&&['Trigger','Kicker'].includes(spec.kind))host.mechanism?.(name,k,v);
        if(spec.kind==='Bumper'&&['threshold','force','scatter','hashitevent','enableskirtanimation','ringspeed','ringdropoffset'].includes(k))host.mechanism?.(name,k,v);
        if(spec.kind==='Wall'&&['disabled','slingshotthreshold'].includes(k))host.mechanism?.(name,k,v);
        if(spec.kind==='HitTarget'&&['hashitevent','visible'].includes(k))host.mechanism?.(name,k,v);
        if(!Object.is(previous,target[k]))snapshotInfo.revision++;
        return true;},
      has(target,key){return typeof key==='string'&&(key.toLowerCase() in target||key.toLowerCase() in actions);},
      ownKeys(target){return [...new Set([...Reflect.ownKeys(target),...Object.keys(actions)])];},
      getOwnPropertyDescriptor(target,key){return {enumerable:true,configurable:true,writable:true,value:proxy[key]};},
    });
    snapshotObjects.set(proxy,snapshotInfo);if(lamp)lamps.set(lower,lamp);
    objects.set(lower,proxy);engine.addObject(name,proxy);return proxy;
  }
  for(const spec of specs.objects)object(spec);
  // TimerSetup adds authored enabled timers in native table-part order,
  // before script initialization enables any additional timers.
  for(const spec of specs.objects.filter(s=>s.is_timer_enabled).sort((a,b)=>(a.native_source_order??0)-(b.native_source_order??0))){
    objects.get(spec.name.toLowerCase())[spec.kind==='Timer'?'enabled':'timerenabled']=true;
  }
  const byName=new Map(specs.objects.map(s=>[s.name.toLowerCase(),s]));
  for(const spec of specs.objects.filter(s=>s.kind==='LightSequencer')){
    const collection=specs.collections.find(c=>c.name.toLowerCase()===spec.collection?.toLowerCase());
    sequences.set(spec.name.toLowerCase(),new LightSequence(spec,(collection?.items??[]).map(n=>({spec:byName.get(n.toLowerCase()),state:objects.get(n.toLowerCase())})).filter(x=>x.spec&&x.state),{...host.tableSize,available:!!collection,random:sequenceRandom,onDone:()=>run(`${spec.name}_PlayDone`)}));
  }
  for(let i=1;i<=41;i++)if(!objects.has(`digit${String(i).padStart(3,'0')}`))object({name:`digit${String(i).padStart(3,'0')}`});
  const extras=['Table1','digitgrid','HostPlunger'];
  for(const name of extras)if(!objects.has(name.toLowerCase()))object({name,...(name==='Table1'?{kind:'Table'}:{})});
  const impulsePlunger=createImpulsePlunger({
    random:()=>host.scriptRandom?.()??scriptRandom.rnd(),
    sound:name=>{if(name)natives.PlaySound(name);},
    initTimer:(trigger,update)=>generatedEvents.set(`${trigger.name}_timer`.toLowerCase(),update),
    createEvents:(trigger,add,remove)=>{
      generatedEvents.set(`${trigger.name}_hit`.toLowerCase(),()=>add(activeBall));
      generatedEvents.set(`${trigger.name}_unhit`.toLowerCase(),()=>remove(activeBall));
    },
  });
  objects.set('hostplunger',impulsePlunger);engine.addObject('HostPlunger',impulsePlunger);
  objects.get('table1').width=952;objects.get('table1').height=2115;
  for(const c of specs.collections)engine.addCode(`Dim ${c.name}\n${c.name}=Array(${c.items.filter(n=>objects.has(n.toLowerCase())).join(',')})`);
  const vpmTimer=createVpmTimer(execute),pulseTimer=objects.get('pulsetimer');
  // core.vbs initializes this authored, initially enabled timer at 25Hz.
  // It precedes subsequently enabled script timers in the active list.
  if(pulseTimer){generatedEvents.set('pulsetimer_timer',()=>vpmTimer.update());pulseTimer.interval=40;pulseTimer.enabled=true;}
  const natives={
    LoadEM:empty,DOF:empty,SoundFXDOF:name=>name,SoundFX:name=>name,
    PlaySound:function(name,loop=1,volume=1,pan=0,randomPitch=0,pitch=0,useExisting=false,restart=true,frontRearFade=0){
      // Match the native COM signature before sound RNG and DSP see arguments.
      // In particular, pitch/loop are Long (banker's rounding), and omitted
      // restart defaults to true. Explicit Empty volume converts to zero.
      if(arguments.length>=3&&arguments[2]===undefined)volume=0;
      const argument=value=>({type:typeof value==='boolean'?'Boolean':'Double',value:value??0});
      const convert=(type,value)=>engine._getContext().functionRegistry.call(type,[argument(value)]).value;
      return host.sound?.(name,{loop:convert('CLng',loop),volume:convert('CSng',volume),pan:convert('CSng',pan),randomPitch:convert('CSng',randomPitch),pitch:convert('CLng',pitch),useExisting:!!useExisting,restart:!!restart,frontRearFade:convert('CSng',frontRearFade)});
    },StopSound:name=>host.stopSound?.(name),
    PlayMusic:name=>host.sound?.(name,{music:true}),EndMusic:()=>host.stopSound?.(),
    // Both native storage backends expose VT_BSTR, including saved numbers.
    // Existing JSON data remains readable; convert with VB's text semantics.
    LoadValue:(table,key)=>{const value=host.load?.(key);return value==null?'':engine._getContext().functionRegistry.call('CStr',[jsToVb(value)]).value;},SaveValue:(table,key,v)=>host.save?.(key,v),
    RGB:(r,g,b)=>Math.round(r)+Math.round(g)*256+Math.round(b)*65536,
    RGBf:(r,g,b)=>Math.round(r*255)+Math.round(g*255)*256+Math.round(b*255)*65536,
    Nudge:(angle,strength)=>host.nudge?.(angle,strength),
    BallCount:()=>host.balls?.().length??0,BallAt:index=>host.balls?.()[index],
    Debug: {Print:text=>host.log?.(String(text))},MsgBox:text=>host.message?.(text),
    GetTextFile:()=>'',Controller:{Stop:empty},
    LeftFlipperKey:KEY.left,RightFlipperKey:KEY.right,PlungerKey:KEY.launch,StartGameKey:KEY.start,
    LeftTiltKey:KEY.nudgeLeft,RightTiltKey:KEY.nudgeRight,CenterTiltKey:KEY.nudgeForward,
    LockBarKey:KEY.action,RightMagnaSave:KEY.action,LeftMagnaSave:29,
    MechanicalTilt:46,AddCreditKey:6,AddCreditKey2:7,DOFPulse:2,DOFOn:1,DOFOff:0,DOFContactors:0,
    ...SEQ,
    vpmtimer:vpmTimer,ActiveBall:{},
    HostShake:strength=>host.shake?.(strength),
    HostFlash:(light,total,period,final)=>{
      const lower=String(light.name).toLowerCase(),spec=byName.get(lower);
      if(!spec||!['Light','Flasher'].includes(spec.kind))return;
      // Preserve the authored FlashForMs helper, including relative timer
      // restarts, rounded step counts and its zero-step edge behavior.
      if(spec.kind==='Light'){
        const finish=Number(final)===2?light.state:final;
        light.blinkinterval=period;light.duration(2,total,finish);
      }else{
        const steps=Math.floor(Number(total)/Number(period)+.5),finish=Number(final)===2?Math.abs(Number(light.visible)):Number(final);
        light.uservalue=steps*10+finish;light.timerinterval=period;light.timerenabled=false;light.timerenabled=true;
        generatedEvents.set(`${lower}_timer`,()=>{
          const tmp=Number(light.uservalue),fstate=tmp%10,steps=Math.trunc(tmp/10)-1;
          light.visible=steps%2;light.uservalue=steps*10+fstate;
          if(steps===0){light.visible=fstate;light.timerenabled=false;}
        });
      }
    },
  };
  const nativeFunctions=new Map(Object.entries(natives).filter(([,v])=>typeof v==='function').map(([name])=>[name.toLowerCase(),name]));
  engine.addObject('Native',natives);
  // Construct an actual VBScript array: returning a JS array of dispatch objects
  // directly does not preserve the engine's array clone/assignment semantics.
  engine.addCode(`Function GetBalls()
    Dim balls(),i,count
    count=Native.BallCount()
    If count=0 Then
      GetBalls=Array()
      Exit Function
    End If
    ReDim balls(count-1)
    For i=0 To count-1
      Set balls(i)=Native.BallAt(i)
    Next
    GetBalls=balls
  End Function`);
  for(const [name,v]of Object.entries(natives))if(typeof v!=='function')engine.addObject(name,v);
  for(const name of new Set(source.match(/\bDOF[A-Za-z]+\b/g)||[]))if(!(name in natives))engine.addObject(name,0);
  // The source enables Option Explicit. Reserve the object-call slots before it
  // runs, so a later ramp assist or ball/ball event can bind its arguments.
  for(let i=0;i<6;i++)engine.addObject(`HostArg${i}`,{});
  engine.addCode(qualify(source));
  const eventGroups=new Map();
  for(const collection of specs.collections)if(collection.fire_events||collection.stop_single_events)collection.items.forEach((name,index)=>{
    const key=name.toLowerCase();if(!eventGroups.has(key))eventGroups.set(key,[]);eventGroups.get(key).push({collection,index});
  });
  function setActiveBall(ball){
    ball??=null;if(activeBall===ball)return;
    activeBall=ball;engine.addObject('ActiveBall',ball??{});
  }
  function hit(name,kind='Hit',ball,...parameters){
    // Frame callbacks do not select a collision ball. In particular, an
    // Animate with no ball must not erase the player's current ActiveBall.
    if(ball!==undefined&&!frameEvents.has(kind.toLowerCase()))setActiveBall(ball);
    const groups=eventGroups.get(name.toLowerCase())??[];
    // Flipper Collide uses FireVoidEventParm; it does not pass through native
    // collection FireGroupEvent dispatch, and carries the impact speed.
    if(kind==='Collide')return run(`${name}_${kind}`,...parameters);
    for(const {collection,index}of groups)if(collection.fire_events)run(`${collection.name}_${kind}`,index);
    if(!groups.some(({collection})=>collection.stop_single_events))return run(`${name}_${kind}`);
  }
  function tick(dt,dispatchTimers=true){
    milliseconds+=dt*1000;time=milliseconds/1000;
    for(const delay of [...delays])if(delay.at<=time+1e-9){delays.splice(delays.indexOf(delay),1);execute(delay.statement);}
    // Production supplies the native script-budget gate; reference diagnostics
    // can instead supply independently observed timer-delivery clocks. The
    // physical1ms interval is processed regardless of positive timer delivery.
    if(!dispatchTimers)return;
    for(const [key,t]of [...timers])if(t.nextMilliseconds<=milliseconds+1e-6&&timers.get(key)===t){
      const next=t.nextMilliseconds;run(t.handler);
      const interval=intervalMilliseconds(t.property==='enabled'?t.object.interval:t.object.timerinterval);
      // Timer aliases are bound to their authored object when assets are
      // prepared. HitTimer::Update fires an overdue callback once, then moves
      // its unchanged deadline beyond the current clock; missed calls do not
      // run in a burst. Callback interval/enable changes retain their deadline.
      if(t.nextMilliseconds===next&&timers.get(key)===t)while(t.nextMilliseconds<=milliseconds+1e-6)t.nextMilliseconds+=interval;
    }
  }
  return {engine,objects,run,execute,value,tick,hit,schedule,scriptRandom,sequences,lamps,setActiveBall,
    ballRemoved(ball,replacement){if(activeBall===ball)setActiveBall(replacement);},
    snapshotRevision(object,keys){
      const info=snapshotObjects.get(object);if(!info)return;
      let live=info.keys.get(keys);if(live===undefined){live=keys.some(key=>info.live?.has(key));info.keys.set(keys,live);}
      // Native mechanism getters still require a fresh read. Lamp animation
      // state is observed on every publication independently of setter revision.
      if(live)return;
      if(info.lamp){
        let changed=false;
        for(let index=0;index<lampSnapshotFields.length;index++){
          const value=info.lamp[lampSnapshotFields[index]];
          if(!Object.is(value,info.lampState[index])){info.lampState[index]=value;changed=true;}
        }
        if(changed)info.lampRevision++;
      }
      return info.revision+info.lampRevision;
    },
    init(){run('Table1_Init');run('Table1_OptionEvent',0);execute('bFreePlay=True:BallsPerGame=3');},
    key(action,down){run(down?'Table1_KeyDown':'Table1_KeyUp',KEY[action]);},
    get time(){return time;},get timers(){return timers;},get delays(){return delays;},
  };
}
