import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const sha=b=>createHash('sha256').update(b).digest('hex'),main=fs.readFileSync('browser/framebuffer-copy.js','utf8').replaceAll('\r\n','\n'),fixtures=[];
for(const quality of ['performance','detailed']){
 const input='.work/three-review/native-main-backdrop-'+quality+'-r3.json',bytes=fs.readFileSync(input),data=JSON.parse(bytes);
 assert.deepEqual(data.errors,[]);assert.equal(data.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(data.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(data.captures.length,quality==='detailed'?2:1);
 for(const [copyIndex,capture]of data.captures.entries()){
 const name=quality==='detailed'?quality+'-copy'+(copyIndex+1):quality,directory='.work/native-main-backdrop-'+name;
 assert.equal(capture.depthFunc,519);assert.equal(capture.depthWrite,true);assert.equal(capture.blend,false);assert.equal(capture.scissor,false);assert.deepEqual(capture.draw.args,[4,0,3]);
 for(const shader of capture.shaders)assert.ok(main.includes(shader.source),'Exact shader source shared with main');
 fs.mkdirSync(directory,{recursive:true});
 const image=(value,file)=>{const bytes=Buffer.from(value.bytes,'base64'),{bytes:ignored,...rest}=value;fs.writeFileSync(directory+'/'+file,bytes);return{...rest,file,byteLength:bytes.length,sha256:sha(bytes)};};
 const reference={...data,captures:undefined,copyIndex,capture:{...capture,inputs:Object.fromEntries(Object.entries(capture.inputs).map(([name,value])=>[name,image(value,name+'.bin')])),prior:image(capture.prior,'prior.bin'),output:image(capture.output,'output.bin'),outputDepth:image(capture.outputDepth,'output-depth.bin')},captureSHA256:sha(bytes),scope:'Actual native cached-scene copy, on the same declared incoming static HDR and D16 inputs. Output color/depth are comparisons only. No frame clocks, captured output colors, poses or RNG are used in production.'};
 fs.writeFileSync(directory+'/reference.json',JSON.stringify(reference));
 fixtures.push({quality,copyIndex,target:capture.target,engineSHA256:data.engineSHA256,sourceSha256:data.reference.sourceSha256,captureSHA256:sha(bytes),viewport:capture.viewport,draw:capture.draw,shaders:capture.shaders.map(s=>({type:s.type,source:s.source,sha256:sha(Buffer.from(s.source))})),priorErrors:data.priorErrors});
 console.log(JSON.stringify({directory,viewport:capture.viewport}));
 }
}
fs.writeFileSync('three/tests/fixtures/vpx-main-backdrop-native.json.gz',gzipSync(Buffer.from(JSON.stringify({mainFramebufferCopySHA256:sha(Buffer.from(main)),fixtures})),{level:9}));
