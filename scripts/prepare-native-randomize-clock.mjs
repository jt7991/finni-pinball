// Preserve the original compiled Randomize body as an independent clock oracle.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(bytes),'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fs.existsSync(output),false);
const imports=WebAssembly.Module.imports(new WebAssembly.Module(bytes)).filter(x=>x.kind==='function').length;let at=8,body,timer;
const uint=()=>{let n=0,s=0,b;do{b=bytes[at++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
while(at<bytes.length){const kind=bytes[at++],size=uint(),end=at+size;if(kind===10){for(let count=uint(),i=0;i<count;i++){const size=uint();if(i+imports===18195)body=bytes.subarray(at,at+size);if(i+imports===18219)timer=bytes.subarray(at,at+size);at+=size;}break;}at=end;}
assert.equal(sha(body),'4265a23e45c59614df69c185f35e0ed0498284567f8986767a7d533796639045');
assert.equal(sha(timer),'897063c619a33bc0e076c6d3219c4bf1645dd56b4b9222a2066b366eea83caf5');
fs.writeFileSync(output,JSON.stringify({engineSHA256:sha(bytes),functionIndex:18195,sha256:sha(body),base64:body.toString('base64'),imports:{variantChangeType:18066,clockGettime:18703},timer:{functionIndex:18219,sha256:sha(timer),base64:timer.toString('base64')},scope:'Original Global_Randomize compiled body. The omitted-argument branch reads CLOCK_REALTIME seconds and nanoseconds, forms epoch milliseconds as a DWORD, then scales by 0.001. In isolated conformance tests only its two call indices are relocated; live native instructions and clocks are never replaced. The original Global_Timer callback body independently pins the read-only external-clock observer.'},null,2)+'\n');
