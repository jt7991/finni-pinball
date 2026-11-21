import RAPIER from '@dimforge/rapier3d-compat';
import {Pinball,STEP,RADIUS,point,BALL_GROUP,STATIC_GROUP} from './physics.js';
import {createRules} from './rules.js';

export async function createFullGame(layout,specs,source,emit,media) {
  await RAPIER.init();
  return new FullGame(layout,specs,source,emit,media);
}

class FullGame extends Pinball {
  constructor(layout,specs,source,emit,media) {
    super(layout,emit);
    this.placeholder=this.ball;this.ballCollider.setEnabled(false);
    this.records=[];this.byCollider=new Map();this.captures=new Map();this.mechanisms=new Map();
    this.specs=specs;this.media=media;this.pendingCreate=null;this.syncCount=0;
    for(const spec of specs.objects)this.addMechanism(spec);
    const storage={
      load:key=>{try{return JSON.parse(localStorage.getItem(`finni-three-rule-${key}`)??'""');}catch{return '';}},
      save:(key,v)=>{try{localStorage.setItem(`finni-three-rule-${key}`,JSON.stringify(v));}catch{}},
    };
    this.rules=createRules(source,specs,{
      createBall:name=>this.spawn(name),destroyBall:(name,ball)=>this.remove(name,ball),
      kick:(name,ball,angle,speed,inclination)=>this.kick(name,ball,angle,speed,inclination),
      flipper:(side,down)=>{this.held[side]=down;},plunger:down=>{this.held.launch=down;if(!down)this.launch();},
      autofire:()=>{this.charge=1.2;this.launch();},
      nudge:(angle,strength)=>{for(const rec of this.records)if(!rec.held)rec.body.applyImpulse({x:Math.sin(angle*Math.PI/180)*strength,y:Math.cos(angle*Math.PI/180)*strength,z:.25},true);},
      sound:(name,settings)=>media?.play(name,settings),stopSound:name=>media?.stop(name),
      shake:strength=>emit({type:'shake',strength}),
      message:text=>emit({type:'message',text}),mechanism:(name,k,v)=>this.mechanism(name,k,v),
      balls:()=>this.records.map(r=>r.proxy),...storage,
    });
    this.rules.init();
    this.rules.execute('bFreePlay=True:BallsPerGame=3');
    this.sync();
  }

