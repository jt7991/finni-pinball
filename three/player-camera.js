// Main browser/views.js portrait framing, revision d259c2b. Keep the physical
// table untouched: the hidden portrait plunger is only a rendering preference.
import {nativeCameraPresets} from './native-camera.js';
export function playerCameraLayout(name,{width,height,phone,portrait,tallPortrait}){
  const [inclination,fov,layback,y,z,scale]=nativeCameraPresets[name]??nativeCameraPresets.classic;
  const aspect=width/Math.max(1,height),perspective=phone&&tallPortrait&&inclination>0;
  const lift=Math.round(Math.max(70,130-900*Math.max(0,aspect-.525)));
  const cameraScale=perspective&&name==='balanced'
    ?Math.round(1000*Math.max(.84,1.045-1.1*Math.max(0,aspect-.5)))/1000:scale;
  return{preset:[inclination,fov,layback,perspective?y-lift:y,z,cameraScale],plungerVisible:!(phone&&portrait)};
}
