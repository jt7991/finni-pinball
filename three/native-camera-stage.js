// SPDX-License-Identifier: GPL-3.0-or-later
// Renderer::RenderFrame caches the entry playfield view. InitLayout can then
// change the current camera while rebuilding the static prepass. The first
// RenderProbe::SetReflection restores that entry view through SetSpaceReference;
// later source objects use it with the new projection until the next frame.
// Source order, rather than GPU sorting order, determines the affected objects.
export function stageNativeCamera(current,entry,firstProbeOrder){
 if(!entry||!Number.isFinite(firstProbeOrder)||current.view.every((value,i)=>value===entry.view[i]))return current;
 return{...current,afterProbe:{sourceOrder:firstProbeOrder,camera:{...current,view:entry.view}}};
}
export function nativeCameraForPart(camera,spec){
 return camera.afterProbe&&spec.native_source_order>=camera.afterProbe.sourceOrder?camera.afterProbe.camera:camera;
}
export const nativeCameraAfterProbe=camera=>camera.afterProbe?.camera??camera;
