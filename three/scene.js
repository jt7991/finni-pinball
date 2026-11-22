import * as THREE from 'three';
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
import {createNativeBallVisuals} from './native-ball-render.js';
import {loadNativeFlasherVisuals,createNativeFlasherVisuals} from './native-flasher-render.js';
import {compareNativeTransparent} from './native-render-order.js';
import {createNativeBulbEmission} from './native-bulb-emission.js';

export async function createView(canvas,game){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setTransparentSort(compareNativeTransparent);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),base=import.meta.env.BASE_URL;
 const [lighting,flipperAssets,cameraBounds,tableAssets,animationAssets,transmissionAssets,ballAssets,flasherAssets]=await Promise.all([
  loadNativeLighting(base),loadFlipperVisuals(base,renderer.capabilities.getMaxAnisotropy()),
  fetch(base+'camera-bounds.json').then(response=>{if(!response.ok)throw Error('Native camera bounds unavailable');return response.json();}),
  loadNativePrimitiveVisuals(base+'native-table/','native-table.json'),loadNativeMechanismAnimation(base),loadNativeTransmission(base+'native-transmission/'),
  loadNativePrimitiveVisuals(base+'native-ball/','native-ball.json'),
  loadNativeFlasherVisuals(base+'native-flashers/'),
 ]);
 const floorRecord=tableAssets.metadata.parts.find(p=>p.spec.name==='playfield_mesh');if(!floorRecord?.probe)throw Error('Authored playfield probe unavailable');
 const reflectionPass=createNativeReflectionPass(renderer,floorRecord.probe),nativeTransmission=createNativeTransmission(renderer,transmissionAssets,name=>game.rules.objects.get(name.toLowerCase()));
 const nativeTable=createNativePrimitiveVisuals(renderer,scene,tableAssets,lighting,{stateFor:name=>game.rules.objects.get(name.toLowerCase()),transmissionTexture:nativeTransmission.texture,reflectionTexture:reflectionPass.texture});nativeTable.root.name='NativeTable';
 const nativeMechanisms=createNativeMechanismAnimation(game,nativeTable,animationAssets),nativeCache=createNativeOpaqueCache(renderer,nativeTable),floorPart=nativeTable.parts.find(p=>p.spec.name==='playfield_mesh'),floor=floorPart.material.uniforms.tex_base_color.value;
 const actorNames=new Set(['discoball','LilHead','LilLeftArm','LilRightArm','Primitive077']),nativeActors={parts:nativeTable.parts.filter(p=>actorNames.has(p.spec.name)),root:nativeTable.root};
 const flipperVisuals=createFlipperVisuals(game,scene,lighting,flipperAssets),classicLights=createClassicLights(game,scene,floor,lighting),bulbHalos=createBulbHalos(game,scene),lightFrame=createLightFrame(renderer);
 const nativeBalls=createNativeBallVisuals(renderer,scene,ballAssets,lighting,{previousFrame:lightFrame.previous.texture,stateFor:name=>game.rules.objects.get(name.toLowerCase())});
 const nativeFlashers=createNativeFlasherVisuals(renderer,scene,flasherAssets,{stateFor:name=>game.rules.objects.get(name.toLowerCase())});
 const nativeBulbEmission=createNativeBulbEmission(scene,nativeTable,transmissionAssets.programs.bulb,name=>game.rules.objects.get(name.toLowerCase()));
 const ballStates=()=>((game.renderBalls??[]).map(ball=>{const c=ball.color>>>0,f=Math.fround;return{...ball,color:[f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),1],reflectionEnabled:ball.reflectionenabled,forceReflection:ball.forcereflection,bulbScale:ball.bulbintensityscale,reflectionStrength:ball.playfieldreflectionscale};}));
 let cameraMode='balanced',quality='performance',cacheEnabled=true,shakeUntil=0,shakeStrength=0;
 function resizeTargets(){const size=renderer.getDrawingBufferSize(new THREE.Vector2());lightFrame.resize();reflectionPass.resize(size.x,size.y);nativeTransmission.resize(size.x,size.y);nativeCache.invalidate();}
 function resize(){const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height){if(!camera.userData.nativeCamera)applyNativeCamera(camera,cameraBounds,Math.max(1,canvas.width)/Math.max(1,canvas.height),cameraMode);resizeTargets();return;}renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='detailed'?2:1.25));renderer.setSize(width,height,false);resizeTargets();const size=renderer.getDrawingBufferSize(new THREE.Vector2());applyNativeCamera(camera,cameraBounds,size.x/size.y,cameraMode);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();nativeMechanisms.update();nativeTable.update(camera);nativeTransmission.update(camera);flipperVisuals.update(camera);nativeBalls.update(camera,ballStates());nativeFlashers.update(camera);nativeBulbEmission.update(camera);await nativeTable.prepare(camera);await nativeTransmission.prepare();await nativeFlashers.prepare(camera);await renderer.compileAsync(scene,camera);
 function render(alpha,previous){
  const balls=ballStates();
  nativeMechanisms.update();nativeTransmission.update(camera);nativeTransmission.render();
  const hidden=[...classicLights.meshes,bulbHalos.mesh,nativeFlashers.root].map(mesh=>[mesh,mesh.visible]);for(const [mesh]of hidden)mesh.visible=false;
  try{reflectionPass.render(camera,(view,target)=>{nativeTable.update(view);flipperVisuals.update(view);nativeBalls.update(view,balls);nativeBulbEmission.update(view);nativeCache.render(scene,view,target,{enabled:cacheEnabled});},{area:nativeProbeArea(floorRecord.bounds,nativePrimitiveWorld(floorRecord.spec),camera.userData.nativeCamera)});}finally{for(const [mesh,value]of hidden)mesh.visible=value;}
  nativeTable.update(camera);flipperVisuals.update(camera);nativeBalls.update(camera,balls);nativeFlashers.update(camera);nativeBulbEmission.update(camera);classicLights.update(camera);bulbHalos.update();lightFrame.render(scene,camera,target=>nativeCache.render(scene,camera,target,{enabled:cacheEnabled}));
 }
 return{renderer,scene,camera,cameraBounds,nativeTable,nativeMechanisms,nativeCache,nativeTransmission,nativeBalls,nativeFlashers,nativeBulbEmission,reflectionPass,nativeActors,classicLights,bulbHalos,flipperVisuals,lightFrame:{...lightFrame,resize:resizeTargets},render,resize,resizeTargets,setCacheEnabled(value){cacheEnabled=!!value;nativeCache.invalidate();},shake(strength){shakeUntil=game.time+.8;shakeStrength=Number(strength)||1;},setCamera(value){cameraMode=value;resize();},setQuality(value){quality=value;resize();}};
}
