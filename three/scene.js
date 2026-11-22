import * as THREE from 'three';
import {RADIUS} from './game-constants.js';
import {createBulbHalos,createLightFrame} from './bulb-render.js';
import {createClassicLights,loadNativeLighting} from './classic-render.js';
import {createFlipperVisuals,loadFlipperVisuals} from './flipper-render.js';
import {applyNativeCamera} from './camera-render.js';
import {nativePrimitiveWorld} from './primitive-transform.js';
import {nativeProbeArea} from './native-reflection.js';
import {loadNativePrimitiveVisuals,createNativePrimitiveVisuals} from './native-basic-render.js';
import {loadNativeMechanismAnimation,createNativeMechanismAnimation} from './native-mechanism-render.js';
import {createNativeReflectionPass} from './reflection-render.js';
import {createNativeOpaqueCache} from './native-opaque-cache.js';
import {loadNativeTransmission,createNativeTransmission} from './transmission-render.js';

export async function createView(canvas,game){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),base=import.meta.env.BASE_URL;
 // These lights serve the remaining standard ball material. Authored table,
 // flipper and light shaders use their original native lighting inputs.
 scene.add(new THREE.HemisphereLight(0xe6f1ff,0x686578,2.6));const key=new THREE.DirectionalLight(0xfff0d8,2.4);key.position.set(-5,-3,20);scene.add(key);const fill=new THREE.DirectionalLight(0xc7dcff,1.3);fill.position.set(12,15,12);scene.add(fill);
 const [lighting,flipperAssets,cameraBounds,tableAssets,animationAssets,transmissionAssets]=await Promise.all([
  loadNativeLighting(base),loadFlipperVisuals(base,renderer.capabilities.getMaxAnisotropy()),
  fetch(base+'camera-bounds.json').then(response=>{if(!response.ok)throw Error('Native camera bounds unavailable');return response.json();}),
  loadNativePrimitiveVisuals(base+'native-table/','native-table.json'),loadNativeMechanismAnimation(base),loadNativeTransmission(base+'native-transmission/'),
 ]);
 const floorRecord=tableAssets.metadata.parts.find(p=>p.spec.name==='playfield_mesh');if(!floorRecord?.probe)throw Error('Authored playfield probe unavailable');
 const reflectionPass=createNativeReflectionPass(renderer,floorRecord.probe),nativeTransmission=createNativeTransmission(renderer,transmissionAssets,name=>game.rules.objects.get(name.toLowerCase()));
 const nativeTable=createNativePrimitiveVisuals(renderer,scene,tableAssets,lighting,{stateFor:name=>game.rules.objects.get(name.toLowerCase()),transmissionTexture:nativeTransmission.texture,reflectionTexture:reflectionPass.texture});nativeTable.root.name='NativeTable';
 const nativeMechanisms=createNativeMechanismAnimation(game,nativeTable,animationAssets),nativeCache=createNativeOpaqueCache(renderer,nativeTable),floorPart=nativeTable.parts.find(p=>p.spec.name==='playfield_mesh'),floor=floorPart.material.uniforms.tex_base_color.value;
 const actorNames=new Set(['discoball','LilHead','LilLeftArm','LilRightArm','Primitive077']),nativeActors={parts:nativeTable.parts.filter(p=>actorNames.has(p.spec.name)),root:nativeTable.root};
 const flipperVisuals=createFlipperVisuals(game,scene,lighting,flipperAssets),classicLights=createClassicLights(game,scene,floor,lighting),bulbHalos=createBulbHalos(game,scene),lightFrame=createLightFrame(renderer);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(RADIUS,20,14),new THREE.MeshStandardMaterial({color:0xffffff,metalness:.7,roughness:.17}));ball.name='PlayableBall';scene.add(ball);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const context=shadowCanvas.getContext('2d'),gradient=context.createRadialGradient(32,32,3,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.85,.85),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));scene.add(shadow);const balls=[ball],shadows=[shadow];
 let cameraMode='balanced',quality='performance',cacheEnabled=true,shakeUntil=0,shakeStrength=0;
 function resizeTargets(){const size=renderer.getDrawingBufferSize(new THREE.Vector2());lightFrame.resize();reflectionPass.resize(size.x,size.y);nativeTransmission.resize(size.x,size.y);nativeCache.invalidate();}
 function resize(){const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height){if(!camera.userData.nativeCamera)applyNativeCamera(camera,cameraBounds,Math.max(1,canvas.width)/Math.max(1,canvas.height),cameraMode);resizeTargets();return;}renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='detailed'?2:1.25));renderer.setSize(width,height,false);resizeTargets();const size=renderer.getDrawingBufferSize(new THREE.Vector2());applyNativeCamera(camera,cameraBounds,size.x/size.y,cameraMode);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();nativeMechanisms.update();nativeTable.update(camera);nativeTransmission.update(camera);flipperVisuals.update(camera);await nativeTable.prepare(camera);await nativeTransmission.prepare();await renderer.compileAsync(scene,camera);
 function render(alpha,previous){
  const records=game.records??[{body:game.ball,previous,held:game.capturedUntil?'scoop':null}];while(balls.length<records.length){const mesh=ball.clone(),contact=shadow.clone();contact.material=shadow.material.clone();scene.add(mesh,contact);balls.push(mesh);shadows.push(contact);}
  for(let i=0;i<balls.length;i++){const mesh=balls[i],contact=shadows[i],record=records[i];mesh.visible=!!record&&(!record.held||record.held==='lane');contact.visible=mesh.visible;if(!record)continue;const p=record.body.translation(),before=record.previous??p;mesh.position.set(before.x+(p.x-before.x)*alpha,before.y+(p.y-before.y)*alpha,before.z+(p.z-before.z)*alpha);mesh.quaternion.copy(game.nativeDisplacements?game.nativeBall(record.body).orientation.rotation():record.body.rotation());contact.position.set(mesh.position.x,mesh.position.y,.015);contact.material.opacity=Math.max(.15,1-mesh.position.z/4);}
  nativeMechanisms.update();nativeTransmission.update(camera);nativeTransmission.render();
  const hidden=[...classicLights.meshes,bulbHalos.mesh,...shadows].map(mesh=>[mesh,mesh.visible]);for(const [mesh]of hidden)mesh.visible=false;
  try{reflectionPass.render(camera,(view,target)=>{nativeTable.update(view);flipperVisuals.update(view);nativeCache.render(scene,view,target,{enabled:cacheEnabled});},{area:nativeProbeArea(floorRecord.bounds,nativePrimitiveWorld(floorRecord.spec),camera.userData.nativeCamera)});}finally{for(const [mesh,value]of hidden)mesh.visible=value;}
  nativeTable.update(camera);flipperVisuals.update(camera);classicLights.update(camera);bulbHalos.update();lightFrame.render(scene,camera,target=>nativeCache.render(scene,camera,target,{enabled:cacheEnabled}));
 }
 return{renderer,scene,camera,cameraBounds,nativeTable,nativeMechanisms,nativeCache,nativeTransmission,reflectionPass,nativeActors,classicLights,bulbHalos,flipperVisuals,lightFrame:{...lightFrame,resize:resizeTargets},render,resize,resizeTargets,setCacheEnabled(value){cacheEnabled=!!value;nativeCache.invalidate();},shake(strength){shakeUntil=game.time+.8;shakeStrength=Number(strength)||1;},setCamera(value){cameraMode=value;resize();},setQuality(value){quality=value;resize();}};
}
