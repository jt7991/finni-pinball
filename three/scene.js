import * as THREE from 'three';
import {createLightFrame} from './bulb-render.js';
import {loadNativeLighting} from './classic-render.js';
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
import {loadNativeHalos,createNativeHalos} from './native-halo-render.js';
import {loadNativeClassic,createNativeClassic} from './native-classic-render.js';
import {loadNativePostprocess} from './native-postprocess.js';
import {createBallPresentationClock} from './ball-presentation.js';
import {nativeColor} from './light-animation.js';
import {loadNativeStatic,createNativeStaticRender} from './native-static-render.js';
import {nativeGraphicsProfile} from './graphics-profile.js';
import {createPlayerBackdropCopy} from './player-backdrop.js';

export async function createView(canvas,game,{quality='performance'}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const playerBackdropCopy=createPlayerBackdropCopy(renderer.getContext());let backdropEnabled=true;
 renderer.setTransparentSort(compareNativeTransparent);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),base=import.meta.env.BASE_URL;
 const [lighting,flipperAssets,cameraBounds,tableAssets,animationAssets,transmissionAssets,ballAssets,flasherAssets,haloAssets,classicAssets,postprocessAssets,staticAssets]=await Promise.all([
  loadNativeLighting(base),loadFlipperVisuals(base,renderer.capabilities.getMaxAnisotropy()),
  fetch(base+'camera-bounds.json').then(response=>{if(!response.ok)throw Error('Native camera bounds unavailable');return response.json();}),
  loadNativePrimitiveVisuals(base+'native-table/','native-table.json',{textureProfile:quality,baseColorOnly:true}),loadNativeMechanismAnimation(base),loadNativeTransmission(base+'native-transmission/'),
  loadNativePrimitiveVisuals(base+'native-ball/','native-ball.json'),
  loadNativeFlasherVisuals(base+'native-flashers/'),
  loadNativeHalos(base+'native-halos/'),
  loadNativeClassic(base+'native-classic/'),
  loadNativePostprocess(base+'native-postprocess/'),
  loadNativeStatic(base+'native-static/'),
 ]);
 // DrawBackground clears HDR with normalized authored bytes, without an
 // sRGB conversion. Reflection and transmission passes select their own black.
 const backdrop=nativeColor(lighting.metadata.backdropColor),f=Math.fround;
 renderer.setClearColor(new THREE.Color(f((backdrop&255)/255),f(((backdrop>>>8)&255)/255),f(((backdrop>>>16)&255)/255)),1);
 const floorRecord=tableAssets.metadata.parts.find(p=>p.spec.name==='playfield_mesh');if(!floorRecord?.probe)throw Error('Authored playfield probe unavailable');
 const reflectionPass=createNativeReflectionPass(renderer,floorRecord.probe),nativeTransmission=createNativeTransmission(renderer,transmissionAssets,name=>game.rules.objects.get(name.toLowerCase()));
 const nativeTable=createNativePrimitiveVisuals(renderer,scene,tableAssets,lighting,{stateFor:name=>game.rules.objects.get(name.toLowerCase()),transmissionTexture:nativeTransmission.texture,reflectionTexture:reflectionPass.texture});nativeTable.root.name='NativeTable';
 const nativeMechanisms=createNativeMechanismAnimation(game,nativeTable,animationAssets);
 const nativeStatic=createNativeStaticRender(renderer,nativeTable,tableAssets,staticAssets);
 const actorNames=new Set(['discoball','LilHead','LilLeftArm','LilRightArm','Primitive077']),nativeActors={parts:nativeTable.parts.filter(p=>actorNames.has(p.spec.name)),root:nativeTable.root};
 // The balloon primitive is submitted after the animated bumper skirts and
 // can share their D16 depth. Keep that ordering when composing the cache.
 const nativeCache=createNativeOpaqueCache(renderer,nativeTable,{liveParts:[...nativeActors.parts,...nativeTable.parts.filter(part=>part.spec.name==='FinniBalloons')]});
 const flipperVisuals=createFlipperVisuals(game,scene,lighting,flipperAssets,{program:tableAssets.programs['2'],renderer}),classicLights=createNativeClassic(renderer,scene,classicAssets,lighting,nativeTable,name=>game.rules.objects.get(name.toLowerCase())),bulbHalos=createNativeHalos(scene,haloAssets,name=>game.rules.objects.get(name.toLowerCase())),lightFrame=createLightFrame(renderer,postprocessAssets,nativeTransmission.targets);
 const ballClock=createBallPresentationClock(()=>({paused:game.presentationPaused??(game.simulationPaused!==false),clock:game.submission?.presentationClock??game.presentationClock}));
 const nativeBalls=createNativeBallVisuals(renderer,scene,ballAssets,lighting,{previousFrame:lightFrame.previous.texture,submissionClock:ballClock,submissionBodyFor:ball=>{if(!game.submission)return ball;const body=game.submission.bodies.get(ball.id);if(!body)throw Error('Prepared ball is missing from submission');return body;},stateFor:name=>game.rules.objects.get(name.toLowerCase())});
 const nativeFlashers=createNativeFlasherVisuals(renderer,scene,flasherAssets,{stateFor:name=>game.rules.objects.get(name.toLowerCase())});
 const nativeBulbEmission=createNativeBulbEmission(scene,nativeTable,transmissionAssets.programs.bulb,name=>game.rules.objects.get(name.toLowerCase()));
 const ballStates=()=>((game.renderBalls??[]).map(ball=>{const c=ball.color>>>0,f=Math.fround;return{...ball,color:[f((c&255)*f(1/255)),f((c&65280)*f(1/65280)),f((c&16711680)*f(1/16711680)),1],reflectionEnabled:ball.reflectionenabled,forceReflection:ball.forcereflection,bulbScale:ball.bulbintensityscale,reflectionStrength:ball.playfieldreflectionscale};}));
 let cameraMode='balanced',cacheEnabled=true,staticEnabled=true,staticMainDirty=true,staticReflectionDirty=true,staticCamera,shakeUntil=0,shakeStrength=0,graphicsProfile;
 function resizeTargets(){const size=renderer.getDrawingBufferSize(new THREE.Vector2());nativeTransmission.resize(size.x,size.y);lightFrame.resize();reflectionPass.resize(graphicsProfile?.reflections?size.x:1,graphicsProfile?.reflections?size.y:1);nativeCache.invalidate();staticMainDirty=staticReflectionDirty=true;}
 function resize(){const rect=canvas.getBoundingClientRect(),width=Math.floor(rect.width),height=Math.floor(rect.height);graphicsProfile=nativeGraphicsProfile(quality,width,devicePixelRatio);nativeTable.setReflectionsEnabled(graphicsProfile.reflections);nativeStatic.setReflectionsEnabled(graphicsProfile.reflections);lightFrame.postprocess.setProfile(graphicsProfile);if(!width||!height){if(!camera.userData.nativeCamera)applyNativeCamera(camera,cameraBounds,Math.max(1,canvas.width)/Math.max(1,canvas.height),cameraMode);resizeTargets();return;}renderer.setPixelRatio(graphicsProfile.density);renderer.setSize(width,height,false);resizeTargets();const size=renderer.getDrawingBufferSize(new THREE.Vector2());applyNativeCamera(camera,cameraBounds,size.x/size.y,cameraMode);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();nativeMechanisms.update();nativeTable.update(camera);nativeTransmission.update(camera);flipperVisuals.update(camera);nativeBalls.update(camera,ballStates());nativeFlashers.update(camera);nativeBulbEmission.update(camera);bulbHalos.update(camera,ballStates());classicLights.update(camera);await nativeTable.prepare(camera);await nativeTransmission.prepare();await nativeFlashers.prepare(camera);await bulbHalos.prepare(renderer,camera);await classicLights.prepare(camera);await lightFrame.prepare();const initialSize=renderer.getDrawingBufferSize(new THREE.Vector2());await nativeStatic.prepare(cameraBounds,initialSize.x,initialSize.y,cameraMode);await renderer.compileAsync(scene,camera);
 function render(alpha,previous){
  const balls=ballStates();nativeBalls.beginSubmission(balls,{reflections:graphicsProfile.reflections});
  try{
  nativeMechanisms.update();nativeTransmission.update(camera);
  if(staticEnabled&&staticCamera!==camera.userData.nativeCamera){staticMainDirty=staticReflectionDirty=true;staticCamera=camera.userData.nativeCamera;}
  if(staticEnabled&&staticMainDirty){nativeTable.update(camera);const size=renderer.getDrawingBufferSize(new THREE.Vector2());nativeStatic.build('main',cameraBounds,size.x,size.y,staticCamera.preset);staticMainDirty=false;}
  const hidden=[...classicLights.meshes,bulbHalos.mesh,nativeFlashers.root].map(mesh=>[mesh,mesh.visible]);for(const [mesh]of hidden)mesh.visible=false;
  try{if(graphicsProfile.reflections)reflectionPass.render(camera,(view,target)=>{nativeTable.update(view,undefined,{skipParts:staticEnabled&&!staticReflectionDirty?nativeStatic.skipParts:undefined});flipperVisuals.update(view);nativeBalls.update(view,balls);nativeBulbEmission.update(view);if(staticEnabled){if(staticReflectionDirty){nativeStatic.build('reflection',cameraBounds,target.width,target.height,staticCamera.preset);staticReflectionDirty=false;}nativeStatic.renderDynamics(scene,view,target,'reflection',{copyFramebuffer:backdropEnabled?playerBackdropCopy:undefined});}else nativeCache.render(scene,view,target,{enabled:cacheEnabled,copyFramebuffer:backdropEnabled?playerBackdropCopy:undefined});},{area:nativeProbeArea(floorRecord.bounds,nativePrimitiveWorld(floorRecord.spec),camera.userData.nativeCamera)});}finally{for(const [mesh,value]of hidden)mesh.visible=value;}
  nativeTransmission.render();
  nativeTable.update(camera,undefined,{skipParts:staticEnabled?nativeStatic.skipParts:undefined});flipperVisuals.update(camera);nativeBalls.update(camera,balls);nativeFlashers.update(camera);nativeBulbEmission.update(camera);classicLights.update(camera);bulbHalos.update(camera,balls);lightFrame.render(scene,camera,target=>staticEnabled?nativeStatic.renderDynamics(scene,camera,target,'main',{copyFramebuffer:backdropEnabled?playerBackdropCopy:undefined}):nativeCache.render(scene,camera,target,{enabled:cacheEnabled,copyFramebuffer:backdropEnabled?playerBackdropCopy:undefined}),game.cabinetOffset);
  }finally{nativeBalls.endSubmission();}
 }
 return{renderer,scene,camera,cameraBounds,nativeTable,nativeMechanisms,nativeCache,nativeStatic,nativeTransmission,nativeBalls,nativeFlashers,nativeBulbEmission,reflectionPass,nativeActors,classicLights,bulbHalos,flipperVisuals,lightFrame:{...lightFrame,resize:resizeTargets},get graphicsProfile(){return graphicsProfile;},render,resize,resizeTargets,setPlayerBackdropEnabled(value){backdropEnabled=!!value;},setStaticPrerenderEnabled(value){staticEnabled=!!value;staticMainDirty=staticReflectionDirty=true;},setCacheEnabled(value){cacheEnabled=!!value;nativeCache.invalidate();},shake(strength){shakeUntil=game.time+.8;shakeStrength=Number(strength)||1;},setCamera(value){cameraMode=value;resize();},setQuality(value){quality=value;resize();}};
}
