import RAPIER from '@dimforge/rapier3d-compat';
import {CatmullRomCurve3, Vector3,Vector2,ShapeUtils} from 'three';

export const STEP = 1 / 240;
export const RADIUS = 0.25;
export const BALL_GROUP=0x00010007,STATIC_GROUP=0x00020001,FLIPPER_GROUP=0x00040001;
const FLIPPER_SPRING=18000,FLIPPER_DAMPING=145;
export const point = p => ({x: p.x * .01, y: (2115 - p.y) * .01, z: 0});
const quaternion = angle => ({x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2)});
let initialized;

// VPX walls are closed, filled surfaces, with zero outward padding. Padding every
// edge by 2.5 VPU narrowed the 50-VPU rollover openings enough to jam a ball.
export function wallSurface(item){
  const raw=item.drag_points.map(point),points=[];
  for(let i=0;i<raw.length;i++){
    const a=raw[i],b=raw[(i+1)%raw.length],previous=raw[(i+raw.length-1)%raw.length],next=raw[(i+2)%raw.length];
    const smoothA=item.drag_points[i].smooth,smoothB=item.drag_points[(i+1)%raw.length].smooth;
    const count=smoothA||smoothB?Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.12)):1;
    for(let j=0;j<count;j++){
      const t=j/count,t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
      const p={};for(const k of ['x','y']){
        const m0=smoothA?(b[k]-previous[k])*.5:b[k]-a[k],m1=smoothB?(next[k]-a[k])*.5:b[k]-a[k];
        p[k]=h00*a[k]+h10*m0+h01*b[k]+h11*m1;
      }
      if(!points.length||Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y)>.00001)points.push(p);
    }
  }
  const bottom=Math.max(0,item.height_bottom*.01),top=item.height_top*.01,vertices=[],indices=[];
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

