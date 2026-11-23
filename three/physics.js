// SPDX-License-Identifier: GPL-3.0-or-later
// Native force/stop behavior: Visual Pinball contributors; see
// public/licenses/VPX-Physics-NOTICE.txt. Adapted to Three.js/Rapier units.
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector2,ShapeUtils} from 'three';
import {nativeDragCurve} from './native-curve.js';
import {flipperContact,flipperHit,resolveFlipperContact,supportFlipper} from './flipper-contact.js';
import {playfieldHit,supportPlayfield,collidePlayfield} from './playfield-contact.js';
import {ContactMesh,collideSurface,supportSurface} from './mesh-contact.js';
import {Plunger} from './plunger.js';
import {BallSpin} from './ball-spin.js';
import {NativeBall} from './native-ball.js';
import {NativeAngular,nativeFlipperInertia} from './native-angular.js';
import {nativeMeshQuery,nativeMeshBounds,nativeMeshHit,nativeMeshNarrowHit} from './native-mesh-contact.js';
import {nativeRampSurface,nativeRampContacts,rampWallHeights} from './native-ramp.js';
import {nativeRubberMesh} from './native-rubber.js';
import {NativeTree} from './native-tree.js';
import {NativeDynamicTree} from './native-dynamic-tree.js';
import {nativeBallHit,collideNativeBalls} from './native-ball-collision.js';
import {collideNativeBumper} from './native-bumper.js';
import {collideNativeSlingshot} from './native-slingshot.js';
import {nativeHitDescriptor,collideNativeHitSurface} from './native-hit-event.js';
import {runtimeNativeRandom} from './native-random.js';
import {collideNativeTarget} from './native-target-event.js';

import {STEP,RADIUS} from './game-constants.js';
export {STEP,RADIUS};
export const BALL_RESTITUTION=Math.sqrt(.8);
export const surfaceRestitution=value=>value/BALL_RESTITUTION;
export const BALL_GROUP=0x00010007,NATIVE_BALL_GROUP=0x00010006,STATIC_GROUP=0x00020001,FLIPPER_GROUP=0x00040001;
export const point = p => ({x: p.x * .01, y: (2115 - p.y) * .01, z: 0});
const quaternion = angle => ({x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2)});
export const restitutionAtSpeed=(p,speed)=>p.elasticity/(1+Math.max(0,p.elasticity_falloff??0)*Math.abs(speed)/18.53);
let initialized;

