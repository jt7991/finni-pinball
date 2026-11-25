// Reuse main's exact native cache copy, including its far-depth arcade sky.
// Keep the GL method intact so isolated/original-table renderers retain their
// own player settings. Only the current player's cache submissions opt in.
import {installFramebufferCopy} from '../browser/framebuffer-copy.js';
import {backdropStateReader} from './backdrop-state-reader.js';
const copies=new WeakMap();
export function createPlayerBackdropCopy(gl){
 if(!copies.has(gl)){
  const state=backdropStateReader(gl),bound=new Map();let copy;
  // Keep the original shared copy and shaders. Only its scalar state reads use
  // the observed values; every resource lookup still addresses this context.
  const context=new Proxy(gl,{
   get(target,key){
    if(key==='getParameter')return state.getParameter;
    if(key==='isEnabled')return state.isEnabled;
    if(key==='blitFramebuffer'&&copy)return copy;
    const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
    let cached=bound.get(key);if(cached?.source!==value){cached={source:value,call:value.bind(target)};bound.set(key,cached);}return cached.call;
   },
   set(target,key,value){if(key==='blitFramebuffer'){copy=value;return true;}return Reflect.set(target,key,value,target);},
  });
  installFramebufferCopy(context);copies.set(gl,(...args)=>copy.apply(context,args));
 }
 return copies.get(gl);
}
