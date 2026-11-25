// SPDX-License-Identifier: GPL-3.0-or-later
// RenderDevice::DrawMesh / RenderPass::SortCommands legacy alpha ordering.
// Native depth is bias-z (main), bias+z (reflection), descending; equal
// depths preserve source part submission order, then that part's draw order.
const f=Math.fround;
export function nativeBasicTransparentPass(record,dynamicWall=false){
 // VPX keeps near-opaque depth masks in its alpha command queue even when
 // Shader::SetMaterial disables GL blending for their opaque image. The
 // material alpha still carries the enabled opacity flag in these records.
 return !!(record.renderState.blend||dynamicWall||record.uniforms.cBase_Alpha?.[3]<1&&(record.spec.kind==='Ramp'||record.spec.kind==='Primitive'&&!record.spec.static_rendering));
}
export function nativeBasicTransparentHeight(spec){
 if(spec.kind==='Ramp')return f(f(f(spec.height_bottom)+f(spec.height_top))*f(.5));
 if(spec.kind==='Wall')return spec.height_top;
 if(spec.kind==='Light')return f(f(spec.surface_height??0)+f(spec.height));
 return spec.position?.z??0;
}
export function nativeTransparentOrder(height,bias,sourceOrder,slot=0,reflection=false){return[-f(f(bias)+(reflection?f(height):-f(height))),sourceOrder??0,slot];}
export function compareNativeTransparent(a,b){
 const group=a.groupOrder-b.groupOrder;if(group)return group;const left=a.object.userData.nativeTransparentOrder,right=b.object.userData.nativeTransparentOrder;
 if(left&&right)return left[0]-right[0]||left[1]-right[1]||left[2]-right[2]||a.id-b.id;
 return a.renderOrder-b.renderOrder||b.z-a.z||a.id-b.id;
}
