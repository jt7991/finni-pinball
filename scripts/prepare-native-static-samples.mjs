// Publish the original sampling ROM, never observed/fitted camera offsets.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const bytes=fs.readFileSync(process.argv[2]??'.work/vpx-native-source/math-bluenoise.h');
assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),'a275c9e0ee5df0e9f8a032cc26618df78290f1dd');
const source=bytes.toString().replace(/\/\*[\s\S]*?\*\//g,''),body=source.match(/xyLDBNbnot\[[^\]]+\]\s*=\s*\{([^}]+)\}/)[1],samples=body.split(',').map(value=>value.trim()).filter(Boolean).map(value=>Math.fround(Number(value.replace(/f$/,''))));assert.equal(samples.length,256);assert.ok(samples.every(Number.isFinite));
fs.writeFileSync('three/native-static-sample-data.js','// SPDX-License-Identifier: GPL-3.0-or-later\n// Original src/math/bluenoise.h, VPX 195f214dd4849b8ef6113fd377258b78d0dec3bf.\n// Git blob a275c9e0ee5df0e9f8a032cc26618df78290f1dd. No measured offsets.\nexport const nativeStaticSamples=new Float32Array('+JSON.stringify(samples)+');\n');
console.log(JSON.stringify({samples:samples.length/2,sourceBlob:'a275c9e0ee5df0e9f8a032cc26618df78290f1dd'}));
