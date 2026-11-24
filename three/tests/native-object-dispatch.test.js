import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createRules}from'../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-object-dispatch-native.json',import.meta.url))),specs=JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url)));
test('native authored-property getters retain Single, Long and raw Boolean dispatch through aliases and operators',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.reference.controlledOverrides,{});assert.equal(fixture.reference.sourceSha256,fixture.reference.controlledSha256);assert.equal(fixture.cases.length,101);assert.equal(fixture.restored,true);assert.deepEqual(fixture.errors,[]);
 const logger=fixture.declarations.split('\n').find(l=>l.trimStart().startsWith('Debug.Print "OBJECT_DISPATCH_NATIVE|"')),source='Dim RefDispatchObserved\n'+fixture.declarations.replace(logger,logger.replace('Debug.Print ','RefDispatchObserved=')),rules=createRules(source,specs),differences=[];
 const decode=text=>{const [hi,lo,shift]=text.split(',').map(Number);return(hi*16777216+lo)/2**shift;};
 try{for(const [i,c]of fixture.cases.entries()){
  const assignment=c.input===undefined?'':(c.assign??c.expression)+'='+c.input;rules.execute(`RefDispatchProbe "case${i}", "${c.expression}", "${assignment.replaceAll('"','""')}"`);const m=/^OBJECT_DISPATCH_NATIVE\|case\d+\|([\d,|+\-]+)$/.exec(rules.value('RefDispatchObserved'));assert.ok(m,c.expression);const p=m[1].split('|');assert.equal(p.length,9);
  const actual={error:Number(p[0]),type:Number(p[1]),aliasType:Number(p[3]),plusType:Number(p[5]),notType:Number(p[7])},expected=Object.fromEntries(Object.keys(actual).map(k=>[k,c[k]]));
  // Read-only moving values depend on live physical time. Their metadata is
  // checked here; full-game recordings separately check their actual values.
  // Every declared setter case compares every native numeric result as well.
  if(c.input!==undefined)for(const[k,j]of [['value',2],['aliasValue',4],['plusValue',6],['notValue',8]]){actual[k]=decode(p[j]);expected[k]=c[k];}
  try{assert.deepEqual(actual,expected);}catch{differences.push({expression:c.expression,input:c.input,actual,expected});}
 }
 assert.deepEqual(differences,[]);for(const name of ['leftflipper','target011','fi001','gate3','li001'])assert.ok(!Object.keys(rules.objects.get(name)).some(k=>/^(getproperty|setproperty|hasmethod)$/i.test(k)));
 }finally{rules.engine.destroy();}
});
