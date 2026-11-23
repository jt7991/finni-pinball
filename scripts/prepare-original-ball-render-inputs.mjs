// Keep original native component recordings tied to their authored light inputs.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createFullGame} from '../three/full-game.js';
import {readReferenceAssets,readOriginalRenderAsset} from './reference-physics.mjs';
const sourceSha256='6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a';
const {layout,objects,source}=readReferenceAssets({sourceSha256});
const game=await createFullGame(layout,objects,source,()=>{});
try{
  const metadata=readOriginalRenderAsset('native-ball/native-ball.json');
  const lightStates=Object.fromEntries(metadata.lights.map(light=>[light.name.toLowerCase(),{color:game.rules.objects.get(light.name.toLowerCase()).color}]));
  const inputs={sourceSha256,scope:'Original authored Table1_Init colors, with no physics stepping or measured uniform fitting. Native original component packets and their limits are unchanged.',lightStates,globals:readOriginalRenderAsset('native-lighting.json').globals};
  fs.writeFileSync('three/tests/fixtures/vpx-ball-render-inputs-6300.json.gz',gzipSync(JSON.stringify(inputs),{mtime:0}));
  console.log(JSON.stringify({sourceSha256,lights:Object.keys(lightStates).length}));
}finally{game.dispose();}
