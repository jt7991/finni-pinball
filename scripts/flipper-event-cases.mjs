// Measurement inputs derive only from the table's authored flipper dimensions.
export function flipperEventCases(layout){
  const cases=[];
  for(const spec of layout.items.filter(item=>item.kind==='Flipper')){
    const side=spec.name.startsWith('Left')?'left':'right',angle=spec.start_angle*Math.PI/180,d={x:Math.sin(angle),y:-Math.cos(angle)},ratio=(spec.base_radius-spec.end_radius)/spec.flipper_radius_max,face=side==='left'?-1:1;
    const nx=face*Math.sqrt(1-ratio*ratio),ny=-ratio,n={x:nx*Math.cos(angle)-ny*Math.sin(angle),y:ny*Math.cos(angle)+nx*Math.sin(angle)};
    for(const fraction of [.1,.5,.9])for(const speed of [2,8]){
      const radius=spec.base_radius+(spec.end_radius-spec.base_radius)*fraction+25.01;
      cases.push({name:`${side}-face-${fraction}-${speed}`,flipper:spec.name,x:spec.center.x+d.x*spec.flipper_radius_max*fraction+n.x*radius,y:spec.center.y+d.y*spec.flipper_radius_max*fraction+n.y*radius,z:25,vx:-n.x*speed,vy:-n.y*speed,sampleCount:12,maximumMilliseconds:100});
    }
    const middle=cases.find(c=>c.name===`${side}-face-0.5-8`);
    cases.push({...middle,name:`${side}-base`,x:spec.center.x-d.x*(spec.base_radius+25.01),y:spec.center.y-d.y*(spec.base_radius+25.01),vx:d.x*8,vy:d.y*8});
    cases.push({...middle,name:`${side}-tipcap`,x:spec.center.x+d.x*(spec.flipper_radius_max+spec.end_radius+25.01),y:spec.center.y+d.y*(spec.flipper_radius_max+spec.end_radius+25.01),vx:-d.x*8,vy:-d.y*8});
    cases.push({...middle,name:`${side}-quiet`,vx:-n.x*.15,vy:-n.y*.15});
    cases.push({...middle,name:`${side}-moving`,side});
    for(const delay of [100,500])cases.push({...middle,name:`${side}-repeat-${delay}`,repeatFlipperReset:true,delay,sampleCount:60,maximumMilliseconds:650});
  }
  return cases;
}
