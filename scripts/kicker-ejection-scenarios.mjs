// Public API inputs. No native poses, random words or ejection results are
// consulted when constructing the sequence.
export function kickerEjectionScenarios(){
 const angles=[-360,-315,-180,-90,0,30,90,123.14159,164,180,270,360,405,720,-720,1000000],speeds=[0,7,12,-8,27.25],inclinations=[0,.5,-.5,Math.fround(Math.PI/2),Math.fround(Math.PI/2)-2**-23,Math.fround(Math.PI/2)+2**-23,45,-30,135],scatter=[0,0.0000001,0.001,5,-1,12.5];
 return Array.from({length:72},(_,index)=>({index,kicker:['HellHouse','BallRelease','lock'][index%3],method:['Kick','KickZ','KickXYZ'][index%3],angle:angles[index%angles.length],speed:speeds[index%speeds.length],inclination:inclinations[index%inclinations.length],scatter:scatter[index%scatter.length],position:[400.125,900.5,75.25],momentum:[12.3,-7.5,.625],offset:index%3===0?[0,0,0]:index%3===1?[0,0,[-5,.03125,12.75][index%3]]:[1.125,-2.375,3.625]}));
}
export function kickerEjectionStatement(input){
 const args=[input.angle,input.speed,input.inclination,...input.method==='KickXYZ'?input.offset:input.method==='KickZ'?[input.offset[2]]:[]];
 return input.kicker+'.'+input.method+' '+args.join(',');
}
