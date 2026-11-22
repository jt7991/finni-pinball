import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RADIUS} from './game-constants.js';
import {applyTargetAnimation,targetAnimationAxis} from './target-render.js';
import {createBulbHalos,createLightFrame} from './bulb-render.js';
import {createClassicLights,loadNativeLighting} from './classic-render.js';

export async function createView(canvas, game) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.setClearColor(0x101b18);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-6,6,12,-12,.1,200);
  scene.add(new THREE.HemisphereLight(0xe6f1ff,0x686578,2.6));
  const key=new THREE.DirectionalLight(0xfff0d8,2.4);key.position.set(-5,-3,20);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc7dcff,1.3);fill.position.set(12,15,12);scene.add(fill);
  const base=import.meta.env.BASE_URL;
  const draco=new DRACOLoader().setDecoderPath(`${base}draco/`).setDecoderConfig({type:'wasm'}).setWorkerLimit(1);
  const [floor,table,lighting]=await Promise.all([
    new THREE.TextureLoader().loadAsync(`${base}playfield.webp`),
    new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}table.glb`),
    loadNativeLighting(base),
  ]);
  draco.dispose();
  floor.colorSpace=THREE.SRGBColorSpace;floor.flipY=false;floor.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const board=new THREE.Mesh(new THREE.PlaneGeometry(9.52,21.15),new THREE.MeshBasicMaterial({map:floor}));
  const boardUV=board.geometry.attributes.uv;for(let i=0;i<boardUV.count;i++)boardUV.setY(i,1-boardUV.getY(i));
  board.position.set(4.76,10.575,-.005);scene.add(board);
  table.scene.rotation.x=Math.PI/2;table.scene.scale.setScalar(.01/.00053975);
  table.scene.position.y=21.15;
  scene.add(table.scene);
  const moving=[];
  table.scene.traverse(obj=>{
    const state=game.rules?.objects.get(obj.name.replace(/_Finni$/,'').replace(/(Plate|Wire)$/,'').toLowerCase());
    if(state){
      const mechanism=game.spinners?.find(s=>obj.name===s.spec.name+'Plate')??game.gates?.find(s=>obj.name===s.spec.name+'Wire'),angle=(mechanism?.spec.rotation??0)*Math.PI/180;
      const target=game.targetMotions?.get(obj.name.toLowerCase());
      moving.push({obj,state,position:obj.position.clone(),rotation:obj.rotation.clone(),quaternion:obj.quaternion.clone(),target,mechanism,axis:mechanism?new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)):target&&!target.drop?targetAnimationAxis(target.rotZ??target.spec?.rot_z):null});
    }
  });

  const steel=new THREE.MeshStandardMaterial({color:0xb0bac6,metalness:.65,roughness:.32});
  const cream=new THREE.MeshStandardMaterial({color:0xffe7b0,roughness:.38});
  const pink=new THREE.MeshStandardMaterial({color:0xf42480,roughness:.42});
  // Ramp collision strips are deliberately invisible. The accepted model supplies
  // the open wire geometry; filling the strips would turn it into a solid chute.

  const flippers=game.flippers.map(f=>{
    const group=new THREE.Group();group.position.set(f.p.x,f.p.y,0);
    const outline=new THREE.Shape();
    const length=f.length;
    outline.absarc(0,0,.205,Math.PI/2,Math.PI*1.5,false);
    outline.lineTo(length,-.117);outline.absarc(length,0,.117,-Math.PI/2,Math.PI/2,false);outline.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.28,bevelEnabled:true,bevelThickness:.03,bevelSize:.02,bevelSegments:1,steps:1,curveSegments:12}),cream);
    mesh.position.z=.08;group.add(mesh);
    const top=new THREE.Mesh(new THREE.CapsuleGeometry(.08,length*.65,3,8),pink);
    top.rotation.z=Math.PI/2;top.position.set(length*.5,0,.4);group.add(top);
    scene.add(group);return group;
  });
  const ball=new THREE.Mesh(new THREE.SphereGeometry(RADIUS,20,14),new THREE.MeshStandardMaterial({color:0xffffff,metalness:.7,roughness:.17}));
  scene.add(ball);
  // Baked contact shadows avoid a per-frame shadow-map pass on phones.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64;
  const context=shadowCanvas.getContext('2d'),gradient=context.createRadialGradient(32,32,3,32,32,32);
  gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  context.fillStyle=gradient;context.fillRect(0,0,64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.85,.85),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
  scene.add(shadow);
  const balls=[ball],shadows=[shadow];
  const classicLights=createClassicLights(game,scene,floor,lighting);
  const bulbHalos=createBulbHalos(game,scene),lightFrame=createLightFrame(renderer);
  // A modest steel lip marks the scoop; capture/eject use the real sensor position.
  const scoop=new THREE.Mesh(new THREE.TorusGeometry(.36,.055,6,24),steel);
  scoop.position.set(game.scoop.x,game.scoop.y,.05);scene.add(scoop);
  let cameraMode='balanced',quality='performance',shakeUntil=0,shakeStrength=0;
  function resize() {
    const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
    renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='detailed'?2:1.25));
    renderer.setSize(width,height,false);
    lightFrame.resize();
    camera.position.set(4.76,cameraMode==='overhead'?10.575:cameraMode==='classic'?-18:-4,cameraMode==='overhead'?38:35);
    camera.up.set(0,1,0);camera.lookAt(4.76,10.575,0);camera.updateMatrixWorld();
    const corners=[];
    for(const x of [-.15,9.67])for(const y of [cameraMode==='playfield'?1:-.1,21.35])for(const z of [0,1.8])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
    const bounds=new THREE.Box3().setFromPoints(corners),size=bounds.getSize(new THREE.Vector3());
    const aspect=width/height,h=Math.max(size.y,size.x/aspect)*1.015;
    const center=bounds.getCenter(new THREE.Vector3());
    camera.left=center.x-h*aspect/2;camera.right=center.x+h*aspect/2;
    camera.top=center.y+h/2;camera.bottom=center.y-h/2;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function render(alpha,previous) {
    const records=game.records??[{body:game.ball,previous,held:game.capturedUntil?'scoop':null}];
    while(balls.length<records.length){const mesh=ball.clone(),contact=shadow.clone();contact.material=shadow.material.clone();scene.add(mesh,contact);balls.push(mesh);shadows.push(contact);}
    for(let i=0;i<balls.length;i++){
      const mesh=balls[i],contact=shadows[i],rec=records[i];mesh.visible=!!rec&&(!rec.held||rec.held==='lane');contact.visible=mesh.visible;
      if(!rec)continue;const p=rec.body.translation(),before=rec.previous??p;
      mesh.position.set(before.x+(p.x-before.x)*alpha,before.y+(p.y-before.y)*alpha,before.z+(p.z-before.z)*alpha);
      mesh.quaternion.copy(game.nativeDisplacements?game.nativeBall(rec.body).orientation.rotation():rec.body.rotation());contact.position.set(mesh.position.x,mesh.position.y,.015);contact.material.opacity=Math.max(.15,1-mesh.position.z/4);
    }
    for(const m of moving){
      if(m.target)applyTargetAnimation(m.obj,m.target,m,m.axis);
      else{m.obj.position.copy(m.position);if(m.state.isdropped)m.obj.position.y-=.04;}
      if(m.state.sequenceactive){m.obj.visible=!!m.state.sequencestate;m.sequenceOverride=true;}
      else if((m.target||m.sequenceOverride)&&m.state.visible!==undefined){m.obj.visible=!!m.state.visible;m.sequenceOverride=false;}
      if(m.mechanism)m.obj.quaternion.setFromAxisAngle(m.axis,m.mechanism.angle).multiply(m.quaternion);
      if(/discoball/i.test(m.obj.name))m.obj.rotation.y=m.rotation.y+Number(m.state.rotz)*Math.PI/180;
      if(/LilHead|LilLeftArm|LilRightArm/.test(m.obj.name)){
        m.obj.rotation.x=m.rotation.x-Number(m.state.rotx)*Math.PI/180;
        m.obj.rotation.z=m.rotation.z-Number(m.state.roty)*Math.PI/180;
      }
    }
    for(let i=0;i<flippers.length;i++)flippers[i].rotation.z=game.flippers[i].angle;
    classicLights.update(camera);bulbHalos.update();lightFrame.render(scene,camera);
  }
  return {renderer,scene,classicLights,bulbHalos,render,resize,shake(strength){shakeUntil=game.time+.8;shakeStrength=Number(strength)||1;},setCamera(value){cameraMode=value;resize();},setQuality(value){quality=value;resize();}};
}
