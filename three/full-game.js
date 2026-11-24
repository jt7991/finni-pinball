// SPDX-License-Identifier: GPL-3.0-or-later
// Target shape/trigger behavior adapted from Visual Pinball contributors.
// See public/licenses/VPX-Physics-NOTICE.txt.
import RAPIER from '@dimforge/rapier3d-compat';
import {Pinball,STEP,RADIUS,point,BALL_GROUP,NATIVE_BALL_GROUP,STATIC_GROUP,BALL_RESTITUTION,surfaceRestitution} from './physics.js';
import {createRules} from './rules.js';
import {ContactMesh} from './mesh-contact.js';
import {dropTargetFront} from './target-contact.js';
import {CabinetNudge} from './cabinet-nudge.js';
import {TiltBob} from './tilt-bob.js';
import {Spinner} from './spinner.js';
import {Gate} from './gate.js';
import {TargetMotion} from './target-motion.js';
import {Trigger} from './trigger.js';
import {nativeTargetMesh} from './native-target.js';
import {Kicker} from './kicker.js';
import {nativeSurfaceHeight} from './native-ramp.js';
import {nativePitchFactor} from './native-sound.js';
import {nativeTargetEvent} from './native-target-event.js';
import {FlipperAnimation} from './flipper-animation.js';
import {TriggerAnimation,BumperAnimation} from './mechanism-animation.js';
import {applyPlayerSettings,applyBallSettings,applySceneSettings} from './player-settings.js';
import {ScriptProfiler} from './script-profiler.js';

export async function createFullGame(layout,specs,source,emit,media,options={}) {
  await RAPIER.init();
  return new FullGame(layout,specs,source,emit,media,options);
}

