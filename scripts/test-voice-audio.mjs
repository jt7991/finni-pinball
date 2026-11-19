import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile('browser/voice-audio.js','utf8');
const {pitchShift, level, wav} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rate = 32000, samples = Float32Array.from({length:rate}, (_,i) => .8*Math.sin(2*Math.PI*440*i/rate));
for (const shift of [-6,0,2,5,8]) {
  const changed = pitchShift(samples, rate, shift);
  assert.equal(changed.length, samples.length, 'Pitch preserves duration');
  assert.ok(changed.every(Number.isFinite));
  // Estimate strongest spectral bin, rather than zero crossings of granular overlaps.
  let strongest = 0, best = 0;
  const expected = 440 * 2 ** (shift/12);
  for (let hz = Math.floor(expected)-35; hz < expected+35; hz++) {
    let real=0, imaginary=0;
    for (let i=3200;i<28800;i+=2) { real += changed[i]*Math.cos(2*Math.PI*hz*i/rate); imaginary += changed[i]*Math.sin(2*Math.PI*hz*i/rate); }
    const power = real*real+imaginary*imaginary;
    if (power>strongest) {strongest=power;best=hz;}
  }
  assert.ok(Math.abs(best-expected)<18, `Expected ~${expected} Hz, got ${best}`);
  level(changed);
  assert.ok(changed.every(x=>Math.abs(x)<=.892), 'Peak headroom');
}
const silence = new Float32Array(rate); level(silence); assert.ok(silence.every(x=>x===0));
const blob = wav({sampleRate:rate,getChannelData:()=>samples});
const bytes = new DataView(await blob.arrayBuffer());
assert.equal(bytes.getUint16(22,true),2); assert.equal(bytes.getUint32(24,true),32000);
assert.equal(bytes.getUint16(34,true),16); assert.equal(bytes.getUint32(40,true),rate*4);
assert.equal(bytes.getInt16(448,true),bytes.getInt16(450,true), 'Stereo channels match');
console.log('Voice DSP: pitch/duration, silence, peak headroom and game WAV format pass.');
