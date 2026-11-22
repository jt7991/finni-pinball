// SPDX-License-Identifier: GPL-3.0-or-later
// RenderDevice::DrawMesh / RenderPass::SortCommands legacy alpha ordering.
// Native depth is bias-z (main), bias+z (reflection), descending; equal
// depths preserve source part submission order, then that part's draw order.
const f=Math.fround;
export function nativeTransparentOrder(height,bias,sourceOrder,slot=0,reflection=false){return[-f(f(bias)+(reflection?f(height):-f(height))),sourceOrder??0,slot];}
export function compareNativeTransparent(a,b){
 const group=a.groupOrder-b.groupOrder;if(group)return group;const left=a.object.userData.nativeTransparentOrder,right=b.object.userData.nativeTransparentOrder;
 if(left&&right)return left[0]-right[0]||left[1]-right[1]||left[2]-right[2]||a.id-b.id;
 return a.renderOrder-b.renderOrder||b.z-a.z||a.id-b.id;
}