class FullGame extends Pinball {
  constructor(layout,specs,source,emit,media,options) {
    super(layout,emit);
    this.nativeDisplacements=this.nativeBallContacts&&this.nativePlayfieldContacts&&this.nativePositionUnits&&layout.physics?.native_displacements!==false;
    this.cabinetNudge=new CabinetNudge();
    this.tiltBob=new TiltBob(down=>this.rules.run(down?'Table1_KeyDown':'Table1_KeyUp',this.rules.value('MechanicalTilt')));
    this.placeholder=this.ball;this.ballCollider.setEnabled(false);
    this.records=[];this.toyRecords=[];this.physicalRecords=[];this.byCollider=new Map();this.captures=new Map();this.mechanisms=new Map(this.nativeMeshes.map(m=>[this.colliderLabels.get(m.collider.handle)?.toLowerCase(),m.collider]));
    this.targetFronts=new Map();this.targetMotions=new Map();this.targetEventBall=null;
    this.frameAnimations=!!options.frameAnimations;this.lastAnimationTime=0;
    this.scriptProfiler=options.scriptBudget?new ScriptProfiler({...options.scriptBudget,...options.scriptClock?{clock:options.scriptClock}:{}}):undefined;
    this.specs=specs;this.media=media;this.soundNames=new Set(specs.sound_names??[]);this.pendingCreate=null;this.syncCount=0;
    for(const spec of specs.objects)this.nativeParts.set(spec.name.toLowerCase(),{...this.nativeParts.get(spec.name.toLowerCase()),...spec});
    for(const spec of specs.objects)this.addMechanism(spec);
    this.visualMotions=new Map();
    for(const trigger of this.triggers)this.visualMotions.set(trigger.spec.name.toLowerCase(),new TriggerAnimation(trigger.spec,trigger.collider,()=>this.rules?.hit(trigger.spec.name,'Animate')));
    for(const [name,bumper]of this.nativeBumpers){const spec=this.nativeParts.get(name);this.visualMotions.set(name,new BumperAnimation({...spec},bumper.collider,()=>this.rules?.hit(spec.name,'Animate')));}
    const storage=options.storage??{
      load:key=>{try{return JSON.parse(localStorage.getItem(`finni-three-rule-${key}`)??'""');}catch{return '';}},
      save:(key,v)=>{try{localStorage.setItem(`finni-three-rule-${key}`,JSON.stringify(v));}catch{}},
    };
    this.rules=createRules(source,specs,{
      scriptProfiler:this.scriptProfiler,
      createBall:name=>this.spawn(name),destroyBall:(name,ball)=>this.remove(name,ball),
      kick:(name,ball,angle,speed,inclination)=>this.kick(name,ball,angle,speed,inclination),
      flipper:(side,down)=>{this.held[side]=down;},plunger:down=>{this.held.launch=down;if(down)this.plunger.pull();else this.launch();},
      plungerPosition:()=>this.plunger.position,
      nudge:(angle,strength)=>this.cabinetNudge.nudge(angle,strength),
      sound:(name,settings)=>{
        if(!this.soundNames.has(String(name).toLowerCase()))return;
        const pitchFactor=nativePitchFactor(settings.randomPitch??0,this.random);
        media?.play(name,{...settings,pitchFactor});
      },stopSound:name=>media?.stop(name),
      shake:strength=>emit({type:'shake',strength}),
      message:text=>emit({type:'message',text}),mechanism:(name,k,v)=>this.mechanism(name,k,v),
      mechanismValue:(name,key)=>{const lower=name.toLowerCase(),motion=this.visualMotions.get(lower);if(motion){const value=motion.spec.kind==='Trigger'?({currentanimoffset:motion.offset})[key]:({currentringoffset:motion.ringOffset,rotx:motion.rotx,roty:motion.roty,enableskirtanimation:motion.enableSkirt,ringspeed:motion.spec.ring_speed,ringdropoffset:motion.spec.ring_drop_offset})[key];if(value!==undefined)return value;}const hit=this.nativeHitObjects.get(lower);if(hit&&key==='hitthreshold')return hit.currentHitThreshold;const target=this.targetMotions.get(lower);if(target)return ({isdropped:target.dropped?1:0,currentanimoffset:target.offset})[key];const gate=this.gates.find(g=>g.spec.name.toLowerCase()===lower);if(gate)return ({currentangle:gate.currentAngle,collidable:gate.enabled,open:gate.open})[key];const sling=this.nativeSlingshots.get(lower);if(sling){const value=({disabled:sling.disabled,slingshotthreshold:sling.threshold})[key];if(value!==undefined)return value;}const bumper=this.nativeBumpers.get(lower);if(bumper)return ({threshold:bumper.bumper.threshold,force:bumper.bumper.force,scatter:bumper.bumper.scatter,hashitevent:bumper.bumper.hit_event,collidable:bumper.collider.isEnabled()})[key];},
      balls:()=>this.physicalRecords.map(r=>r.proxy),random:()=>this.random(),tableSize:{width:layout.width,height:layout.height},...storage,
    });
    const flipperAnimations=this.flippers.map(flipper=>{const spec=this.nativeParts.get(this.colliderLabels.get(flipper.collider.handle).toLowerCase());return new FlipperAnimation(spec,()=>flipper.nativeAngle??Math.fround(Math.PI/2-flipper.angle),()=>this.rules.hit(spec.name,'Animate'));});
    this.frameMechanisms=[...flipperAnimations,...this.targetMotions.values(),...this.visualMotions.values(),...this.rules.sequences.values(),...this.rules.lamps.values()].sort((a,b)=>(a.spec.native_source_order??0)-(b.spec.native_source_order??0));
    this.rules.init();
    this.rules.execute('bFreePlay=True:BallsPerGame=3');
    applyPlayerSettings(this.rules,options.playerSettings);
    applySceneSettings(this.rules,options.sceneSettings);
    applyBallSettings(this.rules,options.ballSettings);
    this.sync();
  }

  surface(spec) {
    if(!spec.surface)return 0;
    const item=this.nativeParts.get(spec.surface.toLowerCase());if(!item)return 0;
    const p=spec.center??spec.position;return nativeSurfaceHeight(item,p.x,p.y)*.01;
  }

