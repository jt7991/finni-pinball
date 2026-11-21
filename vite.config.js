import {defineConfig} from 'vite';

export default defineConfig({
  root: 'three',
  base: '/three/',
  server: {proxy: {
    '/api/leaderboard': {target:'http://127.0.0.1:8090',rewrite:()=>'/api/finni/leaderboard'},
    '/api/runs': {target:'http://127.0.0.1:8090',rewrite:()=>'/api/finni/runs'},
    '/api/scores': {target:'http://127.0.0.1:8090',rewrite:()=>'/api/finni/scores'},
    '/voice': {target:'http://127.0.0.1:8765'},
    '/api/': {target:'http://127.0.0.1:8090'},
  }},
  build: {outDir: '../browser/three', emptyOutDir: true},
});