  surface(spec) {
    if(!spec.surface)return 0;
    const ramp=this.ramps.find(r=>r.name.toLowerCase()===spec.surface.toLowerCase());
    if(!ramp)return 0;
    const p=point(spec.center??spec.position),edge=ramp.edges[0];
    let nearest=edge[0],distance=Infinity;
    for(const a of edge){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<distance){distance=d;nearest=a;}}
    return nearest.z;
  }

  addMechanism(spec) {
    const p=point(spec.center??spec.position??{x:0,y:0}),z=this.surface(spec);
    const name=spec.name,key=name.toLowerCase();let collider;
    if(spec.kind==='Trigger'&&spec.is_enabled){
      const points=spec.drag_points??[];
      if(points.length>=3){
        const verts=[];
        for(const h of [z-.05,z+(spec.hit_height??50)*.01])for(const v of points){const q=point(v);verts.push(q.x,q.y,h);}
        const hull=RAPIER.ColliderDesc.convexHull(new Float32Array(verts));
        if(hull)collider=this.world.createCollider(hull.setSensor(true));
      }else collider=this.world.createCollider(RAPIER.ColliderDesc.ball((spec.radius||25)*.01).setTranslation(p.x,p.y,z+RADIUS).setSensor(true));
    }
    if(spec.kind==='HitTarget'){
      const size=spec.size??{x:36,y:12,z:50},a=(spec.rot_z??0)*Math.PI/180;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(.12,size.x*.005),.065,.3)
        .setTranslation(p.x,p.y,Math.max(.3,(spec.position?.z??0)*.01+.3)).setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)})
        .setRestitution(.5).setFriction(.1));
    }
    if(spec.kind==='Spinner'){
      const a=(spec.rotation??0)*Math.PI/180;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid((spec.length??80)*.005,.035,.6)
        .setTranslation(p.x,p.y,z+.4).setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}).setSensor(true));
    }
    if(spec.kind==='Gate'&&spec.is_collidable){
      const a=-(spec.rotation??0)*Math.PI/180;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid((spec.length??80)*.005,.035,.3)
        .setTranslation(p.x,p.y,z+.3).setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)}).setSensor(true));
    }
    if(spec.kind==='Kicker'&&['hellhouse','lock'].includes(key)){
      collider=this.world.createCollider(RAPIER.ColliderDesc.cylinder(.25,(spec.radius??30)*.01)
        .setTranslation(p.x,p.y,z+.25).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}).setSensor(true));
    }
    if(collider){
      collider.setCollisionGroups(STATIC_GROUP);collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
      this.colliderLabels.set(collider.handle,name);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      this.tags.set(collider.handle,{kind:'mechanism',name,spec});this.mechanisms.set(key,collider);
    }
  }

  mechanism(name,key,v) {
    const collider=this.mechanisms.get(name.toLowerCase());if(!collider)return;
    if(key==='isdropped')collider.setEnabled(!v);
    if(key==='collidable')collider.setEnabled(!!v);
    // Gates stay sensors: per-ball direction decides whether their flap blocks.
  }

  spawn(name) {
    const key=name.toLowerCase(),spec=this.specs.objects.find(s=>s.name.toLowerCase()===key);
    const p=key==='ballrelease'?{x:9,y:2.65,z:RADIUS+.01}:{...point(spec?.center??{x:293.68,y:473.63}),z:this.surface(spec??{})+RADIUS};
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z)
      .setCcdEnabled(true).setLinearDamping(.025).setAngularDamping(.12).setCanSleep(false));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1).setRestitution(.9).setFriction(.045)
      .setCollisionGroups(BALL_GROUP).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    const rec={body,collider,held:key==='ballrelease'?'lane':key,previous:{...p},cooldowns:new Map(),laneTime:this.time};
    rec.proxy=new Proxy({radius:25,mass:1,id:body.handle},{
      get:(target,key)=>{
        if(typeof key!=='string')return target[key];key=key.toLowerCase();const q=body.translation(),v=body.linvel();
        return ({x:q.x*100,y:2115-q.y*100,z:q.z*100,velx:v.x,vely:-v.y,velz:v.z})[key]??target[key]??0;
      },
      set:(_target,key,v)=>{key=String(key).toLowerCase();const p={...body.translation()},vel={...body.linvel()};
        if(key==='x')p.x=v*.01;if(key==='y')p.y=(2115-v)*.01;if(key==='z')p.z=v*.01;
        if(key==='velx')vel.x=v;if(key==='vely')vel.y=-v;if(key==='velz')vel.z=v;
        body.setTranslation(p,true);body.setLinvel(vel,true);return true;},
    });
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    this.records.push(rec);this.byCollider.set(collider.handle,rec);this.captures.set(key,rec);this.pendingCreate=rec;this.ball=body;
    if(key==='ballrelease'){
      this.inLane=true;this.rules.schedule(0,'swPlungerRest_Hit');
    }
    return rec.proxy;
  }

  remove(name,ball) {
    const rec=this.records.find(r=>r.proxy===ball)??this.captures.get(name.toLowerCase());if(!rec)return;
    this.byCollider.delete(rec.collider.handle);this.records.splice(this.records.indexOf(rec),1);
    for(const [key,value]of this.captures)if(value===rec)this.captures.delete(key);
    this.world.removeRigidBody(rec.body);this.ball=this.records[0]?.body??this.placeholder;
  }

  kick(name,_ball,angle,speed,inclination=0) {
    const key=name.toLowerCase(),rec=this.pendingCreate??this.captures.get(key);this.pendingCreate=null;
    if(!rec)return;
    if(key==='ballrelease')return; // Ball rolls into its plunger rest; launch is player controlled.
    const a=angle*Math.PI/180;
    rec.held=null;rec.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    const p=rec.body.translation();rec.body.setTranslation({x:p.x+Math.sin(a)*.4,y:p.y+Math.cos(a)*.4,z:p.z+.02},true);
    rec.body.setLinvel({x:Math.sin(a)*speed,y:Math.cos(a)*speed,z:Math.sin(inclination)*speed},true);
    rec.cooldowns.set(key,this.time+.7);this.captures.delete(key);
  }

  start(){this.input('start',true);this.input('start',false);}
  input(action,down){if(action==='launch'&&!down&&!this.held.launch)return;this.rules.key(action,down);this.sync();}
  release(){
    this.charge=0;this.held.launch=false;
    if(this.rules){this.rules.key('left',false);this.rules.key('right',false);}
    this.held.left=false;this.held.right=false;
  }
  launch(){
    const rec=this.records.find(r=>r.held==='lane');if(!rec||this.state!=='playing')return;
    rec.held=null;rec.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    rec.body.setLinvel({x:0,y:24+Math.min(1,this.charge/1.2)*21,z:0},true);
    this.captures.delete('ballrelease');this.inLane=false;this.charge=0;this.rules.hit('swPlungerRest','UnHit',rec.proxy);
  }

  sync(){
    const playing=!!this.rules.value('bGameInPlay'),old=this.state;
    this.state=playing?'playing':old==='playing'?'over':old;
    this.player=Number(this.rules.value('CurrentPlayer'))||1;
    this.score=Number(this.rules.value(`Score(${this.player})`))||0;
    this.ballNumber=playing?4-Number(this.rules.value(`BallsRemaining(${this.player})`)):0;
    this.tilted=!!this.rules.value('Tilted');
    this.inLane=this.records.some(r=>r.held==='lane');
    this.gameState={playing,entering:!!this.rules.value('hsbModeActive'),player:this.player,
      players:Number(this.rules.value('PlayersPlayingGame'))||1,scores:[1,2,3,4].map(i=>Number(this.rules.value(`Score(${i})`))||0)};
    if(playing&&old!=='playing')this.emit({type:'start'});
    if(!playing&&old==='playing')this.emit({type:'over'});
  }

  step(){
    this.time+=STEP;
    for(const rec of this.records)rec.previous={...rec.body.translation()};
    this.driveFlippers();
    for(const f of this.flippers){
      const state=this.rules.objects.get(f.side==='left'?'leftflipper':'rightflipper');
      state.startangle=90-f.rest*180/Math.PI;state.endangle=90-f.raised*180/Math.PI;
      state.currentangle=Math.abs(f.angle-f.raised)<.0001?state.endangle:Math.abs(f.angle-f.rest)<.0001?state.startangle:90-f.angle*180/Math.PI;
      f.collider.setRestitution(Number(state.elasticity)||0);
    }
    if(this.held.launch&&this.inLane)this.charge=Math.min(1.2,this.charge+STEP);
    this.world.step(this.events);
    this.readFlippers();
    this.events.drainCollisionEvents((a,b,started)=>{
      const rec=this.byCollider.get(a)??this.byCollider.get(b);if(!rec||rec.held)return;
      const other=this.byCollider.get(a)===rec?this.byCollider.get(b):this.byCollider.get(a);
      if(other){if(started){const u=rec.body.linvel(),v=other.body.linvel();this.rules.run('OnBallBallCollision',rec.proxy,other.proxy,Math.hypot(u.x-v.x,u.y-v.y,u.z-v.z));}return;}
      const tag=this.tags.get(this.byCollider.has(a)?b:a);if(!tag)return;
      if(!started){if(tag.spec?.kind==='Trigger')this.rules.hit(tag.name,'UnHit',rec.proxy);return;}
      const key=tag.name.toLowerCase();if((rec.cooldowns.get(key)||0)>this.time)return;
      rec.cooldowns.set(key,this.time+.1);
      if(tag.kind==='bumper'){
        const p=rec.body.translation(),dx=p.x-tag.p.x,dy=p.y-tag.p.y,d=Math.hypot(dx,dy)||1;
        if(!this.tilted)rec.body.applyImpulse({x:dx/d*6,y:dy/d*6,z:0},true);this.rules.hit(tag.name,'Hit',rec.proxy);
      }else if(tag.kind==='sling'){
        const p=rec.body.translation();if(!this.tilted)rec.body.applyImpulse({x:p.x<4.76?4:-4,y:5,z:0},true);
        this.rules.hit(tag.name,'Slingshot',rec.proxy);
      }else if(tag.kind==='flipper'){
        this.rules.hit(tag.name,'Collide',rec.proxy);
      }else if(tag.spec?.kind==='Gate'){
        const state=this.rules.objects.get(key),a=-(tag.spec.rotation??0)*Math.PI/180;
        const nx=-Math.sin(a),ny=Math.cos(a),v=rec.body.linvel(),normal=v.x*nx+v.y*ny;
        if(!state.open&&normal<0)rec.body.setLinvel({x:v.x-1.6*normal*nx,y:v.y-1.6*normal*ny,z:v.z},true);
      }else if(tag.spec?.kind==='Spinner'){
        const v=rec.body.linvel(),spins=Math.min(24,Math.max(1,Math.round(Math.hypot(v.x,v.y)*.7)));
        for(let i=0;i<spins;i++)this.rules.schedule(i*55,`${tag.name}_Spin`);
      }else if(tag.spec?.kind==='HitTarget'){
        const drop=tag.spec.target_type?.startsWith('drop');
        if(drop)this.rules.objects.get(key).isdropped=true;
        this.rules.hit(tag.name,drop?'Dropped':'Hit',rec.proxy);
      }else if(tag.spec?.kind==='Kicker'){
        rec.held=key;rec.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);rec.body.setLinvel({x:0,y:0,z:0},true);
        this.captures.set(key,rec);this.rules.hit(tag.name,'Hit',rec.proxy);
      }else this.rules.hit(tag.name,'Hit',rec.proxy);
    });
    for(const rec of [...this.records]){
      if(rec.held)continue;
      const p=rec.body.translation(),v=rec.body.linvel();
      if(p.x>=2.4&&p.x<=2.92&&p.y>=17.81&&p.y<=18.25&&p.z>=.29&&p.z<=.6)this.rules.run('FinniLockRampAssist',rec.proxy);
      const maximum=Math.max(Math.abs(v.x),Math.abs(v.y));
      if(maximum>52)rec.body.setLinvel({x:v.x*52/maximum,y:v.y*52/maximum,z:v.z},true);
      if(rec.previous.z>.35&&p.z<.3&&v.z<-1)this.media?.play('fx_balldrop',{volume:Math.min(1,Math.abs(v.z)/17),pan:p.x/4.76-1});
      if(p.x>8.85&&p.y<2.9&&Math.abs(v.y)<1&&this.time-rec.laneTime>1){
        rec.held='lane';rec.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);this.inLane=true;this.rules.hit('swPlungerRest','Hit',rec.proxy);
      }
      if(p.y<1||p.x<-.5||p.x>10||p.z<-.5)this.rules.hit('Drain','Hit',rec.proxy);
    }
    this.rules.tick(STEP);
    if(this.syncCount%24===0)for(let i=0;i<6;i++){
      const rec=this.records[i],name=`fx_ballrolling${i+3}`;
      if(!rec||rec.held){this.media?.stop(name);continue;}
      const v=rec.body.linvel(),p=rec.body.translation(),speed=Math.hypot(v.x,v.y);
      if(speed>1)this.media?.play(name,{loop:-1,volume:Math.min(.7,speed*speed/2000),pan:p.x/4.76-1,rate:Math.min(2,.7+speed/30)});
      else this.media?.stop(name);
    }
    if(++this.syncCount%8===0)this.sync();
  }
}
