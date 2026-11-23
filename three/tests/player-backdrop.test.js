import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
const fixture=readReferenceFixture(new URL('fixtures/vpx-main-backdrop-native.json.gz',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('current player uses the exact main shaders independently observed in all native cache copies',()=>{
 const source=fs.readFileSync(new URL('../../browser/framebuffer-copy.js',import.meta.url),'utf8').replaceAll('\r\n','\n');assert.equal(sha(source),fixture.mainFramebufferCopySHA256);assert.equal(fixture.fixtures.length,3);
 assert.deepEqual(fixture.fixtures.map(f=>[f.quality,f.copyIndex]),[['performance',0],['detailed',0],['detailed',1]]);
 for(const capture of fixture.fixtures){assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(capture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.deepEqual(capture.draw,{method:'drawArrays',args:[4,0,3]});assert.deepEqual(capture.viewport,capture.quality==='performance'?[0,0,585,1149]:[0,0,780,1532]);assert.equal(capture.shaders.length,2);for(const shader of capture.shaders){assert.equal(sha(shader.source),shader.sha256);assert.ok(source.includes(shader.source));}}
 assert.notEqual(fixture.fixtures[1].target,fixture.fixtures[2].target,'Both distinct native Detailed copy destinations are retained');
});
