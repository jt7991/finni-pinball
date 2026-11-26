// The renderer receives data only. Physics bodies and interpreter objects stay
// in the simulation thread; no functions or proxy objects cross the boundary.
const fields=['state','visible','sidevisible','basevisible','capvisible','ringvisible','skirtvisible','showbracket','imagea','color','colorfull','rotx','roty','rotz','isdropped','sequenceactive','sequencestate','blinkinterval','blinkpattern','intensity','intensityscale','inplayintensity','inplayon'];
const flasherFields=[...fields,'imageb','opacity','amount','filter','addblend','modulatevsadd','height'];
const fieldsFor=(game,name)=>game.nativeParts.get(name)?.kind==='Flasher'?flasherFields:fields;
const roots=['time','state','score','player','ballNumber','charge','inLane','tilted','gameState','held','physicsStats','scriptStats'];
// Cache only object-property reads, separately for each delta consumer. Live
// getters remain uncached; physical steps and publication cadence are unchanged.
const objectRevisions=new WeakMap();
// A prepared native draw holds its Ball reference even if physics removes it
// before submission. Never query a deleted Rapier body for that final state.
export function snapshotSubmissionBall(game,record){
  const f=Math.fround;
  if(record.removed){
    const state=record.detachedNative?record.proxy:record.lastState;
    return{id:record.body.handle,scriptId:record.scriptID,position:{x:f(state.x),y:f(state.y),z:f(state.z)},velocity:{x:f(state.velx),y:f(state.vely),z:f(state.velz)},radius:f(record.proxy.radius),locked:record.lastRenderLocked};
  }
  const native=game.nativeBall(record.body),velocity=native.body.linvel();
  return{id:record.body.handle,scriptId:record.scriptID,position:{...native.sync()},velocity:{x:f(velocity.x),y:f(-velocity.y),z:f(velocity.z)},radius:f(record.proxy.radius),locked:!!record.held&&record.held!=='lane'};
}
function objectState(object,keys=fields){
  const state={};
  for(const key of keys){const value=object[key];if(value===null||['string','number','boolean'].includes(typeof value))state[key]=value;}
  return state;
}
function objectChanges(object,previous,keys=fields){
  let changed;
  for(const key of keys){const value=object[key];if((value===null||['string','number','boolean'].includes(typeof value))&&(!Object.hasOwn(previous,key)||!Object.is(value,previous[key]))){(changed??={})[key]=value;previous[key]=value;}}
  return changed;
}
export function describeGame(game){
  const mechanism=m=>({spec:{name:m.spec.name,kind:m.spec.kind,rotation:m.spec.rotation,is_visible:m.spec.is_visible},angle:m.angle});
  return {
    flippers:game.flippers.map(f=>{const spec=game.nativeParts.get(game.colliderLabels.get(f.collider.handle).toLowerCase());return{p:{...f.p},length:f.length,angle:f.angle,spec:{...spec,surface_height:game.surface(spec)}};}),
    scoop:{...game.scoop},spinners:game.spinners.map(mechanism),gates:game.gates.map(mechanism),
    targetMotions:[...game.targetMotions].map(([name,m])=>[name,{offset:m.offset,revision:m.revision,collidable:m.collidable,drop:m.drop,rotZ:m.spec.rot_z}]),
    visualMotions:[...game.visualMotions].map(([name,m])=>[name,m.snapshot()]),
    specs:{objects:game.specs.objects.filter(s=>s.kind==='Light').map(s=>({...s,surface_height:game.surface(s)}))},
    objects:[...game.rules.objects].map(([name,object])=>[name,objectState(object,fieldsFor(game,name))]),
  };
}
export function snapshotGame(game,names,queries,previousObjects){
  let revisions;if(previousObjects){revisions=objectRevisions.get(previousObjects);if(!revisions){revisions=new Map();objectRevisions.set(previousObjects,revisions);}}
  const snapshot=Object.fromEntries(roots.map(key=>[key,game[key]]));
  const bodyState=body=>({id:body.handle,p:{...body.translation()},rotation:game.nativeDisplacements?game.nativeBall(body).orientation.rotation():{...body.rotation()}});
  snapshot.ball=bodyState(game.ball);
  snapshot.records=game.records.map(rec=>({...bodyState(rec.body),previous:rec.previous?{...rec.previous}:undefined,held:rec.held,inLane:rec.inLane}));
  snapshot.renderBalls=game.renderRecords.map(rec=>{const native=game.nativeBall(rec.body);return{...snapshotSubmissionBall(game,rec),orientation:native.orientation.matrix.slice(),...rec.render};});
  snapshot.flippers=game.flippers.map(f=>f.angle);
  snapshot.spinners=game.spinners.map(s=>s.angle);snapshot.gates=game.gates.map(g=>g.angle);
  snapshot.targets=[...game.targetMotions].map(([name,t])=>[name,t.offset,t.revision]);
  snapshot.visualMotions=[...game.visualMotions].map(([name,m])=>[name,m.snapshot()]);
  snapshot.plungerPosition=game.plunger.pos;
  snapshot.cabinetOffset={...game.cabinetNudge.nativeOffset};
  snapshot.objects=[];
  for(const name of names){
    const object=game.rules.objects.get(name);if(!object)continue;
    const keys=fieldsFor(game,name);
    if(!previousObjects){snapshot.objects.push([name,objectState(object,keys)]);continue;}
    let previous=previousObjects.get(name);
    const revision=game.rules.snapshotRevision?.(object,keys),last=revisions.get(name);
    if(revision!==undefined&&last?.object===object&&last.keys===keys&&last.revision===revision&&last.previous===previous)continue;
    if(!previous){previous={};previousObjects.set(name,previous);}
    const changed=objectChanges(object,previous,keys);
    if(revision!==undefined)revisions.set(name,{object,keys,revision,previous});
    if(changed)snapshot.objects.push([name,changed]);
  }
  snapshot.values=[...queries].map(query=>[query,game.rules.value(query)]);
  return snapshot;
}
