import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import {createAuthoredFLACSource,createFLACFrameCache} from '../flac-source.js';
import {openEffectBank} from '../effect-bank.js';
import {createFullGame} from '../full-game.js';
const current='6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5',previous='3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14',sha=b=>createHash('sha256').update(b).digest('hex');
test('native recordings select exact archived or current authored inputs and reject unknown sources',()=>{
 const old=nativeSourceAssets(previous),now=nativeSourceAssets(current);
 assert.deepEqual(old.json('layout.json'),now.json('layout.json'));assert.deepEqual(old.json('objects.json'),now.json('objects.json'));
 assert.notEqual(old.text('rules.vbs'),now.text('rules.vbs'));assert.match(now.text('rules.vbs'),/Sub FinniUseBrowserMusic\(\)/);assert.doesNotMatch(old.text('rules.vbs'),/Sub FinniUseBrowserMusic\(\)/);
 const a=old.json('audio.json'),b=now.json('audio.json');assert.deepEqual(Object.keys(b).filter(name=>b[name].sourceSHA256!==a[name].sourceSHA256).sort(),['vo_caketimefinish','vo_dazzlerteamup','vo_wolverineteamup']);
 assert.throws(()=>nativeSourceAssets('unknown'),/No authored inputs/);
});

test('cc6f04f retains the preceding authored rules and geometry while refreshing only the 44 toy callouts',()=>{
 const old=nativeSourceAssets(current),latest=nativeSourceAssets('1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');
 for(const file of ['layout.json','objects.json','rules.vbs'])assert.ok(old.bytes(file).equals(latest.bytes(file)),file+' unchanged authored inputs');
 const a=old.json('audio.json'),b=latest.json('audio.json'),changed=Object.keys(b).filter(name=>a[name].sourceSHA256!==b[name].sourceSHA256).sort();
 assert.equal(changed.length,44);assert.deepEqual(changed,Object.keys(b).filter(name=>/^vo_lildp\d+$/.test(name)).sort());assert.equal(new Set(changed.map(name=>b[name].sourceSHA256)).size,3);
 assert.equal(latest.metadata.sourceCommit,'cc6f04f691e6e762687e2f612800079457b5d98b');
});

test('cc6f04f toy callouts reproduce every independently observed original decoder PCM sample',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-main-cc6f04f-changed-voices.json',import.meta.url));assert.equal(sha(bytes),'5fbd6d27d53a085c0981977cca0cc95990dce4a5860a5ec8f369abf6f74e10df');const fixture=JSON.parse(bytes);
 const assets=nativeSourceAssets(fixture.sourceTableSHA256),manifest=assets.json('audio.json'),index=assets.json('native-audio/effects.json'),bank=openEffectBank(manifest,index,fs.readFileSync(new URL('../public/native-audio/'+index.file,import.meta.url))),cache=createFLACFrameCache(262144);
 assert.equal(fixture.sourceTableSHA256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.rows.map(row=>row.name),['vo_lildp1','vo_lildp2','vo_lildp3']);
 for(const row of fixture.rows){const entry=manifest[row.name],descriptor=bank.get(row.name),source=createAuthoredFLACSource(descriptor.encoded,entry,descriptor.index,cache),hash=createHash('sha256');assert.equal(row.sourceSHA256,entry.sourceSHA256);assert.equal(row.frames,source.length);assert.equal(row.sampleRate,source.sampleRate);assert.equal(row.channels,source.numberOfChannels);assert.equal(row.unchangedPhysicsRNG,true);assert.equal(row.lastStatus,-17);for(let at=0;at<source.length;at+=2048)hash.update(source.readInterleaved(at,Math.min(2048,source.length-at),row.channels));assert.equal(hash.digest('hex'),row.pcmSHA256,row.name+' complete original source PCM');}
});
test('all native Friendship-guide boundaries preserve exact authored position and velocity Singles',async()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-6f8116d-ramp-guide.json',import.meta.url))),assets=nativeSourceAssets(current),logs=[];
 assert.equal(fixture.reference.sourceSha256,current);assert.equal(fixture.reference.controlledSha256,current);assert.deepEqual(fixture.reference.controlledOverrides,{});assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,26);assert.deepEqual(fixture.errors,[]);assert.doesNotMatch(fixture.inputScript,/\b(?:Sub|Function|Randomize)\b/);
 const game=await createFullGame(assets.json('layout.json'),assets.json('objects.json'),assets.text('rules.vbs'),()=>{},{play(){},stop(){},log:line=>logs.push(line)});
 try{
  game.start();game.rules.execute(fixture.inputScript);
  const rows=logs.filter(line=>line.startsWith('REF_GUIDE|')).map(line=>{const values=line.slice('REF_GUIDE|'.length).split('|').map(Number);return{index:values[0],values:values.slice(1).map(Math.fround)};});
  assert.deepEqual(rows,fixture.rows.map(({index,values})=>({index,values})),'Both guide windows, rejected approaches and exact boundary Singles match native');
 }finally{game.dispose();}
});
test('all three new master voices reproduce the independently observed complete native decoder PCM',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-6f8116d-changed-voices.json',import.meta.url))),assets=nativeSourceAssets(current),manifest=assets.json('audio.json'),index=assets.json('native-audio/effects.json'),bank=openEffectBank(manifest,index,fs.readFileSync(new URL('../public/native-audio/'+index.file,import.meta.url))),cache=createFLACFrameCache(262144);
 assert.equal(fixture.sourceTableSHA256,current);assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.errors,[]);assert.equal(fixture.rows.length,3);
 for(const row of fixture.rows){
  const entry=manifest[row.name],descriptor=bank.get(row.name),source=createAuthoredFLACSource(descriptor.encoded,entry,descriptor.index,cache),hash=createHash('sha256');
  assert.equal(row.sourceSHA256,entry.sourceSHA256);assert.equal(row.frames,source.length);assert.equal(row.sampleRate,source.sampleRate);assert.equal(row.channels,source.numberOfChannels);assert.equal(row.unchangedPhysicsRNG,true);assert.equal(row.lastStatus,-17);
  assert.equal(sha(fs.readFileSync(new URL('../public/audio/'+entry.fallbackFile,import.meta.url))),row.sourceSHA256);
  for(let at=0;at<source.length;at+=2048)hash.update(source.readInterleaved(at,Math.min(2048,source.length-at),row.channels));assert.equal(hash.digest('hex'),row.pcmSHA256,row.name+' original full native PCM');
 }
});