// Rendering consumes these same surfaces, so the visible ramps match the physics.
export function rampSurface(item) {
  const raw=item.drag_points.map(p=>{const v=point(p);return new Vector3(v.x,v.y,(p.z??0)*.01);});
  const curve=new CatmullRomCurve3(raw,false,'centripetal');
  const count=Math.max(16,Math.ceil(curve.getLength()/.1)),vertices=[],indices=[],edges=[[],[]];
  let length=0;const samples=[];
  for(let i=0;i<=count;i++){
    const p=curve.getPointAt(i/count);if(i)length+=Math.hypot(p.x-samples.at(-1).p.x,p.y-samples.at(-1).p.y);
    samples.push({p,distance:length});
  }
  for (let i = 0; i <= count; i++) {
    const {p,distance}=samples[i],t=distance/length,tangent=curve.getTangentAt(i/count);
    const width=item.ramp_type==='one_wire'?item.wire_diameter:item.ramp_type==='two_wire'?item.wire_distance_x+20:item.width_bottom+(item.width_top-item.width_bottom)*t;
    const half=width*.005;
    const z=p.z+(item.height_bottom+(item.height_top-item.height_bottom)*t)*.01;
    for (const [side, sign] of [[0, -1], [1, 1]]) {
      const x = p.x - tangent.y * half * sign, y = p.y + tangent.x * half * sign;
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
    // VPX velocities use VPU / 10 ms; scale .01 VPU makes them world units/s.
    // Acceleration therefore converts by .01 / .01^2 = 100.
    const gravity=physics.gravity*100,incline=physics.slope*Math.PI/180;
    this.world = new RAPIER.World({x:0,y:-gravity*Math.sin(incline),z:-gravity*Math.cos(incline)});
    this.world.timestep = STEP;
    this.world.numSolverIterations = 8;
    this.events = new RAPIER.EventQueue(true);
    this.tags = new Map();
    this.colliderLabels = new Map();
    this.flippers = [];
    this.cooldowns = new Map();
    this.time = 0;
    this.score = 0;
    this.ballNumber = 0;
    this.state = 'ready';
    this.held = {left: false, right: false, launch: false};
    this.ramps = [];
    this.segments = [];
    this.box({x: 4.76, y: 10.575, z: -.12}, [5, 11.5, .12], physics.elasticity,physics.friction);
    for (const [a, b] of [[[.08, .4], [.08, 21.05]], [[.08, 21.05], [9.44, 21.05]], [[9.44, 21.05], [9.44, .4]]]) {
      this.segment({...{x:a[0], y:a[1]}, z:.5}, {x:b[0], y:b[1], z:.5}, .06, 1, .5);
    }
    for (const item of layout.items) {
      if (item.kind === 'Wall') this.wall(item);
      if (item.kind === 'Flipper') this.flipper(item);
      if (item.kind === 'Bumper') this.bumper(item);
      if (item.kind === 'Kicker') this.scoop = point(item.center);
      if (item.kind === 'Ramp') this.ramp(item);
    }
    // Close the inaccessible sub-ball-width pocket behind the right return post.
    // The diagonal lies under the existing plastic and feeds balls back infield.
    this.segment({x:8.149,y:10.781,z:.3},{x:8.68,y:11.15,z:.3},.001,.6,.3,null,'right-return-post-guide');
    // The exported walls contain the shooter lane and curved upper feed.
    const ball = RAPIER.RigidBodyDesc.dynamic().setTranslation(9.03, 1.4, RADIUS)
      .setCcdEnabled(true).setLinearDamping(.025).setAngularDamping(.12).setCanSleep(false);
    this.ball = this.world.createRigidBody(ball);
    this.ballCollider = this.world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setMass(1)
      .setCollisionGroups(BALL_GROUP).setRestitution(.9).setFriction(.045).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.ball);
    this.park();
  }

  box(p, half, bounce = .5, friction = .08, rotation = 0, tag, label='playfield') {
    const desc = RAPIER.ColliderDesc.cuboid(...half).setTranslation(p.x,p.y,p.z)
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setRotation(quaternion(rotation)).setRestitution(bounce).setFriction(friction);
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
    if(item.name==='Wall024')return; // Shallow native shooter deflector; replaced by the open lane feed.
    const surface=wallSurface(item);
    if(surface.indices.length){
      const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(surface.vertices),new Uint32Array(surface.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(item.elasticity).setFriction(.06));
      this.colliderLabels.set(collider.handle,item.name);
    }
    const points = item.drag_points.map(point), bottom = Math.max(0, item.height_bottom * .01);
    const height = item.height_top * .01-bottom;
    for (let i = 0; i < points.length; i++) {
      const a = {...points[i],z:bottom+height/2}, b = {...points[(i+1)%points.length],z:bottom+height/2};
      const tag = item.drag_points[i].is_slingshot ? {kind:'sling',name:item.name,a,b} : null;
      if(tag)this.segment(a,b,.001,height,item.elasticity,tag,item.name);
    }
  }

  ramp(item) {
    const surface = rampSurface(item);
    for (const [side, edge] of surface.edges.entries()) {
      const height=(['one_wire','two_wire'].includes(item.ramp_type)?31:side===0?item.right_wall_height:item.left_wall_height)*.01;
      if(height<=0)continue;
      const start=surface.vertices.length/3;
      for(const p of edge)surface.vertices.push(p.x,p.y,p.z+height);
      for(let i=0;i<edge.length-1;i++){
        const a=i*2+side,b=(i+1)*2+side,c=start+i,d=start+i+1;
        surface.indices.push(...(side===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
      }
    }
    const collider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(surface.vertices),new Uint32Array(surface.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED)
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setFriction(.035).setRestitution(0));
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
      .setRotation(quaternion(rest)).setCollisionGroups(FLIPPER_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setMassProperties(mass,{x:0,y:0,z:0},{x:inertia,y:inertia,z:inertia},quaternion(0)).setRestitution(item.elasticity).setFriction(item.friction)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body);
    const joint=this.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:1}),anchor,body,true);
    joint.setLimits(Math.min(0,raised-rest),Math.max(0,raised-rest));
    joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    joint.configureMotorPosition(0,FLIPPER_SPRING,FLIPPER_DAMPING);joint.setMotorMaxForce(item.strength*item.return);
    this.tags.set(collider.handle,{kind:'flipper',name:item.name});
    this.colliderLabels.set(collider.handle,item.name);
    this.flippers.push({body,collider,joint,p,length,rest,raised,angle:rest,inertia,strength:item.strength,returnStrength:item.return,side:item.name.startsWith('Left')?'left':'right'});
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
      const torque=strength*(pressed?1:f.returnStrength)*(fromEnd<eosAngle?eos:1);
      f.joint.setMotorMaxForce(torque);
      f.joint.configureMotorPosition(pressed?f.raised-f.rest:0,FLIPPER_SPRING,FLIPPER_DAMPING);
    }
  }

  readFlippers(){
    for(const f of this.flippers){
      const q=f.body.rotation(),raw=2*Math.atan2(q.z,q.w);
      f.angle=f.rest+Math.atan2(Math.sin(raw),Math.cos(raw));
    }
  }

  bumper(item) {
    const p=point(item.center);
    // The decorative balloon is bigger than the active ring underneath it.
    const collider=this.world.createCollider(RAPIER.ColliderDesc.cylinder(.32,item.radius*.008)
      .setTranslation(p.x,p.y,.32).setRotation({x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2})
      .setCollisionGroups(STATIC_GROUP).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.9).setFriction(.05).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));
    this.tags.set(collider.handle,{kind:'bumper',name:item.name,p});
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
    this.world.step(this.events);
    this.readFlippers();
    this.events.drainCollisionEvents((a,b,started)=>{
      if(!started||this.state!=='playing'||this.tilted) return;
      const handle=a===this.ballCollider.handle?b:b===this.ballCollider.handle?a:null;
      const tag=this.tags.get(handle);if(!tag||(this.cooldowns.get(tag.name)||0)>this.time)return;
      this.cooldowns.set(tag.name,this.time+.12);
      const p=this.ball.translation();
      if(tag.kind==='bumper') {
        const dx=p.x-tag.p.x,dy=p.y-tag.p.y,d=Math.hypot(dx,dy)||1;
        this.ball.applyImpulse({x:dx/d*6,y:dy/d*6,z:0},true);this.award(100,'bumper');
      } else if(tag.kind==='sling') {
        this.ball.applyImpulse({x:p.x<4.76?4:-4,y:5,z:0},true);this.award(50,'sling');
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
