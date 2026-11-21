// Node-only test bootstrap. Deterministic measurement overrides never enter
// the production worker or the player's physics/randomness configuration.
import {parentPort} from 'node:worker_threads';
import {createSimulationHost} from '../../simulation-host.js';
import {nativeRandom} from '../../native-random.js';
const host=createSimulationHost(message=>parentPort.postMessage(message),{allowDebug:true});
let pending=Promise.resolve();
parentPort.on('message',message=>{pending=pending.then(async()=>{
  if(message.type==='debug'&&message.action==='test-prepare'){
    const game=host.game;game.random=nativeRandom(12345,67890);
    game.rules.scriptRandom.rnd(-1);game.rules.scriptRandom.randomize(123.5);
    game.rules.engine._registerFunction('Timer',()=>({type:'Single',value:123.5}));
    game.rules.execute('Song=""');
    await host.receive({type:'barrier',id:message.id});
  }else if(message.type==='debug'&&message.action==='test-drain'){
    host.game.rules.execute('bBallSaverActive=False:bBallSaverReady=False');
    for(const rec of [...host.game.records])host.game.rules.hit('Drain','Hit',rec.proxy);
    await host.receive({type:'barrier',id:message.id});
  }else await host.receive(message);
});});