  addMechanism(spec) {
    const p=point(spec.center??spec.position??{x:0,y:0}),z=this.surface(spec);
    const name=spec.name,key=name.toLowerCase();let collider;
    if(spec.kind==='Trigger'){
      const points=spec.drag_points??[];
      if(points.length>=3){
        const verts=[];
        for(const h of [z-.05,z+(spec.hit_height??50)*.01])for(const v of points){const q=point(v);verts.push(q.x,q.y,h);}
        const hull=RAPIER.ColliderDesc.convexHull(new Float32Array(verts));
        if(hull)collider=this.world.createCollider(hull.setSensor(true));
      }else collider=this.world.createCollider(RAPIER.ColliderDesc.ball((spec.radius||25)*.01).setTranslation(p.x,p.y,z+RADIUS).setSensor(true));
      if(collider){
        collider.setEnabled(spec.is_enabled);
        if(this.nativeFlipperContacts){
          const trigger=new Trigger(spec,z,(event,rec)=>{
            this.visualMotions?.get(key)?.hit(event==='UnHit');
            if(key==='swplungerrest')rec.inLane=event==='Hit';
            this.rules?.hit(name,event,rec.proxy);
          });trigger.collider=collider;this.triggers.push(trigger);
        }
      }
    }
    if(spec.kind==='HitTarget'){
      const size=spec.size,a=-(spec.rot_z??0)*Math.PI/180,rotation={x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)},base=(spec.position?.z??0)*.01;
      const vertices=spec.collision_mesh.vertices.flatMap(v=>[v[0]*size.x*.01,-v[1]*size.y*.01,v[2]*size.z*.01]);
      collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(spec.collision_mesh.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setTranslation(p.x,p.y,base).setRotation(rotation).setSensor(true).setRestitution(spec.contact_physics.elasticity).setFriction(spec.contact_physics.friction));
      const mesh=new ContactMesh(nativeTargetMesh(spec,spec.collision_mesh.vertices,spec.collision_mesh.indices),{preserveNormals:true,edgeKeys:new Set()}),material={...this.playfieldMaterial,...spec.contact_physics};
      const target=nativeTargetEvent(spec,collider,()=>this.targetMotions.get(key)?.dropped??!!this.rules?.objects.get(key)?.isdropped,()=>this.targetMotions.get(key)?.hit(this.targetEventBall));
      this.nativeHitObjects.set(key,target);
      const fireEvents=!!spec.use_hit_event&&(!spec.target_type.startsWith('drop')||!!spec.is_legacy);
      this.registerMesh({collider,mesh,material,source_order:spec.source_order,targetEvent:{target,fireEvents}});
      this.contactMaterials.set(collider.handle,{collider,...spec.contact_physics});
      if(spec.target_type.startsWith('drop')&&!spec.is_legacy){
        this.registerMesh({collider,mesh:dropTargetFront(spec,mesh),material,source_order:spec.source_order,targetEvent:{target,fireEvents:!!spec.use_hit_event}});
        const y=-.181738*size.y*.01,low=-.160074*size.z*.01,high=1.789926*size.z*.01,half=.55*size.x*.01;
        const centerY=p.y+y*Math.cos(a),centerX=p.x-y*Math.sin(a);
        const sensor=this.world.createCollider(RAPIER.ColliderDesc.cuboid(half,.0005,(high-low)/2)
          .setTranslation(centerX,centerY,base+(low+high)/2).setRotation(rotation).setSensor(true).setCollisionGroups(STATIC_GROUP).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
        this.targetFronts.set(key,sensor);this.tags.set(sensor.handle,{kind:'target-front',name,spec,normal:{x:Math.sin(a),y:-Math.cos(a)}});this.colliderLabels.set(sensor.handle,name+' front');
      }
    }
    if(spec.kind==='Spinner'){
      const a=(spec.rotation??0)*Math.PI/180;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid((spec.length??80)*.005,.035,.6)
        .setTranslation(p.x,p.y,z+.4).setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}).setSensor(true));
      const spinner=new Spinner(spec,z,(event,speed)=>event==='Spin'?this.rules?.run(`${name}_Spin`):this.rules?.run(`${name}_${event}`,speed));
      spinner.collider=collider;this.spinners.push(spinner);
    }
    if(spec.kind==='Gate'&&spec.is_collidable){
      const a=-(spec.rotation??0)*Math.PI/180;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid((spec.length??80)*.005,.035,.3)
        .setTranslation(p.x,p.y,z+.3).setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}).setSensor(true));
      if(this.nativeFlipperContacts){
        const gate=new Gate(spec,z,(event,value)=>event==='Hit'?this.rules?.hit(name,event,value):this.rules?.run(`${name}_${event}`,value));
        gate.collider=collider;this.gates.push(gate);
        if(spec.show_bracket){
          // Brackets have no switch event. Query their exact native circles
          // directly; an extra Rapier box sensor serves no physical purpose.
          const bracket={handle:`gate-bracket:${name}`,isEnabled:()=>true};
          const mesh=new ContactMesh({vertices:[],indices:[]}),angle=Math.fround(spec.rotation*Math.fround(Math.PI/180));
          for(const sign of [-1,1]){const x=Math.fround(Math.fround(spec.center.x)+sign*Math.fround(Math.fround(Math.cos(angle))*Math.fround(spec.length*.5))),y=Math.fround(Math.fround(spec.center.y)+sign*Math.fround(Math.fround(Math.sin(angle))*Math.fround(spec.length*.5)));mesh.addCircle(point({x,y}),.0001,z,z+spec.height*.01);}
          this.colliderLabels.set(bracket.handle,name+' bracket');this.registerMesh({collider:bracket,mesh,native_source_order:spec.native_source_order,treeRank:2,material:{elasticity:.3,elasticity_falloff:0,friction:.3,scatter:0,default_scatter:0,difficulty:0}});
        }
      }
    }
    if(spec.kind==='Kicker'){
      collider=this.world.createCollider(RAPIER.ColliderDesc.cylinder(.25,(spec.radius??30)*.01)
        .setTranslation(p.x,p.y,z+.25).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}).setSensor(true));
      collider.setEnabled(spec.is_enabled);
      if(this.nativeTreeEnabled){const kicker=new Kicker(spec,z,rec=>this.captures.set(key,rec),(event,rec)=>this.rules?.hit(name,event,rec.proxy));kicker.collider=collider;this.kickers.push(kicker);}
    }
    if(collider){
      if(spec.kind==='HitTarget')this.targetMotions.set(key,new TargetMotion(spec,collider,()=>Math.round(this.time*1000),(event,ball)=>{
        const previous=this.targetEventBall;this.targetEventBall=ball;
        try{this.rules?.hit(name,event,ball??this.records[0]?.proxy);}finally{this.targetEventBall=previous;}
      }));
      collider.setCollisionGroups(STATIC_GROUP);collider.setRestitution(surfaceRestitution(collider.restitution()));collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
      this.colliderLabels.set(collider.handle,name);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      this.tags.set(collider.handle,{kind:spec.kind==='Kicker'&&this.nativeTreeEnabled?'kicker-body':spec.kind==='Trigger'&&this.nativeFlipperContacts?'trigger-body':spec.kind==='Spinner'?'spinner-body':spec.kind==='Gate'&&this.nativeFlipperContacts?'gate-body':this.targetFronts.has(key)?'target-body':'mechanism',name,spec});this.mechanisms.set(key,collider);
    }
  }

  mechanism(name,key,v) {
    const collider=this.mechanisms.get(name.toLowerCase());if(!collider)return;
    const sling=this.nativeSlingshots.get(name.toLowerCase());
    if(sling&&key==='disabled'){sling.disabled=!!v;return;}
    if(sling&&key==='slingshotthreshold'){sling.threshold=Math.fround(Number(v));return;}
    const bumper=this.nativeBumpers.get(name.toLowerCase());
    if(bumper){
      if(key==='collidable')collider.setEnabled(!!v);
      else if(key==='hashitevent')bumper.bumper.hit_event=!!v;
      else if(['threshold','force','scatter'].includes(key)){bumper.bumper[key]=Math.fround(Number(v));if(key==='scatter')bumper.material.scatter=bumper.bumper.scatter;}
      else if(key==='enableskirtanimation')this.visualMotions.get(name.toLowerCase()).setSkirtEnabled(v);
      else if(key==='playhit')this.visualMotions.get(name.toLowerCase()).hit();
      else if(['ringspeed','ringdropoffset'].includes(key))this.visualMotions.get(name.toLowerCase()).spec[key==='ringspeed'?'ring_speed':'ring_drop_offset']=Math.fround(Number(v));
      return;
    }
    const target=this.targetMotions.get(name.toLowerCase());
    if(target){if(key==='isdropped')target.setDropped(v,this.targetEventBall??this.records[0]?.proxy);if(key==='collidable')target.setCollidable(v);if(key==='hashitevent')target.fireEvents=!!v;if(key==='visible')target.visible=!!v;this.targetFronts.get(name.toLowerCase())?.setEnabled(collider.isEnabled());return;}
    if(this.nativeParts.get(name.toLowerCase())?.kind==='HitTarget'){
      const state=this.rules?.objects.get(name.toLowerCase());
      if(key==='isdropped'||key==='collidable')collider.setEnabled((key==='collidable'?!!v:!!state?.collidable)&&!(key==='isdropped'?!!v:!!state?.isdropped));
      return;
    }
    const gate=this.gates.find(g=>g.spec.name.toLowerCase()===name.toLowerCase());
    if(gate){if(key==='open')gate.setOpen(v);if(key==='collidable')gate.setCollidable(v);return;}
    if(key==='isdropped'){collider.setEnabled(!v);this.targetFronts.get(name.toLowerCase())?.setEnabled(!v);}
    if(key==='collidable')collider.setEnabled(!!v);
    if(key==='enabled')collider.setEnabled(!!v);
    // Gates stay sensors: per-ball direction decides whether their flap blocks.
  }

  spawn(name) {
    const key=name.toLowerCase(),spec=this.specs.objects.find(s=>s.name.toLowerCase()===key);
    const p={...point(spec?.center??{x:293.68,y:473.63}),z:this.surface(spec??{})+RADIUS};
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z)
      .setCcdEnabled(true).setCanSleep(false));
    if(this.nativePlayfieldContacts)body.setGravityScale(0,true);
    const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1).setRestitution(BALL_RESTITUTION).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(this.nativeBallContacts?NATIVE_BALL_GROUP:BALL_GROUP).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    if(this.nativePositionUnits)this.nativeBall(body).body.setTranslation(p,true);
    const isToy=['he','la','ra'].includes(key),rec={body,collider,isToy,held:key,inLane:false,previous:{...p},cooldowns:new Map(),laneTime:this.time};
    const tableDecal=this.rules?.objects.get('table1').ballfrontdecal;
    rec.render={visible:true,color:0xffffff,reflectionenabled:true,forcereflection:false,bulbintensityscale:Math.fround(this.specs.ball_settings?.default_bulb_intensity_scale_on_ball??.15),playfieldreflectionscale:1,frontdecal:typeof tableDecal==='string'?tableDecal:this.specs.ball_settings?.ball_image_front??''};
    this.scriptBallSequence??=0;
    rec.scriptID=this.scriptBallSequence++;
    rec.proxy=new Proxy({radius:25,mass:1,id:body.handle},{
      get:(target,key)=>{
        if(key==='getProperty'||key==='setProperty'||key==='hasMethod')return target[key];
        if(typeof key!=='string')return target[key];key=key.toLowerCase();
        if(rec.removed&&!rec.detachedNative)return rec.lastState[key]??target[key]??0;
        if(Object.hasOwn(rec.render,key))return rec.render[key];
        if(/^ang(mom|vel)[xyz]$/.test(key)){
          const axis=key.at(-1),sign=axis==='y'?1:-1;
          if(this.nativePositionUnits){const native=this.nativeBall(body);native.syncAngular();return key.startsWith('angmom')?native.angularMomentum[axis]:Math.fround(native.angularMomentum[axis]/native.inertia);}
          return body.angvel()[axis]*sign*(key.startsWith('angmom')?2.5*body.mass():.01);
        }
        const q=(this.nativePositionUnits?this.nativeBall(body).body:body).translation(),v=(rec.detachedNative?.rapier??body).linvel();
        return ({x:q.x*100,y:2115-q.y*100,z:q.z*100,velx:v.x,vely:-v.y,velz:v.z})[key]??target[key]??0;
      },
      set:(_target,key,v)=>{key=String(key).toLowerCase();
        if(rec.removed&&!rec.detachedNative){rec.lastState[key]=v;return true;}
        if(Object.hasOwn(rec.render,key)){rec.render[key]=key==='frontdecal'?String(v):['visible','reflectionenabled','forcereflection'].includes(key)?!!v:Math.fround(Number(v));return true;}
        if(/^angmom[xyz]$/.test(key)){const axis=key.at(-1);if(this.nativePositionUnits){this.nativeBall(body).setAngularMomentum(axis,v);return true;}const w={...body.angvel()};w[axis]=v*(axis==='y'?1:-1)/(2.5*body.mass());body.setAngvel(w,true);return true;}
        if(/^angvel[xyz]$/.test(key))return true; // Deprecated read-only native properties.
        const positionBody=this.nativePositionUnits?this.nativeBall(body).body:body;
        const velocityBody=rec.detachedNative?.rapier??body;
        const p={...positionBody.translation()},vel={...velocityBody.linvel()};
        if(key==='x')p.x=v*.01;if(key==='y')p.y=(2115-v)*.01;if(key==='z')p.z=v*.01;
        if(key==='velx')vel.x=v;if(key==='vely')vel.y=-v;if(key==='velz')vel.z=v;
        positionBody.setTranslation(p,true);velocityBody.setLinvel(vel,true);return true;},
    });
    // Ball's native COM getters return VT_R4 even for integral values. Keep
    // that Variant type through authored arithmetic (for example speed caps),
    // while JavaScript and render callers continue to receive plain numbers.
    const singleProperty=key=>/^(?:[xyz]|vel[xyz]|ang(?:mom|vel)[xyz]|radius|mass|bulbintensityscale|playfieldreflectionscale)$/.test(key);
    Object.defineProperties(rec.proxy,{
      hasMethod:{value:()=>false},
      getProperty:{value:name=>{const key=String(name).toLowerCase(),value=key==='id'?rec.scriptID:rec.proxy[key];return {type:singleProperty(key)?'Single':typeof value==='boolean'?'Boolean':typeof value==='string'?'String':Number.isInteger(value)?'Long':'Double',value:singleProperty(key)?Math.fround(value):value};}},
      setProperty:{value:(name,variant)=>{const key=String(name).toLowerCase();rec.proxy[key]=singleProperty(key)?Math.fround(variant.value):variant.value;}},
    });
    if(rec.held)body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    (isToy?this.toyRecords:this.records).push(rec);this.physicalRecords.push(rec);this.byCollider.set(collider.handle,rec);this.captures.set(key,rec);this.pendingCreate=rec;if(!isToy)this.ball=body;
    const kicker=this.kickers.find(k=>k.key===key);if(kicker){kicker.members.set(this.nativeBall(body).body,1);kicker.captured=rec;}
    return rec.proxy;
  }

  remove(name,ball) {
    const rec=[...this.toyRecords,...this.records].find(r=>r.proxy===ball)??this.captures.get(name.toLowerCase());if(!rec)return;
    // Native COM references remain readable after DestroyBall removes a body
    // from physics. Rules may still hold ActiveBall during the same callback.
    rec.lastState=Object.fromEntries(['x','y','z','velx','vely','velz','angmomx','angmomy','angmomz','angvelx','angvely','angvelz'].map(key=>[key,rec.proxy[key]]));
    rec.lastRenderLocked=!!rec.held&&rec.held!=='lane';
    if(this.nativePositionUnits)rec.detachedNative=this.nativeBall(rec.body).detach();
    rec.removed=true;this.physicalRecords.splice(this.physicalRecords.indexOf(rec),1);for(const kicker of this.kickers)kicker.release(rec);
    const list=rec.isToy?this.toyRecords:this.records;this.byCollider.delete(rec.collider.handle);list.splice(list.indexOf(rec),1);
    for(const [key,value]of this.captures)if(value===rec)this.captures.delete(key);
    this.world.removeRigidBody(rec.body);this.ball=this.records[0]?.body??this.placeholder;
  }

  kick(name,_ball,angle,speed,inclination=0) {
    const key=name.toLowerCase(),rec=this.captures.get(key);if(this.pendingCreate===rec)this.pendingCreate=null;
    if(!rec)return;
    for(const kicker of this.kickers)kicker.release(rec);
    // VPX Kick releases at the captured center. Only KickXYZ/KickZ translate
    // it; inventing a lateral offset changes both scoop shots and lane feeds.
    const f=Math.fround,a=f(f(angle)*f(Math.PI/180));let elevation=f(inclination),horizontal=f(speed);
    if(Math.abs(elevation)>f(Math.PI/2))elevation=f(elevation*f(Math.PI/180));
    const vertical=f(f(Math.sin(elevation))*horizontal);if(vertical>0)horizontal=f(horizontal*f(Math.cos(elevation)));
    rec.held=null;rec.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    if(this.nativePositionUnits){const native=this.nativeBall(rec.body);native.collisionGap=0;this.ballSpin.impact(native.body,0);}
    rec.body.setAngvel({x:0,y:0,z:0},true);
    rec.body.setLinvel({x:f(f(Math.sin(a))*horizontal),y:f(f(Math.cos(a))*horizontal),z:vertical},true);
    this.captures.delete(key);
  }

  start(players=1){
    const count=Number.isInteger(players)&&players>=1&&players<=4?players:1;
    for(let i=0;i<count;i++){this.input('start',true);this.input('start',false);}
  }
  input(action,down){if(action==='launch'&&down===this.held.launch)return;this.rules.key(action,down);this.sync();}
  release(){
    this.charge=0;this.held.launch=false;
    this.plunger.cancel();
    if(this.rules){if(this.held.left)this.rules.key('left',false);if(this.held.right)this.rules.key('right',false);}
    this.held.left=false;this.held.right=false;
  }
  launch(){
    this.plunger.fire();this.charge=0;
  }
  autofire(){
    this.rules.objects.get('hostplunger').autofire();
  }

  sync(){
    const playing=!!this.rules.value('bGameInPlay'),old=this.state;
    this.state=playing?'playing':old==='playing'?'over':old;
    this.player=Number(this.rules.value('CurrentPlayer'))||1;
    this.score=Number(this.rules.value(`Score(${this.player})`))||0;
    this.ballNumber=playing?4-Number(this.rules.value(`BallsRemaining(${this.player})`)):0;
    this.tilted=!!this.rules.value('Tilted');
    this.inLane=this.records.some(r=>r.inLane);
    this.gameState={playing,entering:!!this.rules.value('hsbModeActive'),player:this.player,
      players:Number(this.rules.value('PlayersPlayingGame'))||1,scores:[1,2,3,4].map(i=>Number(this.rules.value(`Score(${i})`))||0)};
    if(playing&&old!=='playing')this.emit({type:'start'});
    if(!playing&&old==='playing')this.emit({type:'over'});
  }

  updateAnimations(milliseconds,sequences=true){
    for(const mechanism of this.frameMechanisms){
      if(!mechanism.collider){if(sequences)mechanism.update(mechanism.spec.kind==='Light'?milliseconds:Math.round(this.time*1000));}
      else{mechanism.update(milliseconds);this.targetFronts.get(mechanism.spec.name.toLowerCase())?.setEnabled(mechanism.collider.isEnabled());}
    }
  }

  prepareFrame(){
    this.scriptProfiler?.beginFrame();
    const now=Math.round(this.time*1000),elapsed=now-this.lastAnimationTime;this.lastAnimationTime=now;
    if(elapsed>0)this.updateAnimations(Math.fround(elapsed));
  }

  get scriptStats(){return this.scriptProfiler?.snapshot()??null;}

  step({dispatchTimers}={}){
    if(dispatchTimers===undefined){dispatchTimers=this.scriptProfiler?.timersAllowed??true;if(!dispatchTimers)this.scriptProfiler.deferTimers();}
    // Native PhysicsEngine processes its first physical interval at GameTime0.
    // Subsequent intervals advance the clock before running authored timers.
    if(this.physicsStarted){this.time+=STEP;this.rules.tick(STEP,dispatchTimers);}
    else{this.physicsStarted=true;this.rules.tick(0,dispatchTimers);}
    if(!this.frameAnimations)this.updateAnimations(STEP*1000,false);
    const nudge=this.cabinetNudge.step(this.nativePositionUnits?this.nativeIncline:this.incline);
    this.tiltBob.step(this.cabinetNudge.acceleration);
    const physicalRecords=this.physicalRecords;
    for(const rec of physicalRecords){rec.previous={...rec.body.translation()};rec.previousVelocity={...rec.body.linvel()};}
    this.driveFlippers();
    for(const f of this.flippers){
      const state=this.rules.objects.get(f.side==='left'?'leftflipper':'rightflipper');
      state.startangle=90-f.rest*180/Math.PI;state.endangle=90-f.raised*180/Math.PI;
      f.collider.setRestitution(surfaceRestitution(Number(state.elasticity)||0));
    }
    this.prepareContacts(physicalRecords);
    this.stepPhysics(physicalRecords,nudge);
    for(const spinner of this.spinners)this.rules.objects.get(spinner.spec.name.toLowerCase()).currentangle=spinner.currentAngle;
    this.charge=this.held.launch?1.2*this.plunger.charge:0;
    this.readFlippers();
    for(const f of this.flippers){
      const state=this.rules.objects.get(`${f.side}flipper`);
      state.currentangle=f.nativeAngle!==undefined?Math.fround(f.nativeAngle*Math.fround(180/Math.PI)):Math.abs(f.angle-f.raised)<.0001?state.endangle:Math.abs(f.angle-f.rest)<.0001?state.startangle:90-f.angle*180/Math.PI;
    }
    this.events.drainCollisionEvents((a,b,started)=>{
      const rec=this.byCollider.get(a)??this.byCollider.get(b);if(!rec||rec.held)return;
      const other=this.byCollider.get(a)===rec?this.byCollider.get(b):this.byCollider.get(a);
      if(other){if(started&&!this.nativeBallContacts){const u=rec.body.linvel(),v=other.body.linvel();this.rules.run('OnBallBallCollision',rec.proxy,other.proxy,Math.hypot(u.x-v.x,u.y-v.y,u.z-v.z));}return;}
      const tag=this.tags.get(this.byCollider.has(a)?b:a);if(!tag)return;
      if(tag.kind==='target-body'||tag.kind==='spinner-body'||tag.kind==='gate-body'||tag.kind==='trigger-body'||tag.kind==='kicker-body')return;
      if(this.nativePositionUnits&&tag.spec?.kind==='HitTarget')return;
      if(this.nativeFlipperContacts&&tag.kind==='bumper')return;
      if(this.nativePositionUnits&&tag.kind==='sling')return;
      if(this.nativePositionUnits&&tag.kind==='flipper')return;
      if(!started){if(tag.spec?.kind==='Trigger'){if(tag.name.toLowerCase()==='swplungerrest')rec.inLane=false;this.rules.hit(tag.name,'UnHit',rec.proxy);}return;}
      if(tag.spec?.kind==='Trigger'){
        if(tag.name.toLowerCase()==='swplungerrest')rec.inLane=true;
        this.rules.hit(tag.name,'Hit',rec.proxy);return;
      }
      const key=tag.name.toLowerCase();if((rec.cooldowns.get(key)||0)>this.time)return;
      rec.cooldowns.set(key,this.time+.1);
      if(tag.kind==='bumper'){
        const p=rec.body.translation(),dx=p.x-tag.p.x,dy=p.y-tag.p.y,d=Math.hypot(dx,dy)||1;
        if(this.nativeFlipperContacts&&(rec.previousVelocity.x*dx+rec.previousVelocity.y*dy)/d> -tag.threshold)return;
        if(!this.nativeFlipperContacts&&!this.tilted)rec.body.applyImpulse({x:dx/d*6,y:dy/d*6,z:0},true);this.rules.hit(tag.name,'Hit',rec.proxy);
      }else if(tag.kind==='sling'){
        const p=rec.body.translation();if(!this.nativeFlipperContacts&&!this.tilted)rec.body.applyImpulse({x:p.x<4.76?4:-4,y:5,z:0},true);
        this.rules.hit(tag.name,'Slingshot',rec.proxy);
      }else if(tag.kind==='flipper'){
        this.rules.hit(tag.name,'Collide',rec.proxy);
      }else if(tag.spec?.kind==='Gate'){
        const state=this.rules.objects.get(key),a=-(tag.spec.rotation??0)*Math.PI/180;
        const nx=-Math.sin(a),ny=Math.cos(a),v=rec.body.linvel(),normal=v.x*nx+v.y*ny;
        if(!state.open&&normal<0)rec.body.setLinvel({x:v.x-1.6*normal*nx,y:v.y-1.6*normal*ny,z:v.z},true);
      }else if(tag.spec?.kind==='HitTarget'){
        const drop=tag.spec.target_type?.startsWith('drop');
        if(drop){
          const v=rec.previousVelocity,n=tag.normal;
          if(n&&v.x*n.x+v.y*n.y>-(tag.spec.threshold??2))return;
          if(this.targetMotions.get(key)?.hit(rec.proxy))this.rules.hit(tag.name,'Hit',rec.proxy);
        }else this.rules.hit(tag.name,'Hit',rec.proxy);
      }else if(tag.spec?.kind==='Kicker'){
        rec.held=key;rec.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);rec.body.setLinvel({x:0,y:0,z:0},true);
        this.captures.set(key,rec);this.rules.hit(tag.name,'Hit',rec.proxy);
      }else {if(key==='swplungerrest')rec.inLane=true;this.rules.hit(tag.name,'Hit',rec.proxy);}
    });
    // Native play uses the authored Drain kicker and its collision volume.
    // A screen-space cutoff removes balls early and changes ball-save timing.
    if(!this.nativePositionUnits)for(const rec of [...this.records]){
      if(rec.held)continue;
      const p=rec.body.translation();
      if(p.y<1||p.x<-.5||p.x>10||p.z<-.5)this.rules.hit('Drain','Hit',rec.proxy);
    }
    if(++this.syncCount%Math.round(1/(30*STEP))===0)this.sync();
  }
}
