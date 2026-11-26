// Component timing only: native Single Ball dispatch reads, with identical
// declared inputs and all result bits checked before timing either version.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';
import{createFullGame}from'../three/full-game.js';import{nativeSourceAssets}from'./native-source-assets.mjs';
const base=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11)??'cb94dca',output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);assert.ok(output);assert.match(base,/^[a-f0-9]{7,40}$/);
const temporary=path.resolve('three/.ball-dispatch-baseline-'+process.pid+'.js'),source=execFileSync('git',['show',base+':three/full-game.js']),games=[];
fs.writeFileSync(temporary,source,{flag:'wx'});
try{
 const {createFullGame:baseline}=await import(pathToFileURL(temporary)),assets=nativeSourceAssets('1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');
 for(const create of [baseline,createFullGame]){const game=await create(assets.json('layout.json'),assets.json('objects.json'),assets.text('rules.vbs'),()=>{},undefined,{scriptRandomClock:()=>0});games.push(game);game.start();for(let i=0;i<2200;i++)game.step();}
 const properties=['x','y','z','velx','vely','velz'],records=games.map(game=>game.physicalRecords.map(record=>record.proxy));assert.ok(records[0].length);assert.equal(records[0].length,records[1].length);
 const bytes=values=>Buffer.from(new Float32Array(values).buffer),read=rows=>rows.flatMap(ball=>properties.map(property=>{const variant=ball.getProperty(property);assert.equal(variant.type,'Single');return variant.value;}));
 assert.ok(bytes(read(records[0])).equals(bytes(read(records[1]))),'Every observed Single result bit agrees before benchmarking');
 let sink=0;const iterations=10000,run=rows=>{const start=performance.now();for(let i=0;i<iterations;i++)for(const ball of rows)for(const property of properties)sink+=ball.getProperty(property).value;return performance.now()-start;};
 for(let i=0;i<3;i++){run(records[0]);run(records[1]);}
 const samples=[];for(const order of [[0,1,1,0],[1,0,0,1]])for(const version of order)samples.push({version:version?'candidate':'baseline',milliseconds:run(records[version])});
 assert.ok(bytes(read(records[0])).equals(bytes(read(records[1]))),'Timing reads mutate no result bit');const means={};for(const version of ['baseline','candidate']){const values=samples.filter(s=>s.version===version).map(s=>s.milliseconds);means[version]=values.reduce((a,b)=>a+b)/values.length;}
 const report={baseline:base,scope:'Desktop native Ball COM-dispatch component; no whole-game or physical-phone speed claim.',balls:records[0].length,properties,readsPerSample:iterations*records[0].length*properties.length,samples,means,sink};fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({readsPerSample:report.readsPerSample,means}));
}finally{for(const game of games)game.dispose();fs.unlinkSync(temporary);}
