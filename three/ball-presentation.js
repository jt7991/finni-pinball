// SPDX-License-Identifier: GPL-3.0-or-later
// Ball::Render submission callback / RenderDevice::GetPredictedDisplayDelay,
// VPX195f214dd4849b8ef6113fd377258b78d0dec3bf. See VPX-Physics-NOTICE.txt.
import {nativeMultiply,nativeTranslate} from './native-matrix.js';import {nativeShaderArray} from './native-shader-state.js';
const f=Math.fround,u64=value=>BigInt.asUintN(64,BigInt(value));
// Source WebGL fallback: no native vblank device, adaptive sync; Window's
//60Hz fallback; no prerender queue or native submit profiler. The reference
// timestamp starts at zero. No captured phase or per-frame state is used.
export const NATIVE_WEBGL_PRESENTATION=Object.freeze({syncMode:2,targetRefreshRate:60,displayRefreshRate:60,presentReferenceUsec:0n,renderSubmitAverageUsec:0,maxPrerenderedFrames:1});
export function nativePredictedDisplayDelay(nowUsec,settings=NATIVE_WEBGL_PRESENTATION){
 const {syncMode,targetRefreshRate,displayRefreshRate,presentReferenceUsec=0n,renderSubmitAverageUsec=0,maxPrerenderedFrames=1}=settings,rate=syncMode===3?f(displayRefreshRate):syncMode===1||syncMode===2?Math.min(f(targetRefreshRate),f(displayRefreshRate)):f(targetRefreshRate);
 if(syncMode===0&&rate>=10000)return 0;
 const period=BigInt(Math.trunc(1000000/rate));if(period===0n)return 0;let delay=period-u64(u64(nowUsec)-u64(presentReferenceUsec))%period;
 if(Number(delay)<renderSubmitAverageUsec)delay+=period;
 if(syncMode!==3&&maxPrerenderedFrames>1)delay+=BigInt(maxPrerenderedFrames-1)*BigInt(Math.trunc(1000000/f(displayRefreshRate)));
 return f(Number(delay)*.000001);
}
export function nativeBallSubmission(rotScale,ball,{playing=false,nowUsec=0n,predictionNowUsec=nowUsec,lastPhysicsUsec=0n,presentation=NATIVE_WEBGL_PRESENTATION}={}){
 let delay=0;if(playing){const age=f(Number(u64(u64(nowUsec)-u64(lastPhysicsUsec)))*.000001),prediction=nativePredictedDisplayDelay(predictionNowUsec,presentation);delay=f(f(prediction+age)+f(.001));}
 const velocity=ball.velocity??{x:0,y:0,z:0},position={};for(const axis of ['x','y','z'])position[axis]=playing?f(f(ball.position[axis])+f(delay*f(velocity[axis]))):f(ball.position[axis]);if(ball.locked)position.z=f(position.z-f(ball.radius));
 return{delay,position,orientation:nativeShaderArray(nativeMultiply(rotScale,nativeTranslate(position.x,position.y,position.z)))};
}
// Pinned SDL falls back to gettimeofday: integer Date milliseconds and a
//1MHz counter. Retain usec's unsigned multiply/divide order as well.
export function nativeWebGLUsec(milliseconds,epochMilliseconds){return u64(u64((BigInt(milliseconds)-BigInt(epochMilliseconds))*1000n)*1000000n)/1000000n;}
export function createBallPresentationClock(stateFor,wallNow=()=>Date.now()){
 return()=>{const {paused,clock}=stateFor();if(paused||!clock)return{playing:false};const now=wallNow(),predictedNow=wallNow();return{playing:true,nowUsec:nativeWebGLUsec(now,clock.epochMilliseconds),predictionNowUsec:nativeWebGLUsec(predictedNow,clock.epochMilliseconds),lastPhysicsUsec:nativeWebGLUsec(clock.lastPhysicsMilliseconds,clock.epochMilliseconds),presentation:NATIVE_WEBGL_PRESENTATION};};
}
