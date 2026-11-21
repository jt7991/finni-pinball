// SPDX-License-Identifier: GPL-3.0-or-later
// Target shape/trigger behavior adapted from Visual Pinball contributors.
// See public/licenses/VPX-Physics-NOTICE.txt.
import RAPIER from '@dimforge/rapier3d-compat';
import {Pinball,STEP,RADIUS,point,BALL_GROUP,STATIC_GROUP,BALL_RESTITUTION,surfaceRestitution} from './physics.js';
import {createRules} from './rules.js';
import {ContactMesh} from './mesh-contact.js';
import {CabinetNudge} from './cabinet-nudge.js';

export async function createFullGame(layout,specs,source,emit,media) {
  await RAPIER.init();
  return new FullGame(layout,specs,source,emit,media);
}

class FullGame extends Pinball {
  constructor(layout,specs,source,emit,media) {
    super(layout,emit);
    this.cabinetNudge=new CabinetNudge();
    this.placeholder=this.ball;this.ballCollider.setEnabled(false);
    this.records=[];this.byCollider=new Map();this.captures=new Map();this.mechanisms=new Map(this.nativeMeshes.map(m=>[this.colliderLabels.get(m.collider.handle)?.toLowerCase(),m.collider]));
    this.targetFronts=new Map();this.targetDrops=new Map();
    this.specs=specs;this.media=media;this.pendingCreate=null;this.syncCount=0;
    for(const spec of specs.objects)this.addMechanism(spec);
    const storage={
      load:key=>{try{return JSON.parse(localStorage.getItem(`finni-three-rule-${key}`)??'""');}catch{return '';}},
      save:(key,v)=>{try{localStorage.setItem(`finni-three-rule-${key}`,JSON.stringify(v));}catch{}},
    };
    this.rules=createRules(source,specs,{
      createBall:name=>this.spawn(name),destroyBall:(name,ball)=>this.remove(name,ball),
      kick:(name,ball,angle,speed,inclination)=>this.kick(name,ball,angle,speed,inclination),
      flipper:(side,down)=>{this.held[side]=down;},plunger:down=>{this.held.launch=down;if(down)this.plunger.pull();else this.launch();},
      plungerPosition:()=>this.plunger.position,
      autofire:()=>this.autofire(),
      nudge:(angle,strength)=>this.cabinetNudge.nudge(angle,strength),
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
      const size=spec.size,a=-(spec.rot_z??0)*Math.PI/180,rotation={x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)},base=(spec.position?.z??0)*.01;
      const vertices=spec.collision_mesh.vertices.flatMap(v=>[v[0]*size.x*.01,-v[1]*size.y*.01,v[2]*size.z*.01]);
      collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(spec.collision_mesh.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setTranslation(p.x,p.y,base).setRotation(rotation).setSensor(true).setRestitution(spec.contact_physics.elasticity).setFriction(spec.contact_physics.friction));
      const worldVertices=[];
      for(let i=0;i<vertices.length;i+=3){const x=vertices[i],y=vertices[i+1];worldVertices.push(p.x+x*Math.cos(a)-y*Math.sin(a),p.y+x*Math.sin(a)+y*Math.cos(a),base+vertices[i+2]);}
      this.registerMesh({collider,mesh:new ContactMesh({vertices:worldVertices,indices:spec.collision_mesh.indices},{invertNormals:true}),material:{...this.playfieldMaterial,...spec.contact_physics},source_order:spec.source_order});
      this.contactMaterials.set(collider.handle,{collider,...spec.contact_physics});
      if(spec.target_type.startsWith('drop')&&!spec.is_legacy){
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
      collider.setCollisionGroups(STATIC_GROUP);collider.setRestitution(surfaceRestitution(collider.restitution()));collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
      this.colliderLabels.set(collider.handle,name);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      this.tags.set(collider.handle,{kind:this.targetFronts.has(key)?'target-body':'mechanism',name,spec});this.mechanisms.set(key,collider);
    }
  }

  mechanism(name,key,v) {
    const collider=this.mechanisms.get(name.toLowerCase());if(!collider)return;
    if(key==='isdropped'){collider.setEnabled(!v);this.targetFronts.get(name.toLowerCase())?.setEnabled(!v);this.targetDrops.delete(name.toLowerCase());}
    if(key==='collidable')collider.setEnabled(!!v);
    // Gates stay sensors: per-ball direction decides whether their flap blocks.
  }

  spawn(name) {
    const key=name.toLowerCase(),spec=this.specs.objects.find(s=>s.name.toLowerCase()===key);
    const p=key==='ballrelease'?{x:this.plunger.spec.center.x*.01,y:(2115-this.plunger.end-5)*.01,z:RADIUS}:{...point(spec?.center??{x:293.68,y:473.63}),z:this.surface(spec??{})+RADIUS};
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z)
      .setCcdEnabled(true).setCanSleep(false));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1).setRestitution(BALL_RESTITUTION).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setCollisionGroups(BALL_GROUP).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    const rec={body,collider,held:key==='ballrelease'?null:key,inLane:key==='ballrelease',previous:{...p},cooldowns:new Map(),laneTime:this.time};
    rec.proxy=new Proxy({radius:25,mass:1,id:body.handle},{
      get:(target,key)=>{
        if(typeof key!=='string')return target[key];key=key.toLowerCase();
        if(/^ang(mom|vel)[xyz]$/.test(key)){
          const axis=key.at(-1),sign=axis==='y'?1:-1;
          return body.angvel()[axis]*sign*(key.startsWith('angmom')?2.5*body.mass():.01);
        }
        const q=body.translation(),v=body.linvel();
        return ({x:q.x*100,y:2115-q.y*100,z:q.z*100,velx:v.x,vely:-v.y,velz:v.z})[key]??target[key]??0;
      },
      set:(_target,key,v)=>{key=String(key).toLowerCase();
        if(/^angmom[xyz]$/.test(key)){const axis=key.at(-1),w={...body.angvel()};w[axis]=v*(axis==='y'?1:-1)/(2.5*body.mass());body.setAngvel(w,true);return true;}
        if(/^angvel[xyz]$/.test(key))return true; // Deprecated read-only native properties.
        const p={...body.translation()},vel={...body.linvel()};
        if(key==='x')p.x=v*.01;if(key==='y')p.y=(2115-v)*.01;if(key==='z')p.z=v*.01;
        if(key==='velx')vel.x=v;if(key==='vely')vel.y=-v;if(key==='velz')vel.z=v;
        body.setTranslation(p,true);body.setLinvel(vel,true);return true;},
    });
    if(rec.held)body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    this.records.push(rec);this.byCollider.set(collider.handle,rec);this.captures.set(key,rec);this.pendingCreate=rec;this.ball=body;
    if(key==='ballrelease'){
      this.inLane=true;
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
  input(action,down){if(action==='launch'&&down===this.held.launch)return;this.rules.key(action,down);this.sync();}
  release(){
    this.charge=0;this.held.launch=false;
    this.plunger.cancel();
    if(this.rules){this.rules.key('left',false);this.rules.key('right',false);}
    this.held.left=false;this.held.right=false;
  }
  launch(){
    this.plunger.fire();this.charge=0;
  }
  autofire(){
    // cvpmImpulseP.AutoFire is a separate coil acting on balls in swPlunger;
    // it does not release the manual rod or add the old minimum launch speed.
    for(const rec of this.records)if(rec.inLane){const v=rec.body.linvel();rec.body.setLinvel({x:v.x,y:45-this.random()*1.5,z:v.z},true);}
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

  step(){
    this.time+=STEP;
    this.rules.tick(STEP);
    for(const [name,drop]of this.targetDrops)if(drop.at<=this.time+1e-9){
      this.targetDrops.delete(name);this.rules.objects.get(name).isdropped=true;this.rules.hit(drop.name,'Dropped',drop.ball);
    }
    for(const rec of this.records){rec.previous={...rec.body.translation()};rec.previousVelocity={...rec.body.linvel()};}
    this.driveFlippers();
    for(const f of this.flippers){
      const state=this.rules.objects.get(f.side==='left'?'leftflipper':'rightflipper');
      state.startangle=90-f.rest*180/Math.PI;state.endangle=90-f.raised*180/Math.PI;
      f.collider.setRestitution(surfaceRestitution(Number(state.elasticity)||0));
    }
    this.prepareContacts(this.records);
    this.stepPhysics(this.records);
    this.charge=this.held.launch?1.2*this.plunger.charge:0;
    this.readFlippers();
    for(const f of this.flippers){
      const state=this.rules.objects.get(`${f.side}flipper`);
      state.currentangle=Math.abs(f.angle-f.raised)<.0001?state.endangle:Math.abs(f.angle-f.rest)<.0001?state.startangle:90-f.angle*180/Math.PI;
    }
    this.events.drainCollisionEvents((a,b,started)=>{
      const rec=this.byCollider.get(a)??this.byCollider.get(b);if(!rec||rec.held)return;
      const other=this.byCollider.get(a)===rec?this.byCollider.get(b):this.byCollider.get(a);
      if(other){if(started){const u=rec.body.linvel(),v=other.body.linvel();this.rules.run('OnBallBallCollision',rec.proxy,other.proxy,Math.hypot(u.x-v.x,u.y-v.y,u.z-v.z));}return;}
      const tag=this.tags.get(this.byCollider.has(a)?b:a);if(!tag)return;
      if(tag.kind==='target-body')return;
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
      }else if(tag.spec?.kind==='Spinner'){
        const v=rec.body.linvel(),spins=Math.min(24,Math.max(1,Math.round(Math.hypot(v.x,v.y)*.7)));
        for(let i=0;i<spins;i++)this.rules.schedule(i*55,`${tag.name}_Spin`);
      }else if(tag.spec?.kind==='HitTarget'){
        const drop=tag.spec.target_type?.startsWith('drop');
        if(drop){
          const v=rec.previousVelocity,n=tag.normal;
          if(n&&v.x*n.x+v.y*n.y>-(tag.spec.threshold??2))return;
          if(!this.targetDrops.has(key)&&!this.rules.objects.get(key).isdropped)this.targetDrops.set(key,{name:tag.name,at:this.time+52/(tag.spec.drop_speed??.9)/1000,ball:rec.proxy});
        }else this.rules.hit(tag.name,'Hit',rec.proxy);
      }else if(tag.spec?.kind==='Kicker'){
        rec.held=key;rec.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);rec.body.setLinvel({x:0,y:0,z:0},true);
        this.captures.set(key,rec);this.rules.hit(tag.name,'Hit',rec.proxy);
      }else {if(key==='swplungerrest')rec.inLane=true;this.rules.hit(tag.name,'Hit',rec.proxy);}
    });
    for(const rec of [...this.records]){
      if(rec.held)continue;
      const p=rec.body.translation();
      if(p.y<1||p.x<-.5||p.x>10||p.z<-.5)this.rules.hit('Drain','Hit',rec.proxy);
    }
    if(++this.syncCount%Math.round(1/(30*STEP))===0)this.sync();
  }
}