// VPX walls are closed, filled surfaces, with zero outward padding. Padding every
// edge by 2.5 VPU narrowed the 50-VPU rollover openings enough to jam a ball.
export function wallSurface(item){
  const points=nativeDragCurve(item.drag_points,true,4,2).map(p=>({...p,...point(p)}));
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
  return nativeRampSurface(item);
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
    this.incline=incline;
    const round=Math.fround,nativeIncline=round(round(physics.slope)*round(Math.PI/180)),nativeStrength=round(physics.gravity);
    this.nativeIncline=nativeIncline;
    this.nativeGravity={x:0,y:round(round(Math.sin(nativeIncline))*nativeStrength),z:round(-round(Math.cos(nativeIncline))*nativeStrength)};
    this.world = new RAPIER.World(physics.native_position_units===false?{x:0,y:-gravity*Math.sin(incline),z:-gravity*Math.cos(incline)}:{x:0,y:-this.nativeGravity.y*100,z:this.nativeGravity.z*100});
    this.world.timestep = STEP;
    this.world.numSolverIterations = 8;
    this.events = new RAPIER.EventQueue(!this.nativeFlipperContacts);
    this.physicsStats={maxSubsteps:0,substepBudgetExceeded:0};
    this.ballSpin=new BallSpin();
    this.nativePositionUnits=physics.native_position_units!==false;this.nativeBallStates=new WeakMap();this.nativeBallSequence=0;
    this.tags = new Map();
    this.colliderLabels = new Map();
    this.contactMaterials=new Map();this.changedMaterials=new Set();this.queryBall=new RAPIER.Ball(RADIUS);
    this.nativeMeshes=[];this.nativeMeshGrid=new Map();this.nativeGlobalMeshes=[];this.nativeBumpers=new Map();this.nativeSlingshots=new Map();this.nativeHitObjects=new Map();
    this.nativeParts=new Map([...layout.items,...(layout.rubbers??[])].map(item=>[item.name.toLowerCase(),item]));
    this.nativeParts.set('playfield_mesh',layout.playfield);this.nativeTreeEnabled=this.nativePositionUnits&&this.nativeFlipperContacts&&physics.native_tree!==false;
    this.nativeBallContacts=this.nativeTreeEnabled&&physics.native_ball_contacts!==false;this.ballCollisionSwap=false;this.dynamicBallTree=new NativeDynamicTree();
    this.nativeTreeBounds={left:layout.cabinet?.left??0,right:layout.cabinet?.right??layout.width,top:layout.cabinet?.top??0,bottom:layout.cabinet?.bottom??layout.height};
    this.random=runtimeNativeRandom();
    this.flippers = [];
    this.spinners = [];
    this.gates = [];
    this.triggers = [];this.kickers=[];
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
    if(layout.cabinet)this.cabinet(layout.cabinet);
    if(this.nativePlayfieldContacts&&this.playfieldMesh){
      this.colliderLabels.set(this.playfield.handle,'playfield_mesh');
      this.registerMesh({collider:this.playfield,mesh:this.playfieldMesh,material:this.playfieldMaterial,name:'playfield_mesh',source_order:layout.playfield.source_order??100000});
    }
    for (const item of layout.items) {
      if (item.kind === 'Wall') this.wall(item);
      if (item.kind === 'Flipper') this.flipper(item);
      if (item.kind === 'Bumper') this.bumper(item);
      if (item.kind === 'Kicker') this.scoop = point(item.center);
      if (item.kind === 'Ramp') this.ramp(item);
      if (item.kind === 'Plunger') this.plunger = new Plunger(item);
      if (item.kind === 'Primitive') this.primitive(item);
    }
    for(const item of layout.rubbers??[]){
      const collider={handle:`rubber:${item.name}`,enabled:item.is_collidable,isEnabled(){return this.enabled;},setEnabled(value){this.enabled=!!value;}};
      this.colliderLabels.set(collider.handle,item.name);
      this.registerMesh({collider,mesh:nativeRubberMesh(item),hitEvents:nativeHitDescriptor(item),material:{...this.playfieldMaterial,...item.contact_physics},native_source_order:item.native_source_order});
    }
    // The exported walls contain the shooter lane and curved upper feed.
    const ball = RAPIER.RigidBodyDesc.dynamic().setTranslation(9.03, 1.4, RADIUS)
      .setCcdEnabled(true).setCanSleep(false);
    this.ball = this.world.createRigidBody(ball);
    this.ballCollider = this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1)
      .setCollisionGroups(this.nativeBallContacts?NATIVE_BALL_GROUP:BALL_GROUP).setRestitution(BALL_RESTITUTION).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.ball);
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

  primitive(item){
    // Native Primitive collision vertices are baked during PhysicSetup. Script
    // RotX/Y/Z changes animate rendering without rebuilding those hit shapes.
    const mesh=new ContactMesh(item.collision_mesh,{preserveNormals:true}),material=item.contact_physics;
    const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(item.collision_mesh.vertices),new Uint32Array(item.collision_mesh.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP)
      .setRestitution(surfaceRestitution(material.elasticity)).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(material.friction));
    this.colliderLabels.set(collider.handle,item.name);
    if(this.nativeFlipperContacts)this.registerMesh({collider,mesh,name:item.name,hitEvents:nativeHitDescriptor(item),source_order:item.source_order,material:{...this.playfieldMaterial,...material}});
  }

  cabinet(spec){
    const left=spec.left*.01,right=spec.right*.01,top=(2115-spec.top)*.01,bottom=(2115-spec.bottom)*.01,high=spec.glass_top_height*.01,low=spec.glass_bottom_height*.01;
    const material={...this.playfieldMaterial,elasticity:.3,elasticity_falloff:0,friction:.3,scatter:0};
    const mesh=new ContactMesh({vertices:[],indices:[]}),vertices=[],indices=[];
    const segments=[[[right,top],[right,bottom],high],[[left,bottom],[left,top],low],[[right,bottom],[left,bottom],low],[[left,top],[right,top],high]];
    for(const [a,b,height]of segments){
      mesh.addWall({x:a[0],y:a[1],z:0},{x:b[0],y:b[1],z:0},0,height);
      const i=vertices.length/3;vertices.push(a[0],a[1],0,b[0],b[1],0,a[0],a[1],height,b[0],b[1],height);indices.push(i,i+1,i+2,i+1,i+3,i+2);
    }
    const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)).setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP).setRestitution(surfaceRestitution(.3)).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(.3));
    this.colliderLabels.set(collider.handle,'cabinet-boundary');
    if(this.nativeFlipperContacts)this.registerMesh({collider,mesh,material,name:'cabinet-boundary'});
    const corners=[{x:left,y:top,z:high},{x:right,y:top,z:high},{x:right,y:bottom,z:low},{x:left,y:bottom,z:low}],glass=new ContactMesh({vertices:[],indices:[]});glass.addPolygon(corners);
    const glassCollider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(corners.flatMap(p=>[p.x,p.y,p.z])),new Uint32Array([0,1,2,0,2,3])).setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP).setRestitution(surfaceRestitution(.3)).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(.3));
    this.colliderLabels.set(glassCollider.handle,'cabinet-glass');
    if(this.nativeFlipperContacts){
      this.registerMesh({collider:glassCollider,mesh:glass,material,name:'cabinet-glass'});
      const plane=new ContactMesh({vertices:[],indices:[]}),rise=high-low,length=Math.hypot(top-bottom,rise),normal={x:0,y:rise/length,z:-(top-bottom)/length};
      plane.addPlane(normal,-high+normal.y*top);
      this.registerMesh({collider:glassCollider,mesh:plane,material:{...material,elasticity:.2},name:'cabinet-glass-plane'});
    }
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
      collider.setEnabled(item.is_collidable!==false);
      this.contactMaterials.set(collider.handle,{collider,...material});
      if(this.nativeFlipperContacts){
        const points=nativeDragCurve(item.drag_points,true,4,2).map(p=>({...p,...point(p)})),count=points.length;
        const mesh=new ContactMesh({vertices:[],indices:[]}),sling={name:item.name,force:item.slingshot_force,threshold:item.slingshot_threshold,disabled:false};
        const clockwise=ShapeUtils.isClockWise(points.map(p=>new Vector2(p.x,p.y)));
        for(let i=0;i<count;i++){
          const a=points[(i+1)%count],b=points[(i+2)%count],low=item.height_bottom*.01,high=item.height_top*.01;
          mesh.addWall(clockwise?b:a,clockwise?a:b,low,high,a.slingshot?sling:null);
          if(low!==0)mesh.addEdge({...a,z:low},{...b,z:low});
          mesh.addEdge({...a,z:high},{...b,z:high});
          mesh.addVertical(a,low,high);
          if(low!==0)mesh.addPoint({...a,z:low});
          mesh.addPoint({...a,z:high});
        }
        mesh.addPolygon(points.map(p=>({...p,z:item.height_top*.01})));
        if(item.is_bottom_solid)mesh.addPolygon([...points].reverse().map(p=>({...p,z:item.height_bottom*.01})));
        if(mesh.shapes.some(shape=>shape.slingshot))this.nativeSlingshots.set(item.name.toLowerCase(),sling);
        this.registerMesh({collider,mesh,hitEvents:nativeHitDescriptor(item),material:{...this.playfieldMaterial,...material},name:item.name,source_order:item.source_order});
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
    const nativeMesh=nativeRampContacts(surface,item);
    for (const [side, edge] of surface.edges.entries()) {
      const height=rampWallHeights(item)[side]*.01;
      if(height<=0)continue;
      const start=surface.vertices.length/3;
      for(const p of edge)surface.vertices.push(p.x,p.y,p.z+height);
      for(let i=0;i<edge.length-1;i++){
        const a=i*2+side,b=(i+1)*2+side,c=start+i,d=start+i+1;
        surface.indices.push(...(side===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
      }
    }
    const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(surface.vertices),new Uint32Array(surface.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED)
      .setSensor(this.nativeFlipperContacts).setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setFriction(material.friction).setRestitution(surfaceRestitution(material.elasticity)));
    if(this.nativeFlipperContacts)this.registerMesh({collider,mesh:nativeMesh,hitEvents:nativeHitDescriptor(item),material:{...this.playfieldMaterial,...material,elasticity_falloff:0},source_order:item.source_order});
    this.contactMaterials.set(collider.handle,{collider,...material});
    this.colliderLabels.set(collider.handle,item.name);
    collider.setEnabled(item.is_collidable!==false);
    this.ramps.push({name:item.name,collider,...surface});
  }

  flipper(item) {
    const p = point(item.center), length = item.flipper_radius_max*.01;
    const vertices = [];
    for (const z of [0,item.height*.01]) for (const [x,r] of [[0,item.base_radius*.01],[length,item.end_radius*.01]]) {
      for (let i=0;i<32;i++) {const a=i/32*Math.PI*2;vertices.push(x+Math.cos(a)*r,Math.sin(a)*r,z);}
    }
    const rest = Math.PI/2-item.start_angle*Math.PI/180, raised = Math.PI/2-item.end_angle*Math.PI/180;
    const mass=item.mass||1,nativeInertia=nativeFlipperInertia(mass,item.flipper_radius_max),inertia=this.nativePositionUnits?nativeInertia*.0001:mass*length*length/3;
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
    if(this.nativePositionUnits){const f=this.flippers.at(-1),r=Math.fround(Math.PI/180);f.nativeRestAngle=Math.fround(item.start_angle*r);f.nativeRaisedAngle=Math.fround(item.end_angle*r);f.nativeAngle=f.nativeRestAngle;f.nativeMotion=new NativeAngular(body,nativeInertia);}
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
      let torque=strength*(pressed?1:-f.returnStrength)*(eos+(1-eos)*fade)*Math.sign(f.raised-f.rest);
      if(f.nativeMotion){
        const round=Math.fround,angle=round(Math.abs(round(f.nativeAngle-f.nativeRaisedAngle))),limit=round((Number(state?.eostorqueangle)||10)*round(Math.PI/180));
        let nativeTorque=round(strength);if(!pressed)nativeTorque=round(nativeTorque*round(-f.returnStrength));
        if(angle<limit){const ratio=round(angle/limit),squared=round(ratio*ratio),lerp=round(squared*squared);nativeTorque=round(nativeTorque*round(lerp+round(round(eos)*round(1-lerp))));}
        torque=nativeTorque*Math.sign(f.raised-f.rest);
      }
      f.body.resetTorques(true);
      f.contactTorque=0;
      f.angularAcceleration=torque/f.inertia;
      if(Math.abs(f.angle-(pressed?f.raised:f.rest))<.01&&Math.abs(f.body.angvel().z)<1){
        f.angle=pressed?f.raised:f.rest;f.body.setRotation(quaternion(f.angle-f.rest),true);
        if(f.nativeAngle!==undefined)f.nativeAngle=pressed?f.nativeRaisedAngle:f.nativeRestAngle;
        f.nativeMotion?.stop();
        f.body.setAngvel({x:0,y:0,z:0},true);f.stopOmega=0;f.contactTorque=torque;f.angularAcceleration=0;continue;
      }
      if(f.nativeMotion)f.nativeMotion.torque(torque);else f.body.applyTorqueImpulse({x:0,y:0,z:torque*STEP},true);
      f.stopOmega=f.body.angvel().z;
    }
  }

  registerMesh(record){
    if(record.hitEvents){record.hitEvents.collider=record.collider;this.nativeHitObjects.set(record.hitEvents.name.toLowerCase(),record.hitEvents);}
    record.order=record.source_order??(-100000+this.nativeMeshes.length);
    this.nativeMeshes.push(record);
    this.nativeTree=null;
    if(record.mesh.planes.length)this.nativeGlobalMeshes.push(record);
    for(const key of record.mesh.registrationKeys??record.mesh.grid.keys()){
      if(!this.nativeMeshGrid.has(key))this.nativeMeshGrid.set(key,new Set());this.nativeMeshGrid.get(key).add(record);
    }
  }

  buildNativeTree(){
    const entries=[],f=Math.fround,order=spec=>spec?.native_source_order??100000;
    for(const mesh of this.nativeMeshes){
      const name=this.colliderLabels.get(mesh.collider.handle)??mesh.name,source=mesh.native_source_order??order(this.nativeParts.get(name?.toLowerCase()));
      for(const shape of mesh.mesh.shapes){const bounds=nativeMeshBounds(shape);if(bounds)entries.push({bounds,source,rank:mesh.treeRank??0,mesh,shape});}
    }
    const box=(points,low,high)=>({left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y)),low:f(low),high:f(high)});
    for(const spinner of this.spinners)entries.push({bounds:box([spinner.lines[0].a,spinner.lines[1].a],spinner.height*100,spinner.height*100+50),source:order(spinner.spec),rank:0,spinner});
    for(const gate of this.gates){
      const bounds=box([gate.lines[0].a,gate.lines[1].a],gate.height*100,gate.height*100+50),source=order(gate.spec);
      if(!gate.spec.two_way)entries.push({bounds,source,rank:0,gate,blocked:true});
      entries.push({bounds,source,rank:1,gate,blocked:false});
    }
    for(const flipper of this.flippers){
      const spec=this.nativeParts.get(this.colliderLabels.get(flipper.collider.handle).toLowerCase()),c=spec.center,extent=f(f(f(spec.flipper_radius_max)+f(spec.end_radius))+f(.1));
      entries.push({bounds:{left:f(f(c.x)-extent),right:f(f(c.x)+extent),top:f(f(c.y)-extent),bottom:f(f(c.y)+extent),low:0,high:f(spec.height)},source:order(spec),rank:0,f:flipper});
    }
    if(this.plunger){
      const spec=this.plunger.spec,c=spec.center;
      entries.push({bounds:{left:f(f(f(c.x)-f(spec.width))-f(.1)),right:f(f(f(c.x)+f(spec.width))+f(.1)),top:f(this.plunger.end-f(.1)),bottom:f(f(f(c.y)+f(spec.height))+f(.1)),low:0,high:50},source:order(spec),rank:0,plunger:true});
    }
    for(const trigger of this.triggers)for(const shape of trigger.shapes)entries.push({bounds:shape.box,source:order(trigger.spec),rank:0,trigger,shape});
    for(const kicker of this.kickers)for(const shape of kicker.shapes)entries.push({bounds:shape.box,source:order(kicker.spec),rank:0,kicker,shape});
    entries.sort((a,b)=>a.source-b.source||a.rank-b.rank);
    this.nativeDisplacers=[...(this.plunger?[this.plunger]:[]),...this.spinners,...this.gates].sort((a,b)=>order(a.spec)-order(b.spec));
    this.nativeTree=new NativeTree(entries,this.nativeTreeBounds);
  }

  nativeBall(body){
    let state=this.nativeBallStates.get(body);if(!state){state=new NativeBall(body);state.order=this.nativeBallSequence++;this.nativeBallStates.set(body,state);}return state;
  }

  stepPhysics(records,preparedNudge){
    if(this.nativeTreeEnabled&&!this.nativeTree)this.buildNativeTree();
    const state=r=>this.nativeBall(r.body);
    const body=r=>this.nativePositionUnits?state(r).body:r.body;
    for(const spinner of this.spinners)spinner.updateVelocity();
    for(const gate of this.gates)gate.updateVelocity();
    this.plunger?.updateVelocity();
    const nudge=preparedNudge??this.cabinetNudge?.step(this.nativePositionUnits?this.nativeIncline:this.incline)??{x:0,y:0,z:0};
    if(!this.nativeFlipperContacts){
      if(this.cabinetNudge)for(const r of records)if(!r.held){const v=r.body.linvel();r.body.setLinvel({x:v.x+nudge.x*STEP,y:v.y+nudge.y*STEP,z:v.z+nudge.z*STEP},true);}
      this.world.step(this.events);this.plunger?.displace(STEP);return;
    }
    if(this.nativePlayfieldContacts)for(const r of records){
      if(r.held)continue;
      r.body.setGravityScale(0,true);
      const v=r.body.linvel(),g=this.world.gravity;
      if(this.nativePositionUnits){const f=Math.fround,dt=f(.1),force=(old,acceleration,delta)=>f(f(old+f(acceleration*dt))+delta),delta=nudge.nativeDelta??{x:0,y:0,z:0};
        r.body.setLinvel({x:force(v.x,this.nativeGravity.x,delta.x),y:-force(-v.y,this.nativeGravity.y,delta.y),z:force(v.z,this.nativeGravity.z,delta.z)},true);
      }else r.body.setLinvel({x:v.x+(g.x+nudge.x)*STEP,y:v.y+(g.y+nudge.y)*STEP,z:v.z+(g.z+nudge.z)*STEP},true);
    }
    const pose=f=>{if(f.nativeAngle!==undefined){f.angle=Math.PI/2-f.nativeAngle;return;}const q=f.body.rotation();f.angle=f.rest+2*Math.atan2(q.z,q.w);};
    const nativeTime=value=>Math.fround(value*100)*.01,staticTime=this.nativePositionUnits?nativeTime(.0002):.0002;
    const makeFrameQuery=r=>nativeMeshQuery(body(r).translation(),r.body.linvel(),RADIUS,STEP);
    if(this.nativeTreeEnabled)for(const r of records)r.nativeFrameQuery=makeFrameQuery(r);
    const frameQuery=r=>r.nativeFrameQuery??=makeFrameQuery(r);
    if(this.nativeBallContacts)this.dynamicBallTree.update(records,frameQuery);
    let remaining=this.nativePositionUnits?nativeTime(STEP):STEP,count=0,staticCount=10;
    while(remaining>(this.nativePositionUnits?0:1e-9)&&count++<32){
      let event=null,time=remaining;const contacts=[];
      const ballEvents=this.nativeTreeEnabled&&this.nativePositionUnits?new Map():null;
      for(const r of records)if(!r.held){r.queryPosition=body(r).translation();r.queryVelocity=r.body.linvel();r.nativeQuery=this.nativePositionUnits?nativeMeshQuery(r.queryPosition,r.queryVelocity,RADIUS,remaining):false;
        if(this.nativeTreeEnabled){const frame=frameQuery(r);r.nativeQuery.box=frame.box;r.nativeQuery.extent=frame.extent;r.nativeQuery.radiusSquared=frame.radiusSquared;}
      }
      if(this.nativeBallContacts)this.dynamicBallTree.sync(records,frameQuery);
      if(this.nativeTreeEnabled&&this.nativePositionUnits){
        for(const f of this.flippers){
          pose(f);const omega=f.body.angvel().z,bound=omega>0?Math.max(f.rest,f.raised):Math.min(f.rest,f.raised);
          let stop=omega?(bound-f.angle)/omega:Infinity;
          if(f.nativeMotion&&f.nativeMotion.speed){const target=omega>0?Math.min(f.nativeRestAngle,f.nativeRaisedAngle):Math.max(f.nativeRestAngle,f.nativeRaisedAngle);stop=Math.fround(Math.fround(target-f.nativeAngle)/-f.nativeMotion.speed)*.01;}
          if(stop>0&&stop<=time){event={f,bound};time=stop;}
        }
        for(const r of records)if(!r.held){
          const p=r.queryPosition,v=r.queryVelocity,ball=body(r),accept=(hit,entry)=>{
            if(!hit)return;if(hit.contact)contacts.push({r,hit,...entry});else if(hit.time<=time){event={r,hit,...entry};ballEvents.set(r,event);time=hit.time;state(r).collisionGap=Math.fround(hit.gap*100);this.ballSpin.impact(ball,hit.gap);}
          };
          if(this.nativePlayfieldContacts&&!this.playfieldMesh)accept(playfieldHit(ball,RADIUS,time),{});
          for(const mesh of this.nativeGlobalMeshes)if(mesh.collider.isEnabled())for(const shape of mesh.mesh.planes){
            r.nativeQuery.dt=Math.fround(time*100);const hit=nativeMeshHit(shape,p,v,RADIUS,time,r.nativeQuery);if(hit)hit.id=shape.id;accept(hit,{mesh});
          }
          const dynamic=()=>this.dynamicBallTree.query(r.nativeQuery,r,other=>{
            const native=state(other),p=native.sync(),v=other.body.linvel();
            accept(nativeBallHit(r.nativeQuery,{p,v:{x:v.x,y:-v.y,z:v.z}},RADIUS,time),{other});
          });
          const staticQuery=()=>this.nativeTree.query(r.nativeQuery,entry=>{
            const {mesh,shape,f,plunger,gate,blocked,spinner,trigger,kicker}=entry;let hit;
            if(mesh){if(!mesh.collider.isEnabled())return;r.nativeQuery.dt=Math.fround(time*100);hit=nativeMeshNarrowHit(shape,r.nativeQuery);if(hit)hit.id=shape.id;}
            else if(f){pose(f);hit=flipperHit(ball,f,f.angle,f.body.angvel().z,RADIUS,time);}
            else if(plunger)hit=this.plunger.hit(p,v,r.body.mass(),RADIUS,time,r.nativeQuery);
            else if(gate){if(!gate.enabled)return;hit=blocked?gate.blockHit(p,v,RADIUS,time):gate.hit(p,v,RADIUS,time);}
            else if(spinner){if(!spinner.collider.isEnabled())return;hit=spinner.hit(p,v,RADIUS,time);}
            else if(trigger)hit=trigger.hitShape(shape,r.nativeQuery,time,ball);
            else if(kicker)hit=kicker.hitShape(shape,r.nativeQuery,time,ball);
            accept(hit,{mesh,f,plunger,gate,blocked,spinner,trigger,kicker});
          },r.nativeStaticQueryCache??={});
          if(this.nativeBallContacts){if(this.random()<.5){dynamic();staticQuery();}else{staticQuery();dynamic();}}else staticQuery();
          // Native counts very short hits per ball and retains each ball's
          // collision. All hits at the winning time are resolved together.
          if(ballEvents.has(r)&&time<staticTime&&--staticCount<0){staticCount=0;time=staticTime;}
        }
      }else{
      if(this.plunger)for(const r of records){
        if(r.held)continue;
        const hit=this.plunger.hit(r.queryPosition,r.queryVelocity,r.body.mass(),RADIUS,remaining),key=`${r.body.handle}:plunger`;
        if(hit?.contact)contacts.push({r,hit,plunger:true});
        else if(hit&&hit.time<=time){event={r,hit,key,plunger:true};time=hit.time;}
      }
      for(const gate of this.gates)if(gate.enabled)for(const r of records){
        if(r.held)continue;
        // The rigid one-way face wins equal-time tests against the flap sensor.
        for(const blocked of [false,true]){
          const hit=blocked?gate.blockHit(r.queryPosition,r.queryVelocity,RADIUS,remaining):gate.hit(r.queryPosition,r.queryVelocity,RADIUS,remaining);
          if(hit?.contact)contacts.push({r,hit,gate,blocked});
          else if(hit&&hit.time<=time){event={r,hit,gate,blocked};time=hit.time;}
        }
      }
      if(this.nativePlayfieldContacts&&!this.playfieldMesh)for(const r of records){
        if(r.held)continue;
        const hits=this.playfieldMesh?this.playfieldMesh.hitsAt(r.queryPosition,r.queryVelocity,RADIUS,remaining):[playfieldHit(body(r),RADIUS,remaining)];
        for(const hit of hits){
          const key=`${r.body.handle}:playfield:${hit?.id??0}`;
          if(hit?.contact)contacts.push({r,hit});
          else if(hit&&hit.time<=time){event={r,hit,key};time=hit.time;}
        }
      }
      for(const r of records){if(r.held)continue;
        const p=r.queryPosition,v=r.queryVelocity,x2=p.x+v.x*remaining,y2=p.y+v.y*remaining,candidates=new Set(this.nativeGlobalMeshes),extent=r.nativeQuery?r.nativeQuery.extent*.01:RADIUS;
        for(let x=Math.floor((r.nativeQuery?p.x:Math.min(p.x,x2))-extent);x<=Math.floor((r.nativeQuery?p.x:Math.max(p.x,x2))+extent);x++)for(let y=Math.floor((r.nativeQuery?p.y:Math.min(p.y,y2))-extent);y<=Math.floor((r.nativeQuery?p.y:Math.max(p.y,y2))+extent);y++){
          for(const mesh of this.nativeMeshGrid.get(`${x},${y}`)??[])candidates.add(mesh);
        }
        // Keep the same component order across spatial cells.
        for(const mesh of [...candidates].sort((a,b)=>a.order-b.order)){
          if(!mesh.collider.isEnabled())continue;
          for(const hit of mesh.mesh.hitsAt(p,v,RADIUS,remaining,r.nativeQuery)){
            const key=`${r.body.handle}:mesh:${mesh.collider.handle}:${hit.id}`;
            if(hit.contact)contacts.push({r,hit,mesh});
            else if(hit.time<=time){event={r,hit,key,mesh};time=hit.time;}
          }
        }
      }
      for(const f of this.flippers){
        pose(f);const omega=f.body.angvel().z;
        const bound=omega>0?Math.max(f.rest,f.raised):Math.min(f.rest,f.raised);
        let stop=omega?(bound-f.angle)/omega:Infinity;
        if(f.nativeMotion&&f.nativeMotion.speed){const target=omega>0?Math.min(f.nativeRestAngle,f.nativeRaisedAngle):Math.max(f.nativeRestAngle,f.nativeRaisedAngle);stop=Math.fround(Math.fround(target-f.nativeAngle)/-f.nativeMotion.speed)*.01;}
        if(stop>0&&stop<=time){event={f,bound};time=stop;}
        for(const r of records){
          if(r.held)continue;
          const hit=flipperHit(body(r),f,f.angle,omega,RADIUS,remaining),key=`${r.body.handle}:${f.side}`;
          if(hit?.contact)contacts.push({r,hit,f});
          else if(hit&&hit.time<=time){event={f,r,key,hit};time=hit.time;}
        }
      }
      for(const spinner of this.spinners)if(spinner.collider.isEnabled())for(const r of records){
        if(r.held)continue;
        const hit=spinner.hit(r.queryPosition,r.queryVelocity,RADIUS,remaining);
        if(hit?.contact)contacts.push({r,hit,spinner});
        else if(hit&&hit.time<=time){event={r,hit,spinner};time=hit.time;}
      }
      for(const trigger of this.triggers)for(const r of records){
        if(r.held)continue;
        for(const hit of trigger.hits(r.queryPosition,r.queryVelocity,RADIUS,remaining,body(r))){
          if(hit.contact)contacts.push({r,hit,trigger});
          else if(hit.time<=time){event={r,hit,trigger};time=hit.time;}
        }
      }
      }
      // Native allows repeated zero-time impacts. After ten very short impacts,
      // advance by its legacy .02 VPT (0.2ms), rather than ignoring a collider.
      if(this.nativePositionUnits)time=nativeTime(time);
      if(!ballEvents&&event?.r&&time<staticTime&&--staticCount<0){staticCount=0;time=staticTime;}
      if(time>staticTime)staticCount=10;
      // Native mechanisms precede balls in the mover list. A Spin callback can
      // change a bobble ball's velocity before that ball's displacement.
      for(const mover of this.nativeDisplacers??[...(this.plunger?[this.plunger]:[]),...this.spinners,...this.gates])mover.displace(time);
      if(time>0){
        const motions=this.nativePositionUnits?records.filter(r=>!r.held).map(r=>{const s=state(r);s.syncAngular();return {r,s,p:{...s.sync()},v:r.body.linvel()};}):[];
        const angles=this.flippers.filter(f=>f.nativeAngle!==undefined).map(f=>({f,angle:f.nativeAngle,speed:-f.nativeMotion.speed}));
        this.world.timestep=time;if(!this.nativeDisplacements)this.world.step(this.events);remaining=this.nativePositionUnits?Math.fround(Math.fround(remaining*100)-Math.fround(time*100))*.01:remaining-time;
        for(const {f,angle,speed}of angles){f.nativeAngle=Math.fround(angle+Math.fround(speed*Math.fround(time*100)));f.body.setRotation(quaternion(Math.PI/2-f.nativeAngle-f.rest),true);}
        for(const {r,s,p,v}of motions){
          const after=r.body.linvel();
          let ballContact=false;
          if(!this.nativeBallContacts&&records.length>1)this.world.contactPairsWith(r.collider,other=>{if(other.collisionGroups()===BALL_GROUP)ballContact=true;});
          // Keep Rapier's resolved displacement when another physical ball has
          // changed the velocity. Static native contacts use VPX's float units.
          if(!ballContact&&after.x===v.x&&after.y===v.y&&after.z===v.z)s.displace(p,v,time);else s.sync();
          if(!ballContact)s.restoreAngular();
        }
      }
      if(time===0&&this.nativePositionUnits)for(const r of records)if(!r.held){const native=state(r);native.syncAngular();native.orientation.advance(native.angularMomentum,native.inertia,0);}
      for(const f of this.flippers){
        pose(f);const low=Math.min(f.rest,f.raised),high=Math.max(f.rest,f.raised),omega=f.body.angvel().z;
        const bound=event?.f===f&&!event.r?event.bound:f.angle>=high?high:f.angle<=low?low:null;
        if(bound!==null){
          f.angle=bound;f.body.setRotation(quaternion(f.angle-f.rest),true);
          if(f.nativeAngle!==undefined)f.nativeAngle=bound===f.rest?f.nativeRestAngle:f.nativeRaisedAngle;
          if(Math.abs(omega)>=.05&&(bound===high&&omega>0||bound===low&&omega<0)){if(f.nativeMotion)f.nativeMotion.bounce();else f.body.setAngvel({x:0,y:0,z:-.3*omega},true);}
        }
      }
      const resolved=ballEvents?[...ballEvents.values()].filter(e=>e.hit.time<=time):event?[event]:[];
      for(const event of resolved){
      if(event.r?.removed)continue;
      if(event&&!event.f){
        const impactBody=body(event.r);if(!event.trigger&&!event.kicker)this.ballSpin.impact(impactBody,event.hit.gap);
        if(event.other){if(!event.other.removed)collideNativeBalls(state(event.r),state(event.other),event.hit,!!event.other.held,this.ballCollisionSwap,speed=>this.rules?.run('OnBallBallCollision',event.other.proxy,event.r.proxy,speed));}
        else if(event.kicker)event.kicker.collide(impactBody,event.hit,event.r);
        else if(event.trigger)event.trigger.collide(impactBody,event.hit,event.r);
        else if(event.gate){if(event.blocked)collideSurface(impactBody,event.hit,event.gate.material,RADIUS,this.random);else event.gate.collide(impactBody,event.hit,event.r.proxy);}
        else if(event.spinner)event.spinner.collide(impactBody,event.hit);
        else if(event.plunger)this.plunger.collide(impactBody,event.hit,this.random,this.playfieldMaterial.difficulty);
        else if(event.mesh){
          if(event.mesh.bumper&&impactBody.native){
            if(event.mesh.collider.isEnabled())collideNativeBumper(impactBody,event.hit,event.mesh.bumper,event.mesh.material,RADIUS,this.random,()=>{
              this.visualMotions?.get(event.mesh.bumper.name.toLowerCase())?.hit(impactBody.native.sync());
              if(this.rules)this.rules.hit(event.mesh.bumper.name,'Hit',event.r.proxy);
              else if(this.state==='playing'&&!this.tilted)this.award(100,'bumper');
            });
            continue;
          }
          const shape=event.mesh.mesh.shapes[event.hit.id],sling=shape.slingshot;
          if(event.mesh.targetEvent&&impactBody.native){
            const previous=this.targetEventBall;this.targetEventBall=event.r.proxy;
            try{collideNativeTarget(impactBody,event.hit,shape,event.mesh.targetEvent,event.mesh.material,RADIUS,this.random,()=>this.rules?.hit(event.mesh.targetEvent.target.name,'Hit',event.r.proxy));}
            finally{this.targetEventBall=previous;}
            continue;
          }
          if(sling&&impactBody.native){
            collideNativeSlingshot(impactBody,event.hit,shape,sling,event.mesh.material,RADIUS,this.random,()=>{
              if(this.rules)this.rules.hit(sling.name,'Slingshot',event.r.proxy);
              else if(this.state==='playing'&&!this.tilted)this.award(10,'sling');
            });
            continue;
          }
          if(event.mesh.hitEvents&&impactBody.native){
            collideNativeHitSurface(impactBody,event.hit,shape,event.mesh.hitEvents,event.mesh.material,RADIUS,this.random,()=>this.rules?.hit(event.mesh.hitEvents.name,'Hit',event.r.proxy));
            continue;
          }
          if(sling&&!this.tilted&&event.hit.vn<=-sling.threshold){
            const p=impactBody.translation(),n=event.hit.normal,t=((p.x-n.x*RADIUS-shape.a.x)*shape.axis.x+(p.y-n.y*RADIUS-shape.a.y)*shape.axis.y)/shape.length;
            const force=.5*(1-(2*t-1)**2)*sling.force;
            event.r.body.applyImpulse({x:-n.x*force,y:-n.y*force,z:0},true);
          }
          collideSurface(impactBody,event.hit,event.mesh.material,RADIUS,this.random);
          if(shape.kind==='plane'){
            const p=impactBody.translation(),n=shape.normal,gap=p.x*n.x+p.y*n.y+p.z*n.z-RADIUS-shape.d;
            if(gap<0)impactBody.setTranslation({x:p.x-gap*n.x,y:p.y-gap*n.y,z:p.z-gap*n.z},true);
          }
          if(event.mesh.bumper&&!this.tilted&&event.hit.vn<=-event.mesh.bumper.threshold){
            const n=event.hit.normal;event.r.body.applyImpulse({x:n.x*event.mesh.bumper.force,y:n.y*event.mesh.bumper.force,z:0},true);
          }
        }else if(this.playfieldMesh)collideSurface(impactBody,event.hit,this.playfieldMaterial,RADIUS,this.random);
        else collidePlayfield(impactBody,event.hit,this.playfieldMaterial,RADIUS,this.random);
      }else if(event){
      const f=event.f;pose(f);
      if(event.r){
        const contact=f.nativeMotion?event.hit.profile:flipperContact(body(event.r).translation(),f,f.angle,RADIUS);
        if(contact&&contact.gap<=.0005){
          this.ballSpin.impact(body(event.r),contact.gap);
          const state=this.rules?.objects.get(`${f.side}flipper`);
          resolveFlipperContact(body(event.r),f,contact,{elasticity:state?Number(state.elasticity):f.elasticity,elasticity_falloff:f.falloff??0,friction:f.friction},RADIUS,Math.round(this.time*1000),(kind,speed)=>this.rules?.hit(f.side+'Flipper',kind,event.r.proxy,...(kind==='Collide'?[speed]:[])));
        }
      }
      }
      }
      // Even a zero-time impact must cancel the contact's original normal
      // velocity. Skipping it changes coupled floor/flipper impacts near EOS.
      // VPX alternates the traversal direction randomly to avoid giving one
      // persistent contact priority on every pass through an embedded pocket.
      if(this.random()>=.5)contacts.reverse();
      for(const {r,hit,f,mesh,plunger,spinner,gate,blocked,trigger}of contacts){
        if(r.removed)continue;
        if(f)supportFlipper(body(r),f,hit,this.world.gravity,f.friction,RADIUS,time);
        else if(plunger)supportSurface(body(r),hit,this.world.gravity,{friction:.3},RADIUS,time);
        else if(spinner)supportSurface(body(r),hit,this.world.gravity,{friction:.3},RADIUS,time);
        else if(trigger)supportSurface(body(r),hit,this.world.gravity,{friction:.3},RADIUS,time);
        else if(gate)supportSurface(body(r),hit,this.world.gravity,blocked?gate.material:{friction:.3},RADIUS,time);
        else if(mesh)supportSurface(body(r),hit,this.world.gravity,mesh.material,RADIUS,time);
        else if(this.playfieldMesh)supportSurface(body(r),hit,this.world.gravity,this.playfieldMaterial,RADIUS,time);
        else supportPlayfield(body(r),hit,this.world.gravity,this.playfieldMaterial,time);
      }
      for(const r of records)this.ballSpin.apply(body(r),Math.round(this.time*1000));
      if(this.nativeBallContacts)this.ballCollisionSwap=!this.ballCollisionSwap;
      if(!event)break;
    }
    if(remaining>1e-9){this.physicsStats.substepBudgetExceeded++;this.world.timestep=remaining;if(this.nativeDisplacements){for(const r of records)if(!r.held){const native=state(r);native.syncAngular();native.displace({...native.sync()},r.body.linvel(),remaining);}}else this.world.step(this.events);this.plunger?.displace(remaining);}
    this.physicsStats.maxSubsteps=Math.max(this.physicsStats.maxSubsteps,count);this.world.timestep=STEP;
    for(const r of records)this.ballSpin.record(body(r),Math.round(this.time*1000));
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
      if(this.nativeFlipperContacts&&f.nativeAngle!==undefined)continue;
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
    const bumper={...item,hit_event:item.hit_event!==false},record={collider,bumper,source_order:item.source_order,material:{...this.playfieldMaterial,elasticity:.3,elasticity_falloff:0,friction:.3,scatter:item.scatter}};
    this.nativeBumpers.set(item.name.toLowerCase(),record);
    if(this.nativeFlipperContacts){const mesh=new ContactMesh({vertices:[],indices:[]});mesh.addCircle(p,item.radius*.01,0,height);record.mesh=mesh;this.registerMesh(record);}
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
      if(this.nativeFlipperContacts&&tag.kind==='bumper')return;
      if(this.nativePositionUnits&&tag.kind==='sling')return;
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
