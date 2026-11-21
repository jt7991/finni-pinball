export function targetEventCases(specs){
  const cases=[];
  for(const name of ['Target001','Target005','Target010']){
    const spec=specs.objects.find(s=>s.name===name),a=spec.rot_z*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)};
    const offset=spec.target_type.startsWith('drop')?.181738*spec.size.y:Math.max(...spec.collision_mesh.vertices.map(v=>v[1]))*spec.size.y;
    for(const speed of [.5,8])cases.push({name:`${name}-front-${speed}`,object:name,x:spec.position.x+n.x*(offset+25.01),y:spec.position.y+n.y*(offset+25.01),z:25,vx:-n.x*speed,vy:-n.y*speed});
    const first=cases.at(-1);
    cases.push({...first,name:name+'-baked-flags',objectOverrides:{HasHitEvent:false,Threshold:100}});
    cases.push({...first,name:name+'-disabled',objectOverrides:{Collidable:false}});
  }
  const spec=specs.objects.find(s=>s.name==='Target010'),a=spec.rot_z*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},offset=Math.min(...spec.collision_mesh.vertices.map(v=>v[1]))*spec.size.y;
  cases.push({name:'Target010-back',object:spec.name,x:spec.position.x+n.x*(offset-25.01),y:spec.position.y+n.y*(offset-25.01),z:25,vx:n.x*8,vy:n.y*8});
  const result=cases.map(c=>({...c,sampleCount:12,maximumMilliseconds:40}));
  result.push({...result.find(c=>c.name==='Target010-baked-flags'),name:'Target010-baked-completion',sampleCount:24,maximumMilliseconds:130});
  return result;
}
