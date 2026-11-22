import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{nativeFlipperMesh}from'../flipper-mesh.js';
import{nativeFlipperWorld}from'../flipper-transform.js';
import{createFullGame}from'../full-game.js';
import{nativeModelMatrices}from'../primitive-transform.js';import{computeNativeCamera}from'../native-camera.js';
const json=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url))),fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-flipper-render-native.json.gz',import.meta.url))));
const matrixFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-flipper-matrices-native.json.gz',import.meta.url)))),camera=computeNativeCamera(json('camera-bounds.json'),matrixFixture.camera.width/matrixFixture.camera.height,matrixFixture.camera.preset),matrixBits=world=>Array.from(new Uint32Array(nativeModelMatrices(world,camera).buffer));
test('all native flipper base/rubber vertex bits and indices match independent compiled GPU buffers',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const flippers=json('layout.json').items.filter(s=>s.kind==='Flipper');assert.equal(flippers.length,2);
 let fields=0;for(const spec of flippers){const draws=fixture.draws.filter(d=>Math.abs(d.blocks.basicMatrixBlock[12]-spec.center.x)<.01);assert.equal(draws.length,2);const mesh=nativeFlipperMesh(spec),actual=new Uint32Array(mesh.vertices.buffer);for(let part=0;part<2;part++){assert.deepEqual(Array.from(actual.subarray(part*832,(part+1)*832)),draws[part].bits,spec.name+' '+part);assert.deepEqual(Array.from(mesh.indices),draws[part].indices);fields+=832;}}
 assert.equal(fields,3328);
});
test('original binary top meshes and textures retain independently observed native render data',()=>{
 const metadata=json('flipper-tops.json'),buffer=fs.readFileSync(new URL('../public/flipper-tops.bin',import.meta.url));assert.equal(createHash('sha256').update(buffer).digest('hex'),metadata.sha256);
 for(const part of metadata.parts){const draw=fixture.tops.find(d=>Math.abs(d.blocks.basicMatrixBlock[12]-part.spec.position.x)<.01);assert.ok(draw,part.spec.name);assert.deepEqual(Array.from(new Uint32Array(buffer.buffer,buffer.byteOffset+part.vertexByteOffset,part.vertices*8)),draw.bits);assert.deepEqual(Array.from(new Uint16Array(buffer.buffer,buffer.byteOffset+part.indexByteOffset,part.indices)),draw.indices);}
 assert.equal(metadata.parts.length,2);assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../public/flipperx.webp',import.meta.url))).digest('hex'),fixture.textureSHA256);
});
test('flipper texture filtering retains separately observed native anisotropic samplers',()=>{
 const metadata=json('flipper-tops.json'),source=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-flipper-samplers-native.json',import.meta.url)));assert.equal(source.engineSHA256,fixture.engineSHA256);assert.equal(source.observations.length,3);
 for(const observation of source.observations){assert.deepEqual(metadata.samplers[observation.name],observation.parameters);assert.ok(observation.draws>0);assert.equal(observation.parameters[34046],16);}
});
test('authored Animate callbacks produce the native base and top poses at rest, held and returned',async()=>{
 const g=await createFullGame(json('layout.json'),json('objects.json'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{},undefined,{frameAnimations:true});
 const tops=json('flipper-tops.json').parts;try{g.start();for(let i=0;i<2000;i++)g.step();g.prepareFrame();
  for(const phase of ['rest','raised','restored']){
   if(phase!=='rest'){g.input('left',phase==='raised');g.input('right',phase==='raised');for(let i=0;i<300;i++){g.step();if(i%17===16)g.prepareFrame();}g.prepareFrame();}
   for(const flipper of g.flippers){const spec=g.nativeParts.get(flipper.side+'flipper'),state=g.rules.objects.get(flipper.side+'flippertop'),top=tops.find(p=>p.spec.name===spec.name+'Top').spec;
    const body=fixture.poses[phase].find(d=>d.count===300&&Math.abs(d.world[12]-spec.center.x)<.01),cap=fixture.poses[phase].find(d=>d.count===462&&Math.abs(d.world[12]-spec.center.x)<.01);
    const bodyWorld=nativeFlipperWorld(spec,flipper.nativeAngle);assert.deepEqual(Array.from(bodyWorld),body.world,phase+' '+spec.name+' body');
    const bodySamples=matrixFixture.samples.filter(d=>d.phase===phase&&d.count===300&&Math.abs(d.world[12]-spec.center.x)<.01);assert.equal(bodySamples.length,2);for(const sample of bodySamples)assert.deepEqual(matrixBits(bodyWorld),sample.matrixBits,phase+' '+spec.name+' complete body/rubber shader matrix bits');
    const topWorld=nativeFlipperWorld(top,Math.fround(state.rotz*Math.fround(Math.PI/180)),true);assert.equal(state.rotz,Math.fround(flipper.nativeAngle*Math.fround(180/Math.PI)));assert.deepEqual(Array.from(topWorld),cap.world,phase+' '+spec.name+' top');const topSample=matrixFixture.samples.find(d=>d.phase===phase&&d.count===462&&Math.abs(d.world[12]-spec.center.x)<.01);assert.ok(topSample);assert.deepEqual(matrixBits(topWorld),topSample.matrixBits,phase+' '+spec.name+' complete top shader matrix bits');
   }
  }
 }finally{g.dispose();}
});
