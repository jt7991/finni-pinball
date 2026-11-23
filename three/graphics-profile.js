// Same explicit profiles as browser/renderer.js on main. SDL truncates CSS
// window dimensions before applying pixel density; preserve that viewport.
export function nativeGraphicsProfile(quality,width,pixelRatio=1){
 const performance=quality==='performance';
 return{ambientOcclusion:!performance,bloom:!performance,reflections:!performance,density:performance?Math.min(pixelRatio||1,1.5,720/Math.max(1,width)):pixelRatio||1,maxTextureDimension:performance?2048:0};
}
