// SPDX-License-Identifier: GPL-3.0-or-later
// Collection event dispatch follows Visual Pinball eventproxy.h / ieditable.cpp,
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
import {VbsEngine} from '@devscholar/vbs-engine-js';
import {createImpulsePlunger} from './impulse-plunger.js';
import {createScriptRandom,registerScriptRandom} from './script-random.js';
import {LightSequence,SEQ} from './light-sequence.js';
import {LightAnimation,nativeColor} from './light-animation.js';
import {runtimeNativeRandom} from './native-random.js';

export const KEY={left:42,right:54,launch:28,start:2,action:57,nudgeLeft:44,nudgeForward:45,nudgeRight:53};
const empty=()=>{};

// Isolated JavaScript VBScript execution preserves the authored rules and numeric
// semantics. No Visual Pinball, COM, native scripting host or global integration.
export function createRules(source,specs,host={}) {
  const engine=new VbsEngine({hostIntegration:false,maxExecutionTime:2000});
  const scriptRandom=createScriptRandom();registerScriptRandom(engine,scriptRandom);
  const objects=new Map(),timers=new Map(),delays=[],flashes=new Map(),sequences=new Map(),lamps=new Map(),generatedEvents=new Map();
  const sequenceRandom=host.random??runtimeNativeRandom();
  const methods=new Set([...source.matchAll(/^\s*(?:Sub|Function)[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  const functions=new Set([...source.matchAll(/^\s*Function[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  let time=0,activeBall=null;
  const run=(name,...args)=>{
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
      state:spec.state_u32??spec.state??0,visible:spec.is_visible??spec.visible??true,collidable:spec.is_collidable??true,
      enabled:spec.is_enabled??false,timerenabled:false,timerinterval:spec.timer_interval??100,
      interval:spec.timer_interval??100,blinkinterval:spec.blink_interval??125,intensity:spec.intensity??1,
      blinkpattern:spec.blink_pattern??'10',intensityscale:1,inplayintensity:0,inplayon:false,fadespeedup:spec.fade_speed_up??1,fadespeeddown:spec.fade_speed_down??1,
      updateinterval:spec.update_interval??25,centerx:spec.pos_x??0,centery:spec.pos_y??0,
      color:lamp?nativeColor(spec.color??0xffffff):spec.color??0xffffff,colorfull:lamp?nativeColor(spec.color2??0xffffff):spec.color2??0xffffff,imagea:'d_empty',userValue:0,
      isdropped:spec.is_dropped??false,open:false,rotx:spec.rot_and_tra?.[0]??0,roty:spec.rot_and_tra?.[1]??0,rotz:spec.rot_z??spec.rot_and_tra?.[2]??0,
      currentangle:0,startangle:0,endangle:0,transz:0,height:spec.height??50,sequenceactive:false,sequencestate:['Flasher','Primitive'].includes(spec.kind)?Number(spec.is_visible??true):spec.state??0,
      threshold:spec.threshold??0,force:spec.force??0,scatter:spec.scatter??0,hashitevent:spec.use_hit_event??spec.hit_event??false,hitthreshold:0,disabled:false,slingshotthreshold:spec.slingshot_threshold??0};
    const actions={
      createball:()=>host.createBall?.(name)??{x:state.x,y:state.y,z:25,velx:0,vely:0,velz:0},
      createsizedballwithmass:()=>host.createBall?.(name)??{x:state.x,y:state.y,z:25,velx:0,vely:0,velz:0},
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
      autofire:()=>host.autofire?.(),
      option:(_name,_min,_max,_step,def)=>def,
      getballs:()=>host.balls?.()??[],
    };
    const proxy=new Proxy(state,{
      get(target,key){if(typeof key==='symbol')return target[key];const k=key.toLowerCase();if(lamp){const value=lamp.get(k);if(value!==undefined)return value;}if(spec.kind==='Plunger'&&k==='position')return host.plungerPosition?.()??0;if(spec.kind==='Gate'||spec.kind==='HitTarget'||spec.kind==='Bumper'||spec.kind==='Wall'||spec.kind==='Primitive'&&k==='hitthreshold'){const value=host.mechanismValue?.(name,k);if(value!==undefined)return value;}return k in actions?actions[k]:target[k]??0;},
      set(target,key,v){const k=String(key).toLowerCase();if(lamp?.set(k,v))return true;target[k]=lamp&&['color','colorfull'].includes(k)?nativeColor(v):v;
        if(spec.kind==='LightSequencer'){
          const seq=sequences.get(lower);
          if(k==='updateinterval'){target[k]=Math.max(1,Math.trunc(v));if(seq)seq.updateInterval=target[k];}
          if(seq&&(k==='centerx'||k==='centery')){seq.setCenter(k==='centerx'?'x':'y',v);target[k]=k==='centerx'?seq.centerX:seq.centerY;}
        }
        if(k==='enabled'&&spec.kind==='Timer'||k==='timerenabled'){
          const enabled=!!v,timerKey=k==='enabled'?lower:`${lower}:timer`;
          if(enabled)timers.set(timerKey,{object:proxy,handler:`${name}_Timer`,at:time+Math.max(.001,Number(k==='enabled'?target.interval:target.timerinterval)/1000),property:k});
          else timers.delete(timerKey);
        }
        if(k==='isdropped'||k==='collidable'||k==='open'||k==='enabled'&&['Trigger','Kicker'].includes(spec.kind))host.mechanism?.(name,k,v);
        if(spec.kind==='Bumper'&&['threshold','force','scatter','hashitevent'].includes(k))host.mechanism?.(name,k,v);
        if(spec.kind==='Wall'&&['disabled','slingshotthreshold'].includes(k))host.mechanism?.(name,k,v);
        if(spec.kind==='HitTarget'&&['hashitevent','visible'].includes(k))host.mechanism?.(name,k,v);
        return true;},
      has(target,key){return typeof key==='string'&&(key.toLowerCase() in target||key.toLowerCase() in actions);},
      ownKeys(target){return [...new Set([...Reflect.ownKeys(target),...Object.keys(actions)])];},
      getOwnPropertyDescriptor(target,key){return {enumerable:true,configurable:true,writable:true,value:proxy[key]};},
    });
    if(lamp)lamps.set(lower,lamp);
    objects.set(lower,proxy);engine.addObject(name,proxy);return proxy;
  }
  for(const spec of specs.objects)object(spec);
  const byName=new Map(specs.objects.map(s=>[s.name.toLowerCase(),s]));
  for(const spec of specs.objects.filter(s=>s.kind==='LightSequencer')){
    const collection=specs.collections.find(c=>c.name.toLowerCase()===spec.collection?.toLowerCase());
    sequences.set(spec.name.toLowerCase(),new LightSequence(spec,(collection?.items??[]).map(n=>({spec:byName.get(n.toLowerCase()),state:objects.get(n.toLowerCase())})).filter(x=>x.spec&&x.state),{...host.tableSize,available:!!collection,random:sequenceRandom,onDone:()=>run(`${spec.name}_PlayDone`)}));
  }
  for(let i=1;i<=41;i++)if(!objects.has(`digit${String(i).padStart(3,'0')}`))object({name:`digit${String(i).padStart(3,'0')}`});
  const extras=['Table1','digitgrid','HostPlunger'];
  for(const name of extras)if(!objects.has(name.toLowerCase()))object({name});
  const impulsePlunger=createImpulsePlunger({
    random:()=>host.scriptRandom?.()??scriptRandom.rnd(),
    sound:name=>{if(name)host.sound?.(name,{});},
    initTimer:(trigger,update)=>generatedEvents.set(`${trigger.name}_timer`.toLowerCase(),update),
    createEvents:(trigger,add,remove)=>{
      generatedEvents.set(`${trigger.name}_hit`.toLowerCase(),()=>add(activeBall));
      generatedEvents.set(`${trigger.name}_unhit`.toLowerCase(),()=>remove(activeBall));
    },
  });
  objects.set('hostplunger',impulsePlunger);engine.addObject('HostPlunger',impulsePlunger);
  objects.get('table1').width=952;objects.get('table1').height=2115;
  for(const c of specs.collections)engine.addCode(`Dim ${c.name}\n${c.name}=Array(${c.items.filter(n=>objects.has(n.toLowerCase())).join(',')})`);
  const natives={
    LoadEM:empty,DOF:empty,SoundFXDOF:name=>name,SoundFX:name=>name,
    PlaySound:(name,loop=0,volume=1,pan=0,randomPitch=0,pitch=0,useExisting=false,restart=false,frontRearFade=0)=>host.sound?.(name,{loop,volume,pan,randomPitch,pitch,useExisting,restart,frontRearFade}),StopSound:name=>host.stopSound?.(name),
    PlayMusic:name=>host.sound?.(name,{music:true}),EndMusic:()=>host.stopSound?.(),
    LoadValue:(table,key)=>host.load?.(key)??'',SaveValue:(table,key,v)=>host.save?.(key,v),
    RGB:(r,g,b)=>Math.round(r)+Math.round(g)*256+Math.round(b)*65536,
    RGBf:(r,g,b)=>Math.round(r*255)+Math.round(g*255)*256+Math.round(b*255)*65536,
    Nudge:(angle,strength)=>host.nudge?.(angle,strength),
    BallCount:()=>host.balls?.().length??0,BallAt:index=>host.balls?.()[index],
    Debug: {Print:empty},MsgBox:text=>host.message?.(text),
    GetTextFile:()=>'',Controller:{Stop:empty},
    LeftFlipperKey:KEY.left,RightFlipperKey:KEY.right,PlungerKey:KEY.launch,StartGameKey:KEY.start,
    LeftTiltKey:KEY.nudgeLeft,RightTiltKey:KEY.nudgeRight,CenterTiltKey:KEY.nudgeForward,
    LockBarKey:KEY.action,RightMagnaSave:KEY.action,LeftMagnaSave:29,
    MechanicalTilt:46,AddCreditKey:6,AddCreditKey2:7,DOFPulse:2,DOFOn:1,DOFOff:0,DOFContactors:0,
    ...SEQ,
    vpmtimer:{addtimer:schedule},ActiveBall:{},
    HostShake:strength=>host.shake?.(strength),
    HostFlash:(light,total,period,final)=>{
      const spec=specs.objects.find(s=>s.name.toLowerCase()===String(light.name).toLowerCase());
      if(!spec||!['Light','Flasher'].includes(spec.kind))return;
      const property=spec.kind==='Light'?'state':'visible',finish=Number(final)===2?light[property]:final;
      flashes.set(light.name,{light,property,finish,end:time+Number(total)/1000,period:Math.max(.01,Number(period)/1000)});
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
  function hit(name,kind='Hit',ball,...parameters){
    activeBall=ball;engine.addObject('ActiveBall',ball??{});const groups=eventGroups.get(name.toLowerCase())??[];
    // Flipper Collide uses FireVoidEventParm; it does not pass through native
    // collection FireGroupEvent dispatch, and carries the impact speed.
    if(kind==='Collide')return run(`${name}_${kind}`,...parameters);
    for(const {collection,index}of groups)if(collection.fire_events)run(`${collection.name}_${kind}`,index);
    if(!groups.some(({collection})=>collection.stop_single_events))return run(`${name}_${kind}`);
  }
  function tick(dt){
    time+=dt;
    for(const delay of [...delays])if(delay.at<=time+1e-9){delays.splice(delays.indexOf(delay),1);execute(delay.statement);}
    // Preserve every authored tick, including the 1ms flipper/live-catch timer.
    for(const [key,t]of [...timers])while(t.at<=time+1e-9&&timers.get(key)===t){
      const milliseconds=Number(t.property==='enabled'?t.object.interval:t.object.timerinterval);
      // Timer aliases are bound to their authored object when assets are
      // prepared. No host-object registration is needed on the hot 1ms path.
      t.at+=Math.max(.001,milliseconds/1000);run(t.handler);
    }
    for(const [name,f]of flashes){
      if(time>=f.end){f.light[f.property]=f.finish;flashes.delete(name);}
      else f.light[f.property]=Math.floor(time/f.period)%2;
    }
  }
  return {engine,objects,run,execute,value,tick,hit,schedule,scriptRandom,sequences,lamps,
    init(){run('Table1_Init');execute('bFreePlay=True:BallsPerGame=3:SongVolume=0.2');},
    key(action,down){run(down?'Table1_KeyDown':'Table1_KeyUp',KEY[action]);},
    get time(){return time;},get timers(){return timers;},get delays(){return delays;},
  };
}
