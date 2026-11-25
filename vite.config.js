import {defineConfig} from 'vite';
import {verifyDmdAtlas} from './scripts/verify-dmd-atlas.mjs';
import {verifyEffectBank} from './scripts/verify-effect-bank.mjs';
// Apply current compatibility fixes before building or optimizing dependencies.
// Tracking this import also invalidates Vite's cache when a fix changes.
import './scripts/patch-vbs-engine.mjs';

let atlasPublicDirectory;
const pocketBaseUrl=process.env.POCKETBASE_URL||'http://127.0.0.1:8090';

export default defineConfig({
  root: 'three',
  base: '/three/',
  plugins:[{name:'dmd-atlas-integrity',apply:'build',configResolved(config){atlasPublicDirectory=config.publicDir;},buildStart(){verifyDmdAtlas(atlasPublicDirectory);verifyEffectBank(atlasPublicDirectory);}}],
  server: {proxy: {
    '/api/leaderboard': {target:pocketBaseUrl,rewrite:()=>'/api/finni/leaderboard'},
    '/api/runs': {target:pocketBaseUrl,rewrite:()=>'/api/finni/runs'},
    '/api/scores': {target:pocketBaseUrl,rewrite:()=>'/api/finni/scores'},
    '/voice': {target:'http://127.0.0.1:8765'},
    '/api/': {target:pocketBaseUrl},
  }},
  build: {outDir: '../browser/three', emptyOutDir: true},
});
