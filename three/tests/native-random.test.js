import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {nativeRandom} from '../native-random.js';

test('MWC64X words and both float mappings agree with exact unsigned 64-bit arithmetic',()=>{
  for(const initial of [0x12345678abcdef01n,0xffffffffffffffffn,0x0000000100000000n]){
    let state=initial;const random=nativeRandom(Number(state&0xffffffffn),Number(state>>32n));
    for(let i=0;i<1000;i++){
      const low=Number(state&0xffffffffn),high=Number(state>>32n),bits=(low^high)>>>0;
      state=(BigInt(low)*4294883355n+BigInt(high))&0xffffffffffffffffn;
      const expected=i%2?Math.fround((bits>>7)*2**-24):Math.fround(Math.fround((bits&~(bits>>>24))>>>0)*2**-32);
      assert.equal(i%2?random.signed():random(),expected);
      assert.deepEqual(random.getState(),[Number(state&0xffffffffn),Number(state>>32n)]);
    }
  }
});

test('the observed native memory words advance by the documented five draws in collision-free physics frames',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-camera-native-state.json',import.meta.url))),rows=fixture.cases[0].nativeRandomFrames;
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  for(let i=0;i<20;i++){
    const random=nativeRandom(rows[i][1],rows[i][2]);for(let draw=0;draw<5;draw++)random();
    assert.deepEqual(random.getState(),rows[i+1].slice(1),'four body queries and one contact-order draw');
  }
});

test('the complete camera recording matches native position, speed and spin at every millisecond',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-camera-native-state.json','--check','--json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(reports.length,1);assert.equal(reports[0].traceSamples.filter(s=>s.ms<=386).length,387);
});
