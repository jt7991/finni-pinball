// SPDX-License-Identifier: GPL-3.0-or-later
// cvpmImpulseP from Visual Pinball scripts/core.vbs, revision
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.

// This coil is independent of the physical manual rod. Its ball dictionary is
// populated by the configured trigger's generated Hit/UnHit events.
export function createImpulsePlunger({random=()=>Math.fround(Math.random()),sound=()=>{},initTimer=()=>{},createEvents=()=>{}}={}){
  const balls=new Map(),triggers=[];
  const state={x:0,y:0,strength:0,res:1,size:1,solenoid:0,impowerout:0,time:0,mcount:0,pull:0,impowertrans:0,cfactor:0,auto:false,randomout:0,switchnum:0,switchon:0,ballon:0};
  let enabled=false,entrySound,exitSound,exitBallSound,proxy;
  const needUpdate=value=>{if(triggers[0])triggers[0].timerenabled=!!value;};
  const reset=()=>{state.pull=0;state.impowerout=0;state.impowertrans=0;state.mcount=0;};
  const fire=automatic=>{
    const sample=random();
    state.impowerout=automatic||state.auto?-state.strength+sample*state.randomout:-state.strength*(state.impowertrans+(sample-.5)*state.cfactor*state.randomout)/state.res;
    enabled=true;actions.update();enabled=false;reset();
    sound(state.ballon===1?exitBallSound:exitSound);
  };
  const actions={
    initimpulsep(trigger,strength,time){
      triggers.splice(0,triggers.length,...(Array.isArray(trigger)?trigger:[trigger]));
      const first=triggers[0];state.x=first.x;state.y=first.y;state.size=first.radius;
      state.strength=strength;state.res=500;state.time=time;state.auto=time===0;
      if(time!==0)state.cfactor=(state.res/time)/100;
      first.timerinterval=10;first.timerenabled=false;initTimer(first,()=>actions.update());
    },
    createevents(){for(const trigger of triggers)createEvents(trigger,ball=>actions.addball(ball),ball=>actions.removeball(ball));},
    addball(ball){if(balls.has(ball))balls.set(ball,balls.get(ball)+1);else{balls.set(ball,1);needUpdate(true);}state.ballon=1;},
    removeball(ball){if(balls.has(ball)){const count=balls.get(ball)-1;if(count>0)balls.set(ball,count);else balls.delete(ball);}needUpdate(balls.size>0);state.ballon=0;},
    update(){
      if(state.pull===1&&state.mcount<state.res){state.mcount+=state.cfactor;state.impowertrans=state.mcount;needUpdate(true);}
      else{state.impowertrans=state.mcount;needUpdate(false);}
      if(enabled)for(const ball of [...balls.keys()]){
        try{if(ball.x<0)balls.delete(ball);else actions.plungeball(ball);}catch{balls.delete(ball);}
      }
    },
    plungeball(ball){ball.vely=state.impowerout;},
    random(value){state.randomout=value;},
    fire(){fire(false);},autofire(){fire(true);},
    pullback(){reset();state.pull=1;needUpdate(true);sound(entrySound);},
    pullbackandretract(){actions.pullback();},
    initentrysnd(name){entrySound=name;},initexitsnd(ball,empty){exitBallSound=ball;exitSound=empty;},
  };
  proxy=new Proxy(state,{
    get(target,key){if(typeof key==='symbol')return target[key];key=key.toLowerCase();if(key==='balls')return [...balls.keys()];if(key==='plungeon')return enabled;return actions[key]??target[key]??0;},
    set(target,key,value){key=String(key).toLowerCase();if(key==='plungeon')enabled=!!value;else target[key]=value;return true;},
    has(target,key){return typeof key==='string'&&(key.toLowerCase() in target||key.toLowerCase() in actions||['balls','plungeon'].includes(key.toLowerCase()));},
    ownKeys(target){return [...Object.keys(target),...Object.keys(actions),'balls','plungeon'];},
    getOwnPropertyDescriptor(target,key){return {enumerable:true,configurable:true,writable:true,value:proxy[key]};},
  });
  return proxy;
}
