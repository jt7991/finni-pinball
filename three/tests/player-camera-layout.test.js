import test from 'node:test';
import assert from 'node:assert/strict';
import {createViews} from '../../browser/views.js';
import {playerCameraLayout} from '../player-camera.js';
import {computeNativeCamera,nativeCameraPresets} from '../native-camera.js';
import fs from 'node:fs';

test('portrait framing and plunger visibility agree with the actual main UI at narrow, tablet and rotated layouts',()=>{
  const globals=['document','matchMedia','localStorage','requestAnimationFrame','ResizeObserver'];
  const previous=Object.fromEntries(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  try{
    for(const [w,h,width,height,coarse]of [[320,568,320,490,true],[390,844,390,766,true],[430,932,430,854,true],[768,1024,768,946,true],[844,390,506,326,true],[1440,900,1440,766,false],[900,1440,720,1320,false]]){
      const classes={add(){},remove(){},toggle(){},contains(){return false;}};
      const node=()=>({classList:classes,style:{},before(){},after(){},append(){},focus(){},setAttribute(){},addEventListener(){}});
      const picker=node(),select={...node(),value:'balanced',closest:()=>picker};
      const screen={...node(),clientWidth:width,clientHeight:height},canvas={...node(),width:1280,height:720};
      const nodes={'camera-view':select,canvas,portrait:node(),'camera-controls':node()};
      const phone=w<=650||coarse&&w<=1024,portrait=h>=w,tallPortrait=w/h<=2/3;
      Object.assign(globalThis,{
        document:{body:{classList:classes},getElementById:id=>nodes[id],createComment:node,querySelector:query=>query==='.screen'?screen:null},
        matchMedia:query=>({matches:query.includes('max-aspect-ratio')?tallPortrait:query.includes('orientation')?portrait:phone,addEventListener(){}}),
        localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},ResizeObserver:class{observe(){}}
      });
      const commands=[],views=createViews(statement=>commands.push(statement),()=>true);
      for(const name of Object.keys(nativeCameraPresets)){
        select.value=name;commands.length=0;views.apply();
        const statement=commands[0],number=field=>Number(statement.match(new RegExp('Table1\\.'+field+'=([^:]+)'))[1]);
        const expected=['Inclination','FieldOfView','Layback','Xlatey','Xlatez','ScaleX'].map(number);
        const actual=playerCameraLayout(name,{width,height,phone,portrait,tallPortrait});
        assert.deepEqual(actual.preset,expected,`${w}x${h} ${name} projection inputs`);
        assert.equal(actual.plungerVisible,statement.includes('Plunger.Visible=True'),`${w}x${h} ${name} plunger mesh`);
      }
    }
  }finally{
    for(const name of globals){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}
  }
});

test('explicit player camera inputs preserve canonical native projection math and static sample offsets',()=>{
  const bounds=JSON.parse(fs.readFileSync(new URL('../public/camera-bounds.json',import.meta.url)));
  for(const [name,values]of Object.entries(nativeCameraPresets))for(const aspect of [.4,.7,1.6])for(const offset of [{x:0,y:0},{x:.0003,y:-.0005}]){
    const a=computeNativeCamera(bounds,aspect,name,offset),b=computeNativeCamera(bounds,aspect,values,offset);
    for(const field of ['view','projection','fit','near','far'])assert.deepEqual(b[field],a[field],name+' '+field);
  }
});
