// SPDX-License-Identifier: GPL-3.0-or-later
// Native force/stop behavior: Visual Pinball contributors; see
// public/licenses/VPX-Physics-NOTICE.txt. Adapted to Three.js/Rapier units.
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector2,ShapeUtils} from 'three';
import {dragCurve} from './drag-curve.js';
import {flipperContact,flipperHit,resolveFlipperContact,supportFlipper} from './flipper-contact.js';
import {playfieldHit,supportPlayfield,collidePlayfield} from './playfield-contact.js';
import {ContactMesh,collideSurface,supportSurface} from './mesh-contact.js';
import {Plunger} from './plunger.js';

export const STEP = 1 / 1000;
export const RADIUS = 0.25;
export const BALL_RESTITUTION=Math.sqrt(.8);
export const surfaceRestitution=value=>value/BALL_RESTITUTION;
export const BALL_GROUP=0x00010007,STATIC_GROUP=0x00020001,FLIPPER_GROUP=0x00040001;
export const point = p => ({x: p.x * .01, y: (2115 - p.y) * .01, z: 0});
const quaternion = angle => ({x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2)});
export const restitutionAtSpeed=(p,speed)=>p.elasticity/(1+Math.max(0,p.elasticity_falloff??0)*Math.abs(speed)/18.53);
let initialized;

// VPX walls are closed, filled surfaces, with zero outward padding. Padding every
// edge by 2.5 VPU narrowed the 50-VPU rollover openings enough to jam a ball.
export function wallSurface(item){
  const points=dragCurve(item.drag_points.map(p=>({...point(p),smooth:p.smooth})),true,4);
  const bottom=item.height_bottom*.01,top=item.height_top*.01,vertices=[],indices=[];
  for(const z of [bottom,top])for(const p of points)vertices.push(p.x,p.y,z);
  const count=points.length;
  for(const tri of ShapeUtils.triangulateShape(points.map(p=>new Vector2(p.x,p.y)),[])){
    const [a,b,c]=tri,p=points[a],q=points[b],r=points[c],positive=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)>0;
    indices.push(...(positive?[a,c,b,a+count,b+count,c+count]:[a,b,c,a+count,c+count,b+count]));
  }
  const clockwise=ShapeUtils.isClockWise(points.map(p=>new Vector2(p.x,p.y)));
  for(let a=0;a<count;a++){
    const b=(a+1)%count;
    indices.push(...(clockwise?[a,a+count,b,b,a+count,b+count]:[a,b,a+count,b,b+count,a+count]));
  }
  return {vertices,indices};
}

// Only collision geometry is generated here; the accepted wire model is separate.
export function rampSurface(item) {
  const raw=item.drag_points.map(p=>({...point(p),z:(p.z??0)*.01,smooth:p.smooth}));
  const center=dragCurve(raw),count=center.length-1,vertices=[],indices=[],edges=[[],[]];
  let length=0;const samples=[];
  for(let i=0;i<=count;i++){
    const p=center[i];if(i)length+=Math.hypot(p.x-samples.at(-1).p.x,p.y-samples.at(-1).p.y);
    samples.push({p,distance:length});
  }
  for (let i = 0; i <= count; i++) {
    const {p,distance}=samples[i],t=distance/length,previous=center[Math.max(0,i-1)],next=center[Math.min(count,i+1)];
    const normal=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};};
    const a=normal(previous,p),b=normal(p,next);
    let n=i===0?b:i===count?a:null;
    if(!n){const denominator=1+a.x*b.x+a.y*b.y;n=Math.abs(denominator)<1e-10?a:{x:(a.x+b.x)/denominator,y:(a.y+b.y)/denominator};}
    const width=item.ramp_type==='one_wire'?item.wire_diameter:item.ramp_type==='two_wire'?item.wire_distance_x+20:item.width_bottom+(item.width_top-item.width_bottom)*t;
    const half=width*.005;
    const z=p.z+(item.height_bottom+(item.height_top-item.height_bottom)*t)*.01;
    for (const [side, sign] of [[0, -1], [1, 1]]) {
      const x = p.x+n.x*half*sign, y = p.y+n.y*half*sign;
      vertices.push(x, y, z);
      edges[side].push({x, y, z});
    }
    if (i) {const a = (i - 1) * 2; indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  return {vertices, indices, edges};
}

