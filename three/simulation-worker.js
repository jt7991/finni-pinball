import {createSimulationHost} from './simulation-host.js';
const host=createSimulationHost(message=>postMessage(message),{allowDebug:import.meta.env.DEV});
// Init loads assets asynchronously. Keep every subsequent input in message order.
let pending=Promise.resolve();
onmessage=event=>{pending=pending.then(()=>host.receive(event.data));};
