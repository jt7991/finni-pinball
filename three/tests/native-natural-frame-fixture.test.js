import test from 'node:test';import assert from 'node:assert/strict';import{readNativeWholeFramePackage}from '../../scripts/native-whole-frame-package.mjs';
test('retained natural-start GPU evidence preserves original capture bytes, timer-budget observations and every source image',()=>{
 const file=new URL('fixtures/vpx-main-natural-startup-gpu-native.json.gz',import.meta.url),{packet,capture}=readNativeWholeFramePackage(file);
 assert.equal(packet.capture.sha256,'b8a8d7ad8c87a09f3d23966363d9968732611c55673688cf0bca7ecc54377522');assert.equal(capture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.deepEqual(packet.input.images,capture.frame.images);assert.deepEqual(packet.input.startupScene,capture.startupScene);assert.equal(Object.keys(packet.files).length,11);assert.equal(packet.input.renderMode.uniformAlignmentReference,false);assert.equal(packet.input.renderMode.nativePrepass,true);assert.equal(packet.input.freezeObservation.firstGameTime,2222);
 assert.equal(packet.input.startupScene.timers.events.length,2599);assert.ok(packet.input.startupScene.timers.budgetTransitions.some(row=>row.microseconds>5000&&row.exceeded));
 for(const name of ['hdr','reflection','depth','final']){const image=packet.input.images[name];assert.equal(image.width,780);assert.equal(image.height,1532);assert.ok(packet.files[image.file].bytes>0);}
});
