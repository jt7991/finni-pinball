// SPDX-License-Identifier: LGPL-2.1-or-later
// libwinevbs Global_Timer, b5503c581b7d0e6f4f1d84d604cf5e9372c940d7.
// See public/licenses/Wine-Script-Random-NOTICE.txt.
export function nativeTimerSeconds(date){return Math.fround(date.getHours()*3600+date.getMinutes()*60+date.getSeconds()+date.getMilliseconds()/1000);}
export function registerNativeTimer(engine,localTime=()=>new Date()){
 // The upstream interpreter labels Timer as Single but leaves its Number at
 // Double precision. Native return_float rounds before CDbl/Randomize sees it.
 engine._getContext().functionRegistry.register('Timer',()=>({type:'Single',value:nativeTimerSeconds(localTime())}),{minArgs:0,maxArgs:0});
}
