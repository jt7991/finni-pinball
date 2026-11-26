// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball Kicker::KickXYZ, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf, parts/kicker.cpp.
// See public/licenses/VPX-Physics-NOTICE.txt. Native VPU/VPT throughout.
import {nativeAngleSin,nativeAngleCos} from './native-angle-math.js';
const f=Math.fround,radians=f(Math.PI/180);
export function ejectNativeBall(ball,{angle,speed,inclination=0,x=0,y=0,z=0,scatter=0,difficulty=.5,hardScatter=0},random){
  let yaw=f(f(angle)*radians),elevation=f(inclination),horizontal=f(speed);
  if(Math.abs(elevation)>f(Math.PI/2))elevation=f(elevation*radians);
  // collide.cpp initializes c_hardScatter to zero. Player changes it only
  // for an active physics override; this table has no such override.
  const spread=f((scatter<0?f(hardScatter):f(f(scatter)*radians))*f(difficulty));
  if(spread>f(1e-5)){
    let deviation=random.signed();
    deviation=f(deviation*f(f(f(1-f(deviation*deviation))*f(2.59808))*spread));
    yaw=f(yaw+deviation);
  }
  const vertical=f(nativeAngleSin(elevation)*horizontal);
  if(vertical>0)horizontal=f(horizontal*nativeAngleCos(elevation));
  return {...ball,p:{x:f(ball.p.x+f(x)),y:f(ball.p.y+f(y)),z:f(ball.p.z+f(z))},
    v:{x:f(nativeAngleSin(yaw)*horizontal),y:f(-nativeAngleCos(yaw)*horizontal),z:vertical},m:{x:0,y:0,z:0}};
}