export async function createGame(layout, emit = () => {}) {
  await (initialized ??= RAPIER.init());
  return new Pinball(layout, emit);
}

export class Pinball {
  constructor(layout, emit) {
    this.emit = emit;
    const physics=layout.physics??{gravity:1.635759,slope:6,friction:.25,elasticity:.25};
    this.nativeFlipperContacts=physics.native_flipper_contacts!==false;
    this.nativePlayfieldContacts=this.nativeFlipperContacts&&physics.native_playfield_contacts!==false;
    this.playfieldMaterial={elasticity:physics.elasticity,elasticity_falloff:physics.elasticity_falloff??.1,friction:physics.friction,scatter:physics.scatter??5,default_scatter:physics.default_scatter??10,difficulty:physics.difficulty??.5};
    this.playfieldMesh=layout.playfield?new ContactMesh(layout.playfield):null;
    // VPX velocities use VPU / 10 ms; scale .01 VPU makes them world units/s.
    // Acceleration therefore converts by .01 / .01^2 = 100.
    const gravity=physics.gravity*100,incline=physics.slope*Math.PI/180;
    this.world = new RAPIER.World({x:0,y:-gravity*Math.sin(incline),z:-gravity*Math.cos(incline)});
    this.world.timestep = STEP;
    this.world.numSolverIterations = 8;
    this.events = new RAPIER.EventQueue(!this.nativeFlipperContacts);
    this.physicsStats={maxSubsteps:0,substepBudgetExceeded:0};
    this.tags = new Map();
    this.colliderLabels = new Map();
    this.contactMaterials=new Map();this.changedMaterials=new Set();this.queryBall=new RAPIER.Ball(RADIUS);
    this.nativeMeshes=[];this.nativeMeshGrid=new Map();
    this.random=Math.random;
    this.flippers = [];
    this.cooldowns = new Map();
    this.time = 0;
    this.score = 0;
    this.ballNumber = 0;
    this.state = 'ready';
    this.held = {left: false, right: false, launch: false};
    this.ramps = [];
    this.segments = [];
    this.playfield=this.box({x: 4.76, y: 10.575, z: -.12}, [5, 11.5, .12], physics.elasticity,physics.friction);
    this.playfield.setSensor(this.nativePlayfieldContacts);
    for (const [a, b] of [[[.08, .4], [.08, 21.05]], [[.08, 21.05], [9.44, 21.05]], [[9.44, 21.05], [9.44, .4]]]) {
      this.segment({...{x:a[0], y:a[1]}, z:.5}, {x:b[0], y:b[1], z:.5}, .06, 1, .5);
    }
    for (const item of layout.items) {
      if (item.kind === 'Wall') this.wall(item);
      if (item.kind === 'Flipper') this.flipper(item);
      if (item.kind === 'Bumper') this.bumper(item);
      if (item.kind === 'Kicker') this.scoop = point(item.center);
      if (item.kind === 'Ramp') this.ramp(item);
      if (item.kind === 'Plunger') this.plunger = new Plunger(item);
    }
    // Close the inaccessible sub-ball-width pocket behind the right return post.
    // The diagonal lies under the existing plastic and feeds balls back infield.
    const guidePoints=[[8.035,10.775],[8.68,11.15],[8.68,10.6993],[8.0921,10.6993]];
    const guideVertices=[0,.6].flatMap(z=>guidePoints.flatMap(([x,y])=>[x,y,z]));
    const guide=this.world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(guideVertices))
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRestitution(surfaceRestitution(.3)).setFriction(.06));
    this.colliderLabels.set(guide.handle,'right-return-post-guide');
    // The exported walls contain the shooter lane and curved upper feed.
    const ball = RAPIER.RigidBodyDesc.dynamic().setTranslation(9.03, 1.4, RADIUS)
      .setCcdEnabled(true).setCanSleep(false);
    this.ball = this.world.createRigidBody(ball);
    this.ballCollider = this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1)
      .setCollisionGroups(BALL_GROUP).setRestitution(BALL_RESTITUTION).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.ball);
    this.park();
  }

  box(p, half, bounce = .5, friction = .08, rotation = 0, tag, label='playfield') {
    const desc = RAPIER.ColliderDesc.cuboid(...half).setTranslation(p.x,p.y,p.z)
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRotation(quaternion(rotation)).setRestitution(surfaceRestitution(bounce)).setFriction(friction);
    if (tag) desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(desc);
    this.colliderLabels.set(collider.handle,tag?.name??label);
    if (tag) this.tags.set(collider.handle, tag);
    return collider;
  }

  segment(a, b, radius, height, bounce, tag, label='boundary') {
    const length = Math.hypot(b.x-a.x,b.y-a.y);
    if (length < .001) return;
    const collider=this.box({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},
      [length/2 + .008,radius,height/2], bounce,.06,Math.atan2(b.y-a.y,b.x-a.x),tag,label);
    this.segments.push({a,b,radius,height});
    return collider;
  }

  wall(item) {
    const surface=wallSurface(item),material=item.contact_physics??{elasticity:item.elasticity,friction:item.friction??.06};
    if(surface.indices.length){
      const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(surface.vertices),new Uint32Array(surface.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRestitution(surfaceRestitution(material.elasticity)).setFriction(material.friction));
      this.colliderLabels.set(collider.handle,item.name);
      this.contactMaterials.set(collider.handle,{collider,...material});
      if(this.nativeFlipperContacts){
        const points=dragCurve(item.drag_points.map(p=>({...point(p),smooth:p.smooth,slingshot:p.is_slingshot})),true,4),count=points.length;
        const caps=[];for(let i=0;i<surface.indices.length-count*6;i+=6){if(item.is_bottom_solid)caps.push(...surface.indices.slice(i,i+3));caps.push(...surface.indices.slice(i+3,i+6));}
        const mesh=new ContactMesh({vertices:surface.vertices,indices:caps},{preserveNormals:true,coplanarJoints:false,points:false});
        const clockwise=ShapeUtils.isClockWise(points.map(p=>new Vector2(p.x,p.y)));
        for(let i=0;i<count;i++){
          const a=points[i],b=points[(i+1)%count],low=item.height_bottom*.01,high=item.height_top*.01;
          mesh.addWall(clockwise?b:a,clockwise?a:b,low,high,0,a.slingshot?{force:item.slingshot_force,threshold:item.slingshot_threshold}:null);
          mesh.addVertical(a,low,high);
        }
        this.registerMesh({collider,mesh,material:{...this.playfieldMaterial,...material},name:item.name});
      }
    }
    const points = item.drag_points.map(point), bottom = item.height_bottom * .01;
    const height = item.height_top * .01-bottom;
    for (let i = 0; i < points.length; i++) {
      const a = {...points[i],z:bottom+height/2}, b = {...points[(i+1)%points.length],z:bottom+height/2};
      const tag = item.drag_points[i].is_slingshot ? {kind:'sling',name:item.name,a,b} : null;
      if(tag){const sensor=this.segment(a,b,.001,height,item.elasticity,tag,item.name);sensor?.setSensor(this.nativeFlipperContacts);}
    }
  }

  ramp(item) {
    const surface = rampSurface(item),material=item.contact_physics??{friction:item.friction??.035,elasticity:item.elasticity??0};
    const nativeMesh=new ContactMesh(surface,{preserveNormals:true,twoSided:true,coplanarJoints:false,points:false});
    for (const [side, edge] of surface.edges.entries()) {
      const height=(['one_wire','two_wire'].includes(item.ramp_type)?31:side===0?item.right_wall_height:item.left_wall_height)*.01;
      if(height<=0)continue;
      for(let i=0;i<edge.length-1;i++){
        const a=edge[i],b=edge[i+1];
        nativeMesh.addWall(a,b,a.z,b.z,height);nativeMesh.addWall(b,a,a.z,b.z,height);
        nativeMesh.addVertical(a,a.z,b.z+height);
      }
      const end=edge.at(-1);nativeMesh.addVertical(end,end.z,end.z+height);
      const start=surface.vertices.length/3;
      for(const p of edge)surface.vertices.push(p.x,p.y,p.z+height);
      for(let i=0;i<edge.length-1;i++){
        const a=i*2+side,b=(i+1)*2+side,c=start+i,d=start+i+1;
        surface.indices.push(...(side===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
      }
    }
    const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(surface.vertices),new Uint32Array(surface.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED)
      .setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(material.friction).setRestitution(surfaceRestitution(material.elasticity)));
    if(this.nativeFlipperContacts)this.registerMesh({collider,mesh:nativeMesh,material:{...this.playfieldMaterial,...material,elasticity_falloff:0}});
    this.contactMaterials.set(collider.handle,{collider,...material});
    this.colliderLabels.set(collider.handle,item.name);
    this.ramps.push({name:item.name,collider,...surface});
  }

  flipper(item) {
    const p = point(item.center), length = item.flipper_radius_max*.01;
    const vertices = [];
    for (const z of [0,item.height*.01]) for (const [x,r] of [[0,item.base_radius*.01],[length,item.end_radius*.01]]) {
      for (let i=0;i<32;i++) {const a=i/32*Math.PI*2;vertices.push(x+Math.cos(a)*r,Math.sin(a)*r,z);}
    }
    const rest = Math.PI/2-item.start_angle*Math.PI/180, raised = Math.PI/2-item.end_angle*Math.PI/180;
    const mass=item.mass||1,inertia=mass*length*length/3;
    // Identity joint frames plus a rotated collider keep stroke limits relative
    // to rest on both sides, including the right flipper's angle wrap.
    const anchor=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x,p.y,0));
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x,p.y,0).lockTranslations().enabledRotations(false,false,true).setCanSleep(false).setCcdEnabled(true).setGravityScale(0));
    const collider=this.world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(vertices))
      .setSensor(this.nativeFlipperContacts)
      .setRotation(quaternion(rest)).setCollisionGroups(FLIPPER_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setMassProperties(mass,{x:0,y:0,z:0},{x:inertia,y:inertia,z:inertia},quaternion(0)).setRestitution(surfaceRestitution(item.elasticity)).setFriction(item.friction)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    const joint=this.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:1}),anchor,body,true);
    // The native stop is handled below; keep the joint's predictive limit away
    // from it so Rapier does not brake the coil before contact.
    joint.setLimits(Math.min(0,raised-rest)-.2,Math.max(0,raised-rest)+.2);
    joint.setMotorMaxForce(0);
    this.tags.set(collider.handle,{kind:'flipper',name:item.name});
    this.colliderLabels.set(collider.handle,item.name);
    this.flippers.push({body,collider,joint,p,length,rest,raised,angle:rest,inertia,strength:item.strength,returnStrength:item.return,baseRadius:item.base_radius*.01,endRadius:item.end_radius*.01,height:item.height*.01,elasticity:item.elasticity,falloff:item.elasticity_falloff,friction:item.friction,side:item.name.startsWith('Left')?'left':'right'});
  }

  driveFlippers(){
    for(const f of this.flippers){
      const pressed=this.held[f.side]&&!this.tilted&&this.state==='playing';
      const fromRest=Math.abs(f.angle-f.rest);
      // The end-of-stroke coil has less torque within the final ten degrees.
      // In particular, release must start softly rather than snap off the stop.
      const fromEnd=Math.abs(f.angle-f.raised);
      const state=this.rules?.objects.get(`${f.side}flipper`);
      const strength=Number(state?.strength)||f.strength*(fromRest<6*Math.PI/180?.2:1);
      const eos=Number(state?.eostorque)||.3,eosAngle=(Number(state?.eostorqueangle)||10)*Math.PI/180;
      const fade=Math.min(1,fromEnd/eosAngle)**4;
      const torque=strength*(pressed?1:-f.returnStrength)*(eos+(1-eos)*fade)*Math.sign(f.raised-f.rest);
      f.body.resetTorques(true);
      f.contactTorque=0;
      f.angularAcceleration=torque/f.inertia;
      if(Math.abs(f.angle-(pressed?f.raised:f.rest))<.01&&Math.abs(f.body.angvel().z)<1){
        f.angle=pressed?f.raised:f.rest;f.body.setRotation(quaternion(f.angle-f.rest),true);
        f.body.setAngvel({x:0,y:0,z:0},true);f.stopOmega=0;f.contactTorque=torque;f.angularAcceleration=0;continue;
      }
      f.body.applyTorqueImpulse({x:0,y:0,z:torque*STEP},true);
      f.stopOmega=f.body.angvel().z;
    }
  }

  registerMesh(record){
    record.order=this.nativeMeshes.length;
    this.nativeMeshes.push(record);
    for(const key of record.mesh.grid.keys()){
      if(!this.nativeMeshGrid.has(key))this.nativeMeshGrid.set(key,new Set());this.nativeMeshGrid.get(key).add(record);
    }
  }

  stepPhysics(records){
    this.plunger?.updateVelocity();
    if(!this.nativeFlipperContacts){this.world.step(this.events);this.plunger?.displace(STEP);return;}
    if(this.nativePlayfieldContacts)for(const r of records){
      if(r.held)continue;
      r.body.setGravityScale(0,true);
      const v=r.body.linvel(),g=this.world.gravity;
      r.body.setLinvel({x:v.x+g.x*STEP,y:v.y+g.y*STEP,z:v.z+g.z*STEP},true);
    }
    const pose=f=>{const q=f.body.rotation();f.angle=f.rest+2*Math.atan2(q.z,q.w);};
    let remaining=STEP,count=0;const handled=new Set();
    while(remaining>1e-9&&count++<32){
      let event=null,time=remaining;const contacts=[];
      for(const r of records)if(!r.held){r.queryPosition=r.body.translation();r.queryVelocity=r.body.linvel();}
      if(this.plunger)for(const r of records){
        if(r.held)continue;
        const hit=this.plunger.hit(r.queryPosition,r.queryVelocity,r.body.mass(),RADIUS,remaining),key=`${r.body.handle}:plunger`;
        if(hit?.contact)contacts.push({r,hit,plunger:true});
        else if(hit&&hit.time<=time&&!(hit.time<1e-9&&handled.has(key))){event={r,hit,key,plunger:true};time=hit.time;}
      }
      if(this.nativePlayfieldContacts)for(const r of records){
        if(r.held)continue;
        const hits=this.playfieldMesh?this.playfieldMesh.hitsAt(r.queryPosition,r.queryVelocity,RADIUS,remaining):[playfieldHit(r.body,RADIUS,remaining)];
        for(const hit of hits){
          const key=`${r.body.handle}:playfield:${hit?.id??0}`;
          if(hit?.contact)contacts.push({r,hit});
          else if(hit&&hit.time<=time&&!(hit.time<1e-9&&handled.has(key))){event={r,hit,key};time=hit.time;}
        }
      }
      for(const r of records){if(r.held)continue;
        const p=r.queryPosition,v=r.queryVelocity,x2=p.x+v.x*remaining,y2=p.y+v.y*remaining,candidates=new Set();
        for(let x=Math.floor(Math.min(p.x,x2)-RADIUS);x<=Math.floor(Math.max(p.x,x2)+RADIUS);x++)for(let y=Math.floor(Math.min(p.y,y2)-RADIUS);y<=Math.floor(Math.max(p.y,y2)+RADIUS);y++){
          for(const mesh of this.nativeMeshGrid.get(`${x},${y}`)??[])candidates.add(mesh);
        }
        // Keep the same component order across spatial cells.
        for(const mesh of [...candidates].sort((a,b)=>a.order-b.order)){
          if(!mesh.collider.isEnabled())continue;
          for(const hit of mesh.mesh.hitsAt(p,v,RADIUS,remaining)){
            const key=`${r.body.handle}:mesh:${mesh.collider.handle}:${hit.id}`;
            if(hit.contact)contacts.push({r,hit,mesh});
            else if(hit.time<=time&&!(hit.time<1e-9&&handled.has(key))){event={r,hit,key,mesh};time=hit.time;}
          }
        }
      }
      for(const f of this.flippers){
        pose(f);const omega=f.body.angvel().z;
        const bound=omega>0?Math.max(f.rest,f.raised):Math.min(f.rest,f.raised);
        const stop=omega?(bound-f.angle)/omega:Infinity;
        if(stop>=-1e-9&&stop<=time){event={f,bound};time=Math.max(0,stop);}
        for(const r of records){
          if(r.held)continue;
          const hit=flipperHit(r.body,f,f.angle,omega,RADIUS,remaining),key=`${r.body.handle}:${f.side}`;
          if(hit?.contact)contacts.push({r,hit,f});
          else if(hit&&hit.time<=time&&!(hit.time<1e-9&&handled.has(key))){event={f,r,key};time=hit.time;}
        }
      }
      if(time>1e-9){this.world.timestep=time;this.world.step(this.events);this.plunger?.displace(time);remaining-=time;handled.clear();}
      if(event&&!event.f){
        if(event.plunger)this.plunger.collide(event.r.body,event.hit);
        else if(event.mesh){
          const shape=event.mesh.mesh.shapes[event.hit.id],sling=shape.slingshot;
          if(sling&&!this.tilted&&event.hit.vn<=-sling.threshold){
            const p=event.r.body.translation(),n=event.hit.normal,t=((p.x-n.x*RADIUS-shape.a.x)*shape.axis.x+(p.y-n.y*RADIUS-shape.a.y)*shape.axis.y)/shape.length;
            const force=.5*(1-(2*t-1)**2)*sling.force;
            event.r.body.applyImpulse({x:-n.x*force,y:-n.y*force,z:0},true);
          }
          collideSurface(event.r.body,event.hit,event.mesh.material,RADIUS,this.random);
          if(event.mesh.bumper&&!this.tilted&&event.hit.vn<=-event.mesh.bumper.threshold){
            const n=event.hit.normal;event.r.body.applyImpulse({x:n.x*event.mesh.bumper.force,y:n.y*event.mesh.bumper.force,z:0},true);
          }
        }else if(this.playfieldMesh)collideSurface(event.r.body,event.hit,this.playfieldMaterial,RADIUS,this.random);
        else collidePlayfield(event.r.body,event.hit,this.playfieldMaterial,RADIUS,this.random);
        handled.add(event.key);
      }else if(event){
      const f=event.f;pose(f);
      if(event.r){
        const contact=flipperContact(event.r.body.translation(),f,f.angle,RADIUS);
        if(contact&&contact.gap<=.0005){
          const state=this.rules?.objects.get(`${f.side}flipper`);
          resolveFlipperContact(event.r.body,f,contact,{elasticity:state?Number(state.elasticity):f.elasticity,elasticity_falloff:f.falloff??0,friction:f.friction},RADIUS);
        }
        handled.add(event.key);
      }else{
        const omega=f.body.angvel().z;
        f.angle=event.bound;f.body.setRotation(quaternion(f.angle-f.rest),true);f.body.setAngvel({x:0,y:0,z:Math.abs(omega)<.05?0:-.3*omega},true);
      }
      }
      // Even a zero-time impact must cancel the contact's original normal
      // velocity. Skipping it changes coupled floor/flipper impacts near EOS.
      for(const {r,hit,f,mesh,plunger}of contacts){
        if(f)supportFlipper(r.body,f,hit,this.world.gravity,f.friction,RADIUS,time);
        else if(plunger)supportSurface(r.body,hit,this.world.gravity,{friction:.3},RADIUS,time);
        else if(mesh)supportSurface(r.body,hit,this.world.gravity,mesh.material,RADIUS,time);
        else if(this.playfieldMesh)supportSurface(r.body,hit,this.world.gravity,this.playfieldMaterial,RADIUS,time);
        else supportPlayfield(r.body,hit,this.world.gravity,this.playfieldMaterial,time);
      }
      if(!event)break;
    }
    if(remaining>1e-9){this.physicsStats.substepBudgetExceeded++;this.world.timestep=remaining;this.world.step(this.events);this.plunger?.displace(remaining);}
    this.physicsStats.maxSubsteps=Math.max(this.physicsStats.maxSubsteps,count);this.world.timestep=STEP;
  }

  prepareContacts(records){
    if(this.nativeFlipperContacts)return;
    for(const handle of this.changedMaterials){const m=this.contactMaterials.get(handle);m.collider.setRestitution(surfaceRestitution(m.elasticity));}
    this.changedMaterials.clear();
    for(const rec of records){
      if(rec.held)continue;
      const v=rec.body.linvel();
      const hit=this.world.castShape(rec.body.translation(),quaternion(0),v,this.queryBall,0,STEP*2,false,
        undefined,BALL_GROUP,rec.collider,rec.body,c=>this.contactMaterials.has(c.handle));
      if(!hit)continue;
      const m=this.contactMaterials.get(hit.collider.handle),n=hit.normal1;
      const e=surfaceRestitution(restitutionAtSpeed(m,v.x*n.x+v.y*n.y+v.z*n.z));
      m.collider.setRestitution(this.changedMaterials.has(m.collider.handle)?Math.min(e,m.collider.restitution()):e);
      this.changedMaterials.add(m.collider.handle);
    }
  }

  readFlippers(){
    for(const f of this.flippers){
      const q=f.body.rotation(),raw=2*Math.atan2(q.z,q.w);
      f.angle=f.rest+Math.atan2(Math.sin(raw),Math.cos(raw));
      if(this.nativeFlipperContacts)continue;
      const low=Math.min(f.rest,f.raised),high=Math.max(f.rest,f.raised);
      const stop=f.angle<=low+.00001&&f.stopOmega<0?low:f.angle>=high-.00001&&f.stopOmega>0?high:null;
      if(stop!==null){
        const overshoot=f.angle-stop;
        f.angle=Math.abs(f.stopOmega)<1?stop:stop-.3*overshoot;
        f.body.setRotation(quaternion(f.angle-f.rest),true);
        f.body.setAngvel({x:0,y:0,z:Math.abs(f.stopOmega)<1?0:-.3*f.stopOmega},true);
      }
    }
  }

  bumper(item) {
    const p=point(item.center);
    const height=item.height_scale*.01;
    const collider=this.world.createCollider(RAPIER.ColliderDesc.cylinder(height/2,item.radius*.01)
      .setTranslation(p.x,p.y,height/2).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}).setSensor(this.nativeFlipperContacts)
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRestitution(surfaceRestitution(.3)).setFriction(.3).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
    if(this.nativeFlipperContacts){const mesh=new ContactMesh({vertices:[],indices:[]});mesh.addCircle(p,item.radius*.01,0,height);this.registerMesh({collider,mesh,bumper:item,material:{...this.playfieldMaterial,elasticity:.3,elasticity_falloff:0,friction:.3,scatter:item.scatter}});}
    this.tags.set(collider.handle,{kind:'bumper',name:item.name,p,threshold:item.threshold});this.colliderLabels.set(collider.handle,item.name);
  }

  park() {
    this.inLane=true; this.capturedUntil=0;this.charge=0;
    this.ball.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    this.ball.setTranslation({x:9,y:2.65,z:RADIUS+.01},true);
    this.ball.setLinvel({x:0,y:0,z:0},true);this.ball.setAngvel({x:0,y:0,z:0},true);
  }

  start() {
    if (this.state==='playing') return;
    this.state='playing';this.score=0;this.ballNumber=1;this.nudges=[];
    this.tilted=false;this.rampAwarded=false;this.held={left:false,right:false,launch:false};this.park();
    this.emit({type:'start'});
  }

  input(action, down) {
    if (action in this.held) {
      const was=this.held[action];this.held[action]=down;
      if (action==='launch'&&was&&!down&&this.inLane&&this.state==='playing') this.launch();
    } else if (action==='start'&&down) this.start();
    else if (action.startsWith('nudge')&&down) this.nudge(action);
    else if (action==='action'&&down&&this.state==='playing') this.emit({type:'message',text:'Shoot the scoop or climb a ramp.'});
  }

  release() {
    // Cancellation never fires a partially charged ball.
    this.held={left:false,right:false,launch:false};this.charge=0;
  }

  launch() {
    const power=24+Math.min(1,this.charge/1.2)*21;
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    this.ball.setLinvel({x:0,y:power,z:0},true);
    this.inLane=false;this.launchTime=this.time;this.charge=0;
    this.emit({type:'launch'});
  }

  nudge(action) {
    if (this.state!=='playing'||this.inLane||this.tilted||this.capturedUntil) return;
    this.nudges=this.nudges.filter(t=>this.time-t<4);this.nudges.push(this.time);
    if(this.nudges.length>=4){this.tilted=true;this.release();this.emit({type:'tilt'});return;}
    this.ball.applyImpulse({x:action==='nudgeLeft'?2.4:action==='nudgeRight'?-2.4:0,y:action==='nudgeForward'?3:1,z:.3},true);
  }

  award(points,kind) {this.score+=points;this.emit({type:kind,points});}

  step() {
    this.time+=STEP;
    this.driveFlippers();
    if (this.state==='playing'&&this.inLane&&this.held.launch) this.charge=Math.min(1.2,this.charge+STEP);
    if (this.capturedUntil&&this.time>=this.capturedUntil) {
      this.capturedUntil=0;this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
      this.ball.setTranslation({x:this.scoop.x+.15,y:this.scoop.y-.6,z:RADIUS+.04},true);
      this.ball.setLinvel({x:2.4,y:-13,z:0},true);this.emit({type:'eject'});
    }
    this.prepareContacts([{body:this.ball,collider:this.ballCollider,held:this.inLane}]);
    this.stepPhysics([{body:this.ball,collider:this.ballCollider,held:this.inLane}]);
    this.readFlippers();
    this.events.drainCollisionEvents((a,b,started)=>{
      if(!started||this.state!=='playing'||this.tilted) return;
      const handle=a===this.ballCollider.handle?b:b===this.ballCollider.handle?a:null;
      const tag=this.tags.get(handle);if(!tag||(this.cooldowns.get(tag.name)||0)>this.time)return;
      this.cooldowns.set(tag.name,this.time+.12);
      const p=this.ball.translation();
      if(tag.kind==='bumper') {
        const dx=p.x-tag.p.x,dy=p.y-tag.p.y,d=Math.hypot(dx,dy)||1;
        if(!this.nativeFlipperContacts)this.ball.applyImpulse({x:dx/d*6,y:dy/d*6,z:0},true);this.award(100,'bumper');
      } else if(tag.kind==='sling') {
        if(!this.nativeFlipperContacts)this.ball.applyImpulse({x:p.x<4.76?4:-4,y:5,z:0},true);this.award(50,'sling');
      }
    });
    if(this.state!=='playing'||this.inLane||this.capturedUntil)return;
    const p=this.ball.translation();
    if(!this.tilted&&p.z<.6&&Math.hypot(p.x-this.scoop.x,p.y-this.scoop.y)<.43) {
      this.capturedUntil=this.time+1;this.ball.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
      this.ball.setLinvel({x:0,y:0,z:0},true);this.award(500,'scoop');
    }
    if(!this.tilted&&p.z>1.05&&!this.rampAwarded){this.rampAwarded=true;this.award(1000,'ramp');}
    if(p.z<.5)this.rampAwarded=false;
    if(p.y<1||p.x<-.5||p.x>10||p.z<-.5) {
      this.ballNumber++;
      if(this.ballNumber>3){this.state='over';this.ballNumber=3;this.park();this.release();this.emit({type:'over'});}
      else {this.tilted=false;this.nudges=[];this.park();this.emit({type:'drain'});}
    }
  }

  dispose(){this.events.free();this.world.free();}
}
