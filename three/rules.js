import {VbsEngine} from '@devscholar/vbs-engine-js';

export const KEY={left:42,right:54,launch:28,start:2,action:57,nudgeLeft:44,nudgeForward:45,nudgeRight:53};
const empty=()=>{};

// Isolated JavaScript VBScript execution preserves the authored rules and numeric
// semantics. No Visual Pinball, COM, native scripting host or global integration.
export function createRules(source,specs,host={}) {
  const engine=new VbsEngine({hostIntegration:false,maxExecutionTime:2000});
  const objects=new Map(),timers=new Map(),delays=[],flashes=new Map(),sequences=new Map();
  const methods=new Set([...source.matchAll(/^\s*(?:Sub|Function)[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  const functions=new Set([...source.matchAll(/^\s*Function[ \t]+(\w+)/gmi)].map(m=>m[1].toLowerCase()));
  let time=0,activeBall=null;
  const run=(name,...args)=>{
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
    const state={name,x:spec.center?.x??spec.position?.x??0,y:spec.center?.y??spec.position?.y??0,z:spec.position?.z??0,
      state:spec.state_u32??spec.state??0,visible:spec.is_visible??true,collidable:spec.is_collidable??true,
      enabled:spec.is_enabled??false,timerenabled:false,timerinterval:spec.timer_interval??100,
      interval:spec.timer_interval??100,blinkinterval:spec.blink_interval??125,intensity:spec.intensity??1,
      color:spec.color??0xffffff,colorfull:spec.color2??0xffffff,imagea:'d_empty',userValue:0,
      isdropped:spec.is_dropped??false,open:false,rotx:0,roty:0,rotz:spec.rot_z??0,
      currentangle:0,startangle:0,endangle:0,transz:0,height:spec.height??50,sequenceactive:false,sequencestate:0};
    const actions={
      createball:()=>host.createBall?.(name),
      createsizedballwithmass:()=>host.createBall?.(name),
      destroyball:()=>host.destroyBall?.(name,activeBall),
      kick:(angle,speed,inclination=0)=>host.kick?.(name,activeBall,angle,speed,inclination),
      rotatetoend:()=>host.flipper?.(lower.startsWith('left')?'left':'right',true),
      rotatetostart:()=>host.flipper?.(lower.startsWith('left')?'left':'right',false),
      pullback:()=>host.plunger?.(true),fire:()=>host.plunger?.(false),
      play:(code,speed=25,repeat=1,pause=0)=>{
        if(spec.kind!=='LightSequencer')return;
        const seq=sequences.get(lower)??{queue:[],lights:(specs.collections.find(c=>c.name.toLowerCase()===spec.collection?.toLowerCase())?.items??[]).map(n=>objects.get(n.toLowerCase())).filter(Boolean),name};
        seq.queue.push({code,speed:Number(speed)||25,repeat:Number(repeat)||1,pause:Number(pause)||0});sequences.set(lower,seq);
      },
      stopplay:()=>{const seq=sequences.get(lower);if(seq)for(const light of seq.lights)light.sequenceactive=false;sequences.delete(lower);},
      stop:empty,initimpulsep:empty,random:empty,initexitsnd:empty,createevents:empty,
      autofire:()=>host.autofire?.(),
      option:(_name,_min,_max,_step,def)=>def,
      getballs:()=>host.balls?.()??[],
    };
    const proxy=new Proxy(state,{
      get(target,key){if(typeof key==='symbol')return target[key];const k=key.toLowerCase();return k in actions?actions[k]:target[k]??0;},
      set(target,key,v){const k=String(key).toLowerCase();target[k]=v;
        if(k==='enabled'&&spec.kind==='Timer'||k==='timerenabled'){
          const enabled=!!v,timerKey=k==='enabled'?lower:`${lower}:timer`;
          if(enabled)timers.set(timerKey,{object:proxy,handler:`${name}_Timer`,at:time+Math.max(.001,Number(k==='enabled'?target.interval:target.timerinterval)/1000),property:k});
          else timers.delete(timerKey);
        }
        if(k==='isdropped'||k==='collidable'||k==='open')host.mechanism?.(name,k,v);
        return true;},
      has(target,key){return typeof key==='string'&&(key.toLowerCase() in target||key.toLowerCase() in actions);},
      ownKeys(target){return [...new Set([...Reflect.ownKeys(target),...Object.keys(actions)])];},
      getOwnPropertyDescriptor(target,key){return {enumerable:true,configurable:true,writable:true,value:proxy[key]};},
    });
    objects.set(lower,proxy);engine.addObject(name,proxy);return proxy;
  }
  for(const spec of specs.objects)object(spec);
  for(let i=1;i<=41;i++)if(!objects.has(`digit${String(i).padStart(3,'0')}`))object({name:`digit${String(i).padStart(3,'0')}`});
  const extras=['Table1','digitgrid','HostPlunger'];
  for(const name of extras)if(!objects.has(name.toLowerCase()))object({name});
  objects.get('table1').width=952;objects.get('table1').height=2115;
  for(const c of specs.collections)engine.addCode(`Dim ${c.name}\n${c.name}=Array(${c.items.filter(n=>objects.has(n.toLowerCase())).join(',')})`);
  const natives={
    LoadEM:empty,DOF:empty,SoundFXDOF:name=>name,SoundFX:name=>name,
    PlaySound:(name,loop=0,volume=1,pan=0)=>host.sound?.(name,{loop,volume,pan}),StopSound:name=>host.stopSound?.(name),
    PlayMusic:name=>host.sound?.(name,{music:true}),EndMusic:()=>host.stopSound?.(),
    LoadValue:(table,key)=>host.load?.(key)??'',SaveValue:(table,key,v)=>host.save?.(key,v),
    RGB:(r,g,b)=>Math.round(r)+Math.round(g)*256+Math.round(b)*65536,
    RGBf:(r,g,b)=>Math.round(r*255)+Math.round(g*255)*256+Math.round(b*255)*65536,
    Nudge:(angle,strength)=>host.nudge?.(angle,strength),GetBalls:()=>host.balls?.()??[],
    Debug: {Print:empty},MsgBox:text=>host.message?.(text),
    GetTextFile:()=>'',Controller:{Stop:empty},
    LeftFlipperKey:KEY.left,RightFlipperKey:KEY.right,PlungerKey:KEY.launch,StartGameKey:KEY.start,
    LeftTiltKey:KEY.nudgeLeft,RightTiltKey:KEY.nudgeRight,CenterTiltKey:KEY.nudgeForward,
    LockBarKey:KEY.action,RightMagnaSave:KEY.action,LeftMagnaSave:29,
    MechanicalTilt:46,AddCreditKey:6,AddCreditKey2:7,DOFPulse:2,DOFOn:1,DOFOff:0,DOFContactors:0,
    SeqRandom:1,SeqAllOff:2,SeqAllOn:3,SeqBlinking:4,SeqUpOn:5,SeqDownOn:6,SeqCircleOutOn:7,
    SeqCircleInOn:8,SeqLeftOn:9,SeqRightOn:10,SeqDiagUpRightOn:11,SeqDiagUpLeftOn:12,
    SeqRadarRightOn:13,SeqRadarLeftOn:14,SeqClockRightOn:15,SeqClockLeftOn:16,
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
  for(const [name,v]of Object.entries(natives))if(typeof v!=='function')engine.addObject(name,v);
  // Visual Pinball sequence constants affect only decorative lamp choreography.
  const sequenceNames=[...new Set((source.match(/\bSeq\w+/g)||[]).map(n=>n.toLowerCase()))];
  for(const [i,name]of sequenceNames.entries())engine.addObject(name,i+1);
  for(const name of new Set(source.match(/\bDOF[A-Za-z]+\b/g)||[]))if(!(name in natives))engine.addObject(name,0);
  // The source enables Option Explicit. Reserve the object-call slots before it
  // runs, so a later ramp assist or ball/ball event can bind its arguments.
  for(let i=0;i<6;i++)engine.addObject(`HostArg${i}`,{});
  engine.addCode(qualify(source));
  function hit(name,kind='Hit',ball){activeBall=ball;engine.addObject('ActiveBall',ball??{});return run(`${name}_${kind}`);}
  function tick(dt){
    time+=dt;
    for(const delay of [...delays])if(delay.at<=time){delays.splice(delays.indexOf(delay),1);execute(delay.statement);}
    // A 1 ms live-catch timer must advance four/five times per 240 Hz physics
    // step. Dropping those ticks stretched its ten-ms window to about forty ms.
    for(const [key,t]of [...timers])while(t.at<=time+1e-9&&timers.get(key)===t){
      const milliseconds=Number(t.property==='enabled'?t.object.interval:t.object.timerinterval);
      t.at+=Math.max(.001,milliseconds/1000);engine.addObject('Me',t.object);run(t.handler);
    }
    for(const [name,f]of flashes){
      if(time>=f.end){f.light[f.property]=f.finish;flashes.delete(name);}
      else f.light[f.property]=Math.floor(time/f.period)%2;
    }
    for(const [key,seq]of [...sequences]){
      if(!seq.current){seq.current=seq.queue.shift();if(!seq.current){for(const light of seq.lights)light.sequenceactive=false;sequences.delete(key);run(`${seq.name}_PlayDone`);continue;}seq.started=time;}
      const current=seq.current,type=sequenceNames[current.code-1]??'seqrandom',age=time-seq.started;
      const duration=type.includes('random')?(current.pause/1000||1):Math.max(.15,current.speed/1000*Math.max(1,seq.lights.length)*current.repeat);
      for(let i=0;i<seq.lights.length;i++){
        const light=seq.lights[i];light.sequenceactive=true;
        light.sequencestate=type.includes('alloff')?0:type.includes('allon')?1:type.includes('blink')?Math.floor(age/.15)%2:type.includes('random')?(Math.sin(i*127.1+Math.floor(age*1000/current.speed)*311.7)>0?1:0):Math.abs(i/seq.lights.length-(age/duration)%1)<.15?1:0;
      }
      if(age>=duration)seq.current=null;
    }
  }
  return {engine,objects,run,execute,value,tick,hit,schedule,
    init(){run('Table1_Init');execute('bFreePlay=True:BallsPerGame=3:SongVolume=0.2');},
    key(action,down){run(down?'Table1_KeyDown':'Table1_KeyUp',KEY[action]);},
    get time(){return time;},get timers(){return timers;},get delays(){return delays;},
  };
}
