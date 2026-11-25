// Audit the actual neighboring texels, not only the row under one output.
// Input/output bytes remain independently recorded native expectations.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const output=process.argv[2];assert.ok(output,'Supply a new audit path');assert.equal(fs.existsSync(output),false,'Preserve prior evidence');
const directory='.work/three-review/native-harder-round-render-r1/native-frame-history-main-6f8116d-harder-round-r1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=fs.readFileSync(path.join(directory,'capture.json'));
assert.equal(sha(source),'4f3d3a8424e4f6b721401cf115d196bd07af150c27ab5fc3a50b8169c759601d');
const capture=JSON.parse(source),frames=capture.frames.filter(row=>row.images.bloomHorizontal);
assert.equal(frames.length,128);
// Original tex0 comes from the vertically flipped quad and therefore aligns
// output rows with input rows. Horizontal offsets extend at most 18.26884
// texels, using level-zero LINEAR/CLAMP_TO_EDGE. Include both neighboring
// rows for floating interpolation around the declared row-center coordinate.
const target={x:5,y:7,channel:2},bounds={minX:0,maxX:24,minY:6,maxY:8};
const rows=[];
for(const frame of frames){
  const image=name=>{const spec=frame.images[name],bytes=fs.readFileSync(path.join(directory,spec.file));assert.equal(sha(bytes),spec.sha256);assert.equal(spec.width,57);assert.equal(spec.height,106);assert.equal(bytes.length,57*106*16);return bytes;};
  const cut=image('bloomCut'),result=image('bloomHorizontal'),draw=frame.draws.find(d=>d.name==='fb_blur_horiz39x39');
  assert.equal(draw.bloomState.parameters[10240],9729);assert.equal(draw.bloomState.parameters[10241],9729);assert.equal(draw.bloomState.parameters[10242],33071);assert.equal(draw.bloomState.parameters[10243],33071);assert.equal(draw.bloomState.textureLevels[33084],0);assert.equal(draw.bloomState.textureLevels[33085],0);
  const blue=[],rgba=[];
  for(let y=bounds.minY;y<=bounds.maxY;y++)for(let x=bounds.minX;x<=bounds.maxX;x++){const at=(y*57+x)*16;blue.push(cut.subarray(at+8,at+12));rgba.push(cut.subarray(at,at+16));}
  const at=((target.y*57+target.x)*4+target.channel)*4;
  rows.push({frame:frame.frameIndex,blueNeighborhoodSHA256:sha(Buffer.concat(blue)),rgbaNeighborhoodSHA256:sha(Buffer.concat(rgba)),outputBits:result.readUInt32LE(at),output:result.readFloatLE(at)});
}
function groups(key){const grouped=new Map();for(const row of rows){if(!grouped.has(row[key]))grouped.set(row[key],new Map());const values=grouped.get(row[key]);if(!values.has(row.outputBits))values.set(row.outputBits,{bits:row.outputBits,value:row.output,frames:[]});values.get(row.outputBits).frames.push(row.frame);}return[...grouped].map(([sha256,values])=>({sha256,outputs:[...values.values()]}));}
const blue=groups('blueNeighborhoodSHA256'),rgba=groups('rgbaNeighborhoodSHA256');
const report={scope:'Read-only audit of a declared horizontal-blur output pixel over the complete retained native window. The three-row by 25-column patch includes every x tap and both immediate y neighbors for the pinned LINEAR level-zero horizontal shader and recorded quad. Matching blue patches are sufficient for this blue-only shader channel; matching RGBA patches are a stronger recorded-input check. This does not establish unseen historical GPU state or change any image expectation.',sourceSHA256:sha(source),target,bounds,frames:rows.length,blueGroups:blue,rgbaGroups:rgba,rows};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({frames:rows.length,blueGroups:blue.length,rgbaGroups:rgba.length,identicalBlueDifferentOutputs:blue.filter(g=>g.outputs.length>1).map(g=>({sha256:g.sha256,outputs:g.outputs.map(o=>({value:o.value,count:o.frames.length,first:o.frames[0]}))})),identicalRGBADifferentOutputs:rgba.filter(g=>g.outputs.length>1).length}));
