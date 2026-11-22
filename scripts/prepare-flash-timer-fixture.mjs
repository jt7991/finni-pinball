import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),capture=JSON.parse(bytes);assert.deepEqual(capture.errors,[]);assert.equal(capture.cases.length,11);assert.equal(capture.cases.find(c=>c.restart).events.filter(r=>r.phase==='restart').length,1);
fs.writeFileSync(output,JSON.stringify({captureSHA256:createHash('sha256').update(bytes).digest('hex'),...capture},null,2)+'\n');
