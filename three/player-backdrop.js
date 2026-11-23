// Reuse main's exact native cache copy, including its far-depth arcade sky.
// Keep the GL method intact so isolated/original-table renderers retain their
// own player settings. Only the current player's cache submissions opt in.
import {installFramebufferCopy} from '../browser/framebuffer-copy.js';
const copies=new WeakMap();
export function createPlayerBackdropCopy(gl){
 if(!copies.has(gl)){const original=gl.blitFramebuffer;let copy;try{installFramebufferCopy(gl);copy=gl.blitFramebuffer;}finally{gl.blitFramebuffer=original;}copies.set(gl,(...args)=>copy.apply(gl,args));}
 return copies.get(gl);
}
