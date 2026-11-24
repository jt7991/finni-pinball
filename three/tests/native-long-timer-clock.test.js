import test from'node:test';import assert from'node:assert/strict';import{createRules}from'../rules.js';

// The complete four-player native recording first diverged at336501: the
// source delivers GIUpdateTimer at336500, while accumulated seconds deferred
// it by one interval. HitTimer uses integer millisecond clocks/deadlines.
test('50ms and250ms timers stay on their native deadlines past five minutes',()=>{
 const calls=[],r=createRules('Sub Fast_Timer\nMsgBox "fast"\nEnd Sub\nSub Slow_Timer\nMsgBox "slow"\nEnd Sub',{objects:[{name:'Fast',kind:'Timer',timer_interval:50,is_timer_enabled:true},{name:'Slow',kind:'Timer',timer_interval:250,is_timer_enabled:true}],collections:[]},{message:name=>calls.push([name,r.value('GameTime')])});
 try{for(let ms=1;ms<=336500;ms++)r.tick(.001);assert.equal(r.time,336.5);for(const[name,period]of [['fast',50],['slow',250]]){const times=calls.filter(c=>c[0]===name).map(c=>c[1]);assert.equal(times.length,336500/period);assert.deepEqual(times,Array.from({length:336500/period},(_,i)=>(i+1)*period));}}finally{r.engine.destroy();}
});

test('timer interval changes, disable/re-enable and overdue delivery retain millisecond phase after an hour',()=>{
 const calls=[],r=createRules('Sub Clock_Timer\nMsgBox "tick"\nEnd Sub',{objects:[{name:'Clock',kind:'Timer',timer_interval:50}],collections:[]},{message:()=>calls.push(r.value('GameTime'))});
 try{r.tick(3600,false);r.execute('Clock.Enabled=True');for(let i=0;i<50;i++)r.tick(.001);assert.deepEqual(calls,[3600050]);r.execute('Clock.Interval=250');r.tick(.249);assert.equal(calls.length,1);r.tick(.001);assert.deepEqual(calls,[3600050,3600300]);r.execute('Clock.Enabled=False');r.tick(.01);r.execute('Clock.Enabled=True');r.tick(.249);assert.equal(calls.length,2);r.tick(.001);assert.equal(calls.at(-1),3600560);r.tick(.8,false);assert.equal(calls.length,3);r.tick(.001);assert.equal(calls.at(-1),3601361);assert.equal(r.timers.get('clock').at,3601.56);r.tick(.198);assert.equal(calls.length,4);r.tick(.001);assert.equal(calls.at(-1),3601560);}finally{r.engine.destroy();}
});
