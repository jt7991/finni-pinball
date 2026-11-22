// Refresh shader binding metadata from the existing source draw associations.
// Geometry, images, matrices and expected pixels remain unchanged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const capture=JSON.parse(fs.readFileSync('.work/three-review/native-full-order-revealed.json')),file='three/public/native-table/native-table.json',metadata=JSON.parse(fs.readFileSync(file));
assert.equal(metadata.engineSHA256,capture.engineSHA256);assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(capture.errors,[]);
const counts={history:0,empty:0};
for(const part of metadata.parts){if(!Number.isInteger(part.reflectionDrawOrder))continue;const draw=capture.draws[part.reflectionDrawOrder],binding=draw.textures.tex_base_transmission;assert.ok(draw.matrices[26]<0);assert.ok(binding&&[0,5].includes(binding.id));part.reflectionTransmission=binding.id!==0;counts[part.reflectionTransmission?'history':'empty']++;}
fs.writeFileSync(file,JSON.stringify(metadata));console.log(JSON.stringify(counts));
