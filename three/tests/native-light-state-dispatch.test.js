import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createRules}from'../rules.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-light-state-dispatch-native.json',import.meta.url)));
test('Light.State dispatch, aliases and Single arithmetic match seventeen original native cases exactly',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,17);assert.equal(fixture.restored,true);assert.deepEqual(fixture.errors,[]);
 const logger=fixture.declarations.split('\n').find(line=>line.trimStart().startsWith('Debug.Print "LIGHT_STATE_NATIVE|"'));assert.ok(logger);
 const source='Dim RefLightObserved\n'+fixture.declarations.replace(logger,logger.replace('Debug.Print ','RefLightObserved=')),rules=createRules(source,{objects:[{name:'li001',kind:'Light',state:0}],collections:[]});
 const decode=text=>{const [high,low,shift]=text.split(',').map(Number);return(high*16777216+low)/2**shift;};
 try{for(const [index,c]of fixture.cases.entries()){
  rules.execute(`RefLightStateProbe "case${index}", "${c.expression.replaceAll('"','""')}"`);
  const match=/^LIGHT_STATE_NATIVE\|case\d+\|([\d,|+\-]+)$/.exec(rules.value('RefLightObserved'));assert.ok(match,c.expression+' observed');const p=match[1].split('|');assert.equal(p.length,6);
  assert.deepEqual({error:Number(p[0]),type:Number(p[1]),value:decode(p[2]),aliasType:Number(p[3]),arithmeticType:Number(p[4]),arithmeticValue:decode(p[5])},{error:c.error,type:c.type,value:c.value,aliasType:c.aliasType,arithmeticType:c.arithmeticType,arithmeticValue:c.arithmeticValue},c.expression);
 }
 // Script dispatch metadata must remain absent from the worker's object rows.
 assert.ok(!Object.keys(rules.objects.get('li001')).some(name=>/^(getproperty|setproperty|hasmethod)$/i.test(name)));
 }finally{rules.engine.destroy();}
});
