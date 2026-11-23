// Preserve original CPU bytes and actual GPU uploads as separate observations.
// This command never rewrites an existing fixture or corrects the reference.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeClassicLightState} from '../three/native-classic-state.js';
const [directory,output]=process.argv.slice(2),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.ok(directory&&output);assert.ok(!fs.existsSync(output),'Preserve existing native fixtures');
const pointerBytes=fs.readFileSync(directory+'/uniform-pointers.json'),captureBytes=fs.readFileSync(directory+'/capture.json'),capture=JSON.parse(captureBytes),source=JSON.parse(pointerBytes),input=JSON.parse(fs.readFileSync(directory+'/input.json')),metadata=JSON.parse(fs.readFileSync('three/public/native-classic/native-classic.json'));
assert.equal(source.engineSHA256,metadata.engineSHA256);assert.deepEqual(source.errors,[]);assert.equal(capture.control.uniformAlignmentReference,false);assert.equal(input.renderMode.uniformAlignmentReference,false);
const rows=source.rows.filter(row=>row.basic),cases=[],bits=values=>Array.from(new Uint32Array(values.buffer,values.byteOffset,values.length));assert.equal(rows.length,75);
for(let offset=0;offset<rows.length;offset+=3){
 const group=rows.slice(offset,offset+3),center=group.find(row=>row.uniform==='lightCenter_maxRange').intended;
 const matches=metadata.parts.filter(part=>Math.fround(part.spec.center.x)===center[0]&&Math.fround(part.spec.center.y)===center[1]);assert.equal(matches.length,1);
 const part=matches[0],native=input.states[part.spec.name.toLowerCase()],lightingOff=native.ImageMode;
 assert.equal(typeof lightingOff,'boolean','Observe the original preceding Boolean separately');
 const state={visible:native.Visible,color:native.Color,colorfull:native.ColorFull,inplayintensity:native.GetInPlayIntensity},values=nativeClassicLightState(part.spec,state);
 assert.equal(group[0].prefixByte,Number(lightingOff));
 for(const row of group){assert.equal(row.pointerAlignment,1);assert.equal(row.byteAddressSent,row.pointer-1);assert.deepEqual(bits(values[row.uniform]),row.intendedBits);assert.deepEqual(row.sentBits,row.uploadedBits);}
 cases.push({name:part.spec.name,spec:part.spec,state,lightingOff,uploads:group.map(({uniform,pointer,prefixByte,byteAddressSent,intendedBits,uploadedBits})=>({uniform,pointer,prefixByte,byteAddressSent,intendedBits,uploadedBits}))});
}
assert.equal(new Set(cases.map(row=>row.name)).size,25);assert.equal(cases.filter(row=>row.lightingOff).length,1);
const fixture={engineSHA256:source.engineSHA256,tableSHA256:capture.reference.sourceSha256,captureSHA256:sha(captureBytes),pointerSHA256:sha(pointerBytes),cases,scope:'Original pinned engine and current table, with all inserts on and one declared ImageMode=True control. Read-only import-pointer, preceding Boolean and actual unchanged GPU-upload observations. CPU values and floored uploaded bits are preserved separately; no reference alignment bridge or output reconstruction.'};
fs.writeFileSync(output,JSON.stringify(fixture));console.log(JSON.stringify({output,cases:cases.length,booleanTrue:1,uploadedFields:300}));
