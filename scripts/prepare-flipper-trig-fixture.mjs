import fs from 'node:fs';import assert from 'node:assert/strict';import{gzipSync}from 'node:zlib';import{nativeTrig}from './native-trig-compiled-harness.mjs';
const native=await nativeTrig(),values=new Set([0,-0,2.026184320449829]);
for(let i=-4096;i<=4096;i++)values.add(Math.fround(i*7/4096));
let random=0x73696e66;for(let i=0;i<10000;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;values.add(Math.fround((random/2**32*2-1)*7));}
const view=new DataView(new ArrayBuffer(4));for(const bits of [0x39800000,0x3f490fda,0x4016cbe3,0x407b53d1,0x40afeddf,0x40e231d5])for(let delta=-2;delta<=2;delta++){view.setUint32(0,bits+delta,true);const x=view.getFloat32(0,true);if(bits+delta<=0x40e231d5){values.add(x);values.add(-x);}}
const cases=[...values].map(angle=>[angle,native.sin(angle),native.cos(angle)]),fixture={engineSHA256:'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8',functions:native.functions,functionSHA256:native.hashes,scope:'Independent original compiled sinf/cosf outputs. Standalone module adds exports only; no instructions replaced. Fixed grid, seeded independent input sampling and branch-boundary neighbors within the authored flipper domain.',cases};
assert.equal(cases.find(row=>row[0]===2.026184320449829)[1],0.8980904221534729);
const destination=process.argv[2];assert.ok(destination);assert.equal(fs.existsSync(destination),false,'Preserve previous fixtures');fs.writeFileSync(destination,gzipSync(JSON.stringify(fixture),{level:9}));console.log(JSON.stringify({destination,cases:cases.length}));
