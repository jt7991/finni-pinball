// Native reference inputs derived from authored control points and positions.
export function materialEventCases(layout){
  const cases=[];
  const wall=name=>layout.items.find(item=>item.name===name);
  const face=(spec,speed)=>{
    const [a,b]=spec.drag_points,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),normal={x:-dy/length,y:dx/length};
    return {name:`${spec.name}-face-${speed}`,object:spec.name,x:(a.x+b.x)*.5+normal.x*25.01,y:(a.y+b.y)*.5+normal.y*25.01,z:25,vx:-normal.x*speed,vy:-normal.y*speed,normal};
  };
  for(const name of ['rlband003','rlband004','rlband007'])for(const speed of [1,6])cases.push(face(wall(name),speed));
  const spec=wall('rlband003'),base=face(spec,6),[a,b]=spec.drag_points,previous=spec.drag_points.at(-1),corner=(()=>{
    const dx=a.x-previous.x,dy=a.y-previous.y,length=Math.hypot(dx,dy),x=base.normal.x-dy/length,y=base.normal.y+dx/length,size=Math.hypot(x,y);return {x:x/size,y:y/size};
  })();
  cases.push({...base,name:'rlband003-top',x:spec.drag_points.reduce((s,p)=>s+p.x,0)/spec.drag_points.length,y:spec.drag_points.reduce((s,p)=>s+p.y,0)/spec.drag_points.length,z:75.01,vx:0,vy:0,vz:-8});
  const diagonal=Math.SQRT1_2;
  cases.push({...base,name:'rlband003-top-edge',x:(a.x+b.x)*.5+base.normal.x*25.01*diagonal,y:(a.y+b.y)*.5+base.normal.y*25.01*diagonal,z:50+25.01*diagonal,vx:-base.normal.x*8*diagonal,vy:-base.normal.y*8*diagonal,vz:-8*diagonal});
  cases.push({...base,name:'rlband003-vertical-corner',x:a.x+corner.x*25.01,y:a.y+corner.y*25.01,vx:-corner.x*8,vy:-corner.y*8});
  cases.push({...base,name:'rlband003-top-corner',x:a.x+corner.x*25.01*diagonal,y:a.y+corner.y*25.01*diagonal,z:50+25.01*diagonal,vx:-corner.x*8*diagonal,vy:-corner.y*8*diagonal,vz:-8*diagonal});
  cases.push({...base,name:'rlband003-baked-flags',objectOverrides:{HasHitEvent:false,Threshold:100}});
  cases.push({...base,name:'rlband003-disabled',objectOverrides:{Collidable:false}});
  for(const speed of [.5,8])cases.push({name:`rpeg003-side-${speed}`,object:'rpeg003',x:855,y:1045,z:25,vx:-speed,vy:0});
  for(const name of ['Camera1','Camera2']){
    const primitive=wall(name);cases.push({name:name+'-drop',object:name,x:primitive.position.x,y:primitive.position.y,z:180,vx:0,vy:0,vz:-4});
  }
  cases.push({name:'Rubber001-enabled',object:'Rubber001',x:50,y:1316.7894,z:54,vx:6,vy:0});
  return cases.map(c=>({...c,sampleCount:12,maximumMilliseconds:100}));
}
