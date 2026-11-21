// Compare actual authored timer execution with the pinned interpreter's direct
// Sub API. Keep the timeout reset and locale/error wrapper in both paths.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createRules} from '../three/rules.js';
const source=fs.readFileSync('three/public/rules.vbs','utf8')+'\nSub HostDispatchEmpty\nEnd Sub\n',specs=JSON.parse(fs.readFileSync('three/public/objects.json'));
const rules=createRules(source,specs);rules.init();
const statement=name=>rules.engine.executeStatementThrows(name+' '),direct=name=>{
  rules.engine.interpreter.startTime=Date.now();rules.engine.run(name);
  if(rules.engine.error)throw Error(JSON.stringify(rules.engine.error));
};
const results=[],iterations=10000,measure=(fn,name)=>{const start=performance.now();for(let i=0;i<iterations;i++)fn(name);return performance.now()-start;};
for(const name of ['HostDispatchEmpty','LeftFlipper_Timer']){
  for(let i=0;i<3000;i++){statement(name);direct(name);}
  for(let round=0;round<5;round++){
    let baselineMs,candidateMs;
    if(round%2){candidateMs=measure(direct,name);baselineMs=measure(statement,name);}else{baselineMs=measure(statement,name);candidateMs=measure(direct,name);}
    assert.equal(rules.engine.error,null);
    const result={name,round,iterations,baselineMs,candidateMs,speedup:baselineMs/candidateMs};results.push(result);console.log(JSON.stringify(result));
  }
}
fs.writeFileSync('.work/three-review/rules-dispatch-benchmark.json',JSON.stringify(results,null,2));
