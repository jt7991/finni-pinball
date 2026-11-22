// Decode observed state into shared diagnostic inputs. Expected frame pixels
// stay unchanged and are never reconstructed from the port.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeBallRotationScale} from '../three/native-ball-render-state.js';
const directory=process.argv[2]??'.work/three-review/native-whole-frame-control',bytes=fs.readFileSync(path.join(directory,'capture.json')),capture=JSON.parse(bytes),states={},missing=[];
assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.frame.errors,[]);assert.deepEqual(capture.balls.errors,[]);
for(const line of capture.stateLog.split(/\r?\n/)){
 const match=line.match(/WHOLE_(PROP|MISSING)\|([^|]+)\|([^|]+)\|([^']*)'/);if(!match)continue;
 const [,kind,name,key,value]=match;if(kind==='MISSING'){missing.push({name,key,reason:value});continue;}
 (states[name.toLowerCase()]??={})[key]=value==='True'?true:value==='False'?false:['ImageA','ImageB','Filter'].includes(key)?value:Number(value);
}
const visualNames=new Set();
for(const file of ['native-table/native-table.json','native-flashers/native-flashers.json','native-halos/native-halos.json','native-classic/native-classic.json','flipper-tops.json'])for(const part of JSON.parse(fs.readFileSync('three/public/'+file)).parts)visualNames.add(part.spec.name.toLowerCase());
for(const item of JSON.parse(fs.readFileSync('three/public/layout.json')).items)if(item.kind==='Flipper')visualNames.add(item.name.toLowerCase());
for(const item of missing)assert.ok(!visualNames.has(item.name.toLowerCase()),'Do not silently omit a rendered native input: '+item.name);
const balls=[];for(const match of capture.stateLog.matchAll(/WHOLE_BALL\|([^']+)'/g)){
 const [id,...raw]=match[1].split('|'),[x,y,z,radius,color,visible,reflectionenabled,forcereflection,bulbintensityscale,playfieldreflectionscale]=raw,position={x:Math.fround(Number(x)),y:Math.fround(Number(y)),z:Math.fround(Number(z))};
 const rows=capture.balls.records.filter(row=>['x','y','z'].every((axis,index)=>Object.is(row.position[index],position[axis])));assert.ok(rows.length,'native body linked by exact Float32 position');
 const row=rows[0],rotation=nativeBallRotationScale(row.currentOrientation,Number(radius));assert.deepEqual(Array.from(new Uint32Array(rotation.buffer)),Array.from(new Uint32Array(Float32Array.from(row.rotScale).buffer)),'paused native rotation agrees without pose fitting');
 assert.ok(rows.every(row=>row.clocks.length===0));for(const observed of rows){assert.deepEqual(observed.currentOrientation,row.currentOrientation,'frozen native orientation stays unchanged');assert.deepEqual(observed.velocity,row.velocity,'frozen native velocity stays unchanged');}
 balls.push({id:Number(id),position,orientation:row.currentOrientation,velocity:Object.fromEntries(['x','y','z'].map((axis,index)=>[axis,row.velocity[index]])),radius:Number(radius),locked:row.locked,color:Number(color),visible:visible==='True',reflectionenabled:reflectionenabled==='True',forcereflection:forcereflection==='True',bulbintensityscale:Math.fround(Number(bulbintensityscale)),playfieldreflectionscale:Math.fround(Number(playfieldreflectionscale))});
}
assert.equal(balls.length,4);const fields=Object.values(states).reduce((sum,state)=>sum+Object.keys(state).length,0);assert.equal(fields+missing.length,capture.control.requested.length);
const clear=capture.frame.clears?.find(clear=>clear.target===capture.frame.images.hdr.id&&(clear.mask&0x4000)&&!clear.scissorEnabled);
const input={sourceSHA256:createHash('sha256').update(bytes).digest('hex'),canvas:capture.canvas,cameraPreset:capture.control.cameraPreset??'balanced',frameIndex:capture.frame.frameIndex,images:capture.frame.images,states,balls,missing,expectedMainClear:clear?.color,control:capture.control.scope,renderMode:{nativePrepass:!!capture.control.nativePrepass,staticDisabled:capture.control.staticDisabled,reflectedTransmissionObserved:capture.frame.reflectedTransmissionObserved,reflectedTransmissionTexture:capture.frame.reflectedTransmissionTexture}};
for(const image of Object.values(input.images))if(image.arrayType==='Float32Array'){const bytes=fs.readFileSync(path.join(directory,image.file)),values=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);assert.ok(values.every(Number.isFinite),'native frame image must contain finite values: '+image.file);}
fs.writeFileSync(path.join(directory,'input.json'),JSON.stringify(input));
console.log(JSON.stringify({directory,states:Object.keys(states).length,fields,missing,balls:balls.length,expectedMainClear:input.expectedMainClear,reflectedTransmission:capture.frame.reflectedTransmissionTexture,reflectedScissor:capture.frame.draws.find(draw=>draw.matrixKind==='basic'&&draw.matrices[26]<0)?.scissor}));
