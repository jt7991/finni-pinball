import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{VbsEngine}from'@devscholar/vbs-engine-js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-abs-native.json',import.meta.url)));
test('Abs retains the original compiled host types, coercions and overflow errors in nineteen native cases',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.errors,[]);assert.equal(fixture.cases.length,19);
 const engine=new VbsEngine({hostIntegration:false});
 // Replace only the read-only print destination, retaining the exact native
 // Eval/error/type/value observer and its independently measured expressions.
 const logger='Debug.Print "ABS_NATIVE|" & label & "|" & code & "|" & kind & "|" & text';assert.equal(fixture.declarations.split(logger).length,2);
 engine.addCode('Dim RefAbsObserved\n'+fixture.declarations.replace(logger,logger.replace('Debug.Print ','RefAbsObserved=')));assert.equal(engine.error,null);
 try{for(const [index,c]of fixture.cases.entries()){
  engine.executeStatementThrows(`RefAbsProbe "case${index}", "${c.expression.replaceAll('"','""')}"`);
  const line=engine.eval('RefAbsObserved'),match=/^ABS_NATIVE\|case\d+\|(\d+)\|(\d+)\|(null|[-+0-9.eE]+)$/.exec(line);assert.ok(match,c.expression+' result observed');
  assert.deepEqual({error:Number(match[1]),type:Number(match[2]),value:match[3]==='null'?null:Number(match[3])},{error:c.error,type:c.type,value:c.value},c.expression);
 }}finally{engine.destroy();}
});
