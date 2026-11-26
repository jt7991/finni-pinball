// Isolated original compiled math, with only two exports added. This is not
// a full-table recording; the coupled kicker recording uses unmodified WASM.
import fs from 'node:fs';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {nativeTrig} from './native-trig-compiled-harness.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),oracle=await nativeTrig();
const words=new Uint32Array(1),floats=new Float32Array(words.buffer),bits=x=>{floats[0]=x;return words[0];};
const inputs=new Set([0,0x80000000,1,0x80000001,0x7f7fffff,0xff7fffff]);
for(const boundary of [0x39800000,0x3f490fda,0x4016cbe3,0x407b53d1,0x40afeddf,0x40e231d5,0x4dc90fdb])for(let offset=-3;offset<=3;offset++)for(const sign of [0,0x80000000])inputs.add((boundary+offset+sign)>>>0);
let generator=0x58a74321;
for(let i=0;i<20000;i++){generator=(Math.imul(generator,1664525)+1013904223)>>>0;if((generator&0x7f800000)!==0x7f800000)inputs.add(generator);}
const cases=Array.from(inputs,input=>{words[0]=input;const angle=floats[0];return[input,bits(oracle.sin(angle)),bits(oracle.cos(angle))];});
const fixture={engineSHA256:'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8',functions:oracle.functions,functionSHA256:oracle.hashes,harnessSHA256:sha(fs.readFileSync(new URL('./native-trig-compiled-harness.mjs',import.meta.url))),generatorSHA256:sha(fs.readFileSync(new URL(import.meta.url))),cases};
fs.writeFileSync(process.argv[2],gzipSync(JSON.stringify(fixture),{level:9}),{flag:'wx'});console.log(JSON.stringify({cases:cases.length,sha256:sha(fs.readFileSync(process.argv[2]))}));
