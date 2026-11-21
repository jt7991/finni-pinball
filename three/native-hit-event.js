// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball contributors' collide.cpp/collideex.cpp and SetupHitObject
// behavior, revision 195f214dd4849b8ef6113fd377258b78d0dec3bf.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {f,dot,nativeNormal} from './native-vector.js';
import {collideNativeSurface} from './native-ball-response.js';

export function nativeHitDescriptor(spec){
  if(!['Wall','Primitive','Rubber','Ramp'].includes(spec.kind))return null;
  return {name:spec.name,primitive:spec.kind!=='Wall',fireEvents:!!spec.hit_event,threshold:f(spec.kind==='Rubber'?2:spec.threshold??0),currentHitThreshold:0};
}

export function collideNativeHitSurface(body,hit,shape,event,material,radius,random,emit){
  const restricted=shape.kind==='triangle'||shape.kind==='polygon'||shape.kind==='edge'&&!shape.vertical;
  const direct=shape.kind==='wall'||shape.kind==='point'||shape.kind==='edge'&&shape.vertical;
  const eligible=event.fireEvents&&(direct||restricted&&event.primitive),native=body.native;
  let incoming=0;
  if(eligible){const velocity=body.linvel();incoming=-dot({x:velocity.x,y:-velocity.y,z:velocity.z},nativeNormal(hit.normal));}
  collideNativeSurface(body,hit,material,radius,random);
  // Surface's polygon/3D edges have eNull, so their collision handlers do not
  // fire even when SetupHitObject set m_fe. Primitive/rubber/ramp use ePrimitive.
  if(!eligible||!(incoming>=event.threshold))return false;
  if(restricted)event.currentHitThreshold=incoming;
  if(event.collider&&!event.collider.isEnabled()||!native.acceptHitEvent())return false;
  emit();return true;
}
