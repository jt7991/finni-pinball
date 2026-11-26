// Declared component inputs only. No game RNG, allocation identity or native
// collision result is used to construct these encounters.
export function ballParameterScenarios(){
 const f=Math.fround,normals=[[1,0,0],[.6,.8,0],[0,0,1],[-.8,0,.6],[0,-.6,.8],[3/13,4/13,12/13]],radii=[12.5,25,37.5,17.25],masses=[.5,1,2,3.25,1.3],gaps=[-3,-.03,0,.01,.05,.075,.5,5,50];
 return Array.from({length:96},(_,index)=>{
  const radius=[radii[index%radii.length],radii[Math.floor(index/4)%radii.length]],mass=[masses[index%masses.length],masses[Math.floor(index/5)%masses.length]],n=normals[index%normals.length],gap=gaps[index%gaps.length],speed=index%11===0?0:16,base=[1.5,-2,.125],p=[400,900,300];
  const balls=radius.map((r,i)=>({radius:r,mass:mass[i],p:p.map((v,j)=>f(v+(i?n[j]*(radius[0]+radius[1]+gap):0))),v:base.map((v,j)=>f(v+n[j]*(i?-speed*.375:speed*.625))),momentum:[1,-2,3],method:index%3===1?'CreateBall':mass[i]===1?'CreateSizedBall':'CreateSizedBallWithMass',...(index%3===1?{createRadius:25,createMass:1}:{})}));
  return {index,duration:[.1,.5,2][index%3],balls};
 });
}
