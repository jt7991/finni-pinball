// Independent scratch calls to the unchanged original compiled HitFlipper.
import fs from 'node:fs';import assert from 'node:assert/strict';import{gzipSync}from 'node:zlib';
import{nativeFlipperHitOracle}from './native-flipper-hit-compiled-harness.mjs';
const [inputFile,outputFile]=process.argv.slice(2);assert.ok(inputFile&&outputFile);assert.equal(fs.existsSync(outputFile),false,'Preserve native evidence');
const scenario=JSON.parse(fs.readFileSync(inputFile)),oracle=await nativeFlipperHitOracle(),cases=[];
for(const input of scenario.cases)cases.push({input,expected:oracle.hit(input)});
fs.writeFileSync(outputFile,gzipSync(Buffer.from(JSON.stringify({engineSHA256:oracle.engineSHA256,functions:oracle.functions,functionSHA256:oracle.functionSHA256,scope:'Isolated original compiled HitFlipper HitTest on declared scratch inputs, with all original instructions retained. Native outputs are expectations only; this does not certify complete gameplay.',cases})),{level:9}));
console.log(JSON.stringify({outputFile,cases:cases.length,contacts:cases.filter(c=>c.expected?.contact).length,hits:cases.filter(c=>c.expected).length,functionSHA256:oracle.functionSHA256}));
