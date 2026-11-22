// The renderer receives data only. Physics bodies and interpreter objects stay
// in the simulation thread; no functions or proxy objects cross the boundary.
const fields=['state','visible','sidevisible','basevisible','capvisible','ringvisible','skirtvisible','showbracket','imagea','color','colorfull','rotx','roty','rotz','isdropped','sequenceactive','sequencestate','blinkinterval','blinkpattern','intensity','intensityscale','inplayintensity','inplayon'];
const roots=['time','state','score','player','ballNumber','charge','inLane','tilted','gameState','held','physicsStats'];
function objectState(object){
  const state={};
  for(const key of fields){const value=object[key];if(value===null||['string','number','boolean'].includes(typeof value))state[key]=value;}
  return state;
}
function objectChanges(object,previous){
  let changed;
  for(const key of fields){const value=object[key];if((value===null||['string','number','boolean'].includes(typeof value))&&(!Object.hasOwn(previous,key)||!Object.is(value,previous[key]))){(changed??={})[key]=value;previous[key]=value;}}
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
    objects:[...game.rules.objects].map(([name,object])=>[name,objectState(object)]),
  };
}
export function snapshotGame(game,names,queries,previousObjects){
  const snapshot=Object.fromEntries(roots.map(key=>[key,game[key]]));
  const bodyState=body=>({id:body.handle,p:{...body.translation()},rotation:game.nativeDisplacements?game.nativeBall(body).orientation.rotation():{...body.rotation()}});
  snapshot.ball=bodyState(game.ball);
  snapshot.records=game.records.map(rec=>({...bodyState(rec.body),previous:rec.previous?{...rec.previous}:undefined,held:rec.held,inLane:rec.inLane}));
  snapshot.flippers=game.flippers.map(f=>f.angle);
  snapshot.spinners=game.spinners.map(s=>s.angle);snapshot.gates=game.gates.map(g=>g.angle);
  snapshot.targets=[...game.targetMotions].map(([name,t])=>[name,t.offset,t.revision]);
  snapshot.visualMotions=[...game.visualMotions].map(([name,m])=>[name,m.snapshot()]);
  snapshot.plungerPosition=game.plunger.pos;
  snapshot.objects=[...names].flatMap(name=>{const object=game.rules.objects.get(name);if(!object)return[];if(!previousObjects)return[[name,objectState(object)]];let previous=previousObjects.get(name);if(!previous){previous={};previousObjects.set(name,previous);}const changed=objectChanges(object,previous);return changed?[[name,changed]]:[];});
  snapshot.values=[...queries].map(query=>[query,game.rules.value(query)]);
  return snapshot;
}
