// Same explicit profiles as browser/renderer.js on main. SDL truncates CSS
// window dimensions before applying pixel density; preserve that viewport.
export function nativeGraphicsProfile(quality,width,pixelRatio=1,viewport){
 const performance=quality==='performance';
 let density=pixelRatio||1;
 if(viewport){
  if(performance||quality==='reduced'){
   const [maxDensity,maxPixels]=viewport.mobile
    ?performance?[1,360000]:[1.25,480000]
    :performance?[1.25,750000]:[1.5,1050000];
   density=Math.min(density*(performance ? .75 : .85),maxDensity,Math.sqrt(maxPixels/Math.max(1,width*viewport.height)));
  }
 }else if(performance){
  // Historical native recordings specify the preceding width-only policy.
  // Current player calls always supply both viewport dimensions below.
  density=Math.min(density,1.5,720/Math.max(1,width));
 }
 return{ambientOcclusion:!performance,bloom:!performance,reflections:!performance,density,maxTextureDimension:performance?2048:0};
}
