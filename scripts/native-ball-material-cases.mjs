// Explicit stationary native component inputs, never production poses.
export function nativeBallMaterialCases(lights){
  const cases=[
    {kicker:'BallRelease',x:300,y:800,z:100,color:0xffffff,decal:'JPBall-Scratches'},
    {kicker:'Hellhouse',x:650,y:800,z:100,color:0x1234ab,decal:''},
    {kicker:'He',x:300,y:1250,z:65,color:0xaa8844,decal:''},
    {kicker:'La',x:650,y:1250,z:65,color:0x33dd77,decal:'JPBall-Scratches'},
  ];
  const setup=['Dim BallMaterialExisting,BallMaterialEach',
    'BallMaterialExisting=GetBalls:For Each BallMaterialEach In BallMaterialExisting:BallMaterialEach.Visible=False:Next'];
  const observe=[];
  for(const [index,c]of cases.entries()){
    const name='BallMaterial'+index;
    setup.push(`Dim ${name}:Set ${name}=${c.kicker}.CreateBall`,
      ...Object.entries({X:c.x,Y:c.y,Z:c.z,Color:c.color}).map(([key,value])=>`${name}.${key}=${value}`),
      `${name}.Visible=True:${name}.ForceReflection=True:${name}.FrontDecal="${c.decal}"`);
    observe.push(`Debug.Print "BALL_MATERIAL|${index}|" & `+
      ['ID','X','Y','Z','Radius','Color'].map(key=>`CStr(CDbl(${name}.${key}))`).join(' & "|" & ')+` & "|" & ${name}.FrontDecal`);
  }
  for(const light of lights)observe.push(`Debug.Print "BALL_LIGHT|${light.name}|" & CStr(CDbl(${light.name}.Color)) & "|" & CStr(CDbl(${light.name}.GetInPlayIntensity))`);
  return {cases,setup:setup.join(':'),observe:observe.join(':'),scope:'Four declared stationary balls created in native kickers. Physical positions/colors and named or blank decals are explicit component inputs. Their locked state prevents physics displacement; source timers and sequencers are disabled by the existing freeze-scene control. Every getter observation is read-only after the captured draw.'};
}
