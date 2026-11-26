// Declared public Ball setters and Kicker calls. Expressions preserve signed
// zero as an input operation rather than relying on JSON number encoding.
export function ballStateScenarios(){
 const values=['0','-CSng(0)','1E-20','-1E-20','0.000001','2115','2115.000244140625','16777216','-16777216'];
 return Array.from({length:27},(_,index)=>{
  const value=values[index%values.length],axes=index%2?['Z','X','Y']:['X','Y','Z'];
  return {index,kicker:['HellHouse','BallRelease','lock'][index%3],setters:[
   ...axes.map(property=>({property,value})),
   ...['VelX','VelY','VelZ'].map((property,i)=>({property,value:values[(index+i)%values.length]})),
   ...['AngMomX','AngMomY','AngMomZ'].map((property,i)=>({property,value:values[(index+i+1)%values.length]})),
   {property:'VelX',value:'0'},{property:'VelY',value:'-CSng(0)'},
  ],kick:'KickXYZ 0,0,0,'+(index%3===0?'0,0,0':index%3===1?'-CSng(0),-CSng(0),-CSng(0)':'1,-1,0.03125')};
 });
}
