// SPDX-License-Identifier: GPL-3.0-or-later
// Authored string-callback path of core.vbs cvpmTimer, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See VPX-Physics-NOTICE.txt.
import {nativeFlasherLong} from './native-flasher-state.js';
export function createVpmTimer(execute){
 let now=0;const queue=[];
 const addtimer2=(delay,callback,id)=>{if(queue.length===50)return;queue.push({at:now+Math.trunc(nativeFlasherLong(delay)/40),callback,id});};
 return {addtimer:(delay,callback)=>addtimer2(delay,callback,0),addtimer2,
  update(){
   if(!queue.length)return;now++;
   for(let index=0;index<queue.length;){
    const timer=queue[index];if(timer.at>now){index++;continue;}
    if(typeof timer.callback==='function')timer.callback(timer.id);
    else if(String(timer.callback)>'')execute(`${timer.callback} ${timer.id} `);
    queue.splice(index,1);
   }
  },get ticks(){return now;},get pending(){return queue.length;},
 };
}
