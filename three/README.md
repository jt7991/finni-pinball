# Finni’s Big Day — Three.js port

This branch replaces the Visual Pinball player with Three.js rendering, Rapier 3D physics and an isolated JavaScript runtime for the complete authored table rules. Playing does not download or launch VPX. The accepted open wire ramps remain visible; their physical collision strips are invisible.

From the repository root, with Node 22 installed:

```powershell
npm.cmd ci
npm.cmd run play
```

Open http://127.0.0.1:5174/three/. This builds and serves the optimized assets with gzip. Start a game, wait for the ball release, then hold and release Launch. Shift keys control flippers, Space is Action, 1 starts/adds players, and Z/X/slash nudge. Keyboard bindings, toggle flippers, camera and graphics preferences are saved separately from the VPX player. Controls release on focus loss and cancellation. Controls pauses the simulation. Four cameras and screen rotation are available.

For phone testing on the existing tailnet:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch-three.ps1 -BindAddress (tailscale ip -4)
```

Open http://YOUR-TAILSCALE-IP:5174/three/ on the phone. The running computer must remain awake. HTTPS or a secure localhost context is needed for the voice studio microphone; uploads still work over HTTP.

`npm.cmd run build` writes the deployable site to `browser/three/`. Docker builds this directory itself. On this experiment branch, the deployed root redirects to `/three/`, and the original player remains at `/vpx`. No deployment is performed by the local build.

The existing PocketBase service provides the shared leaderboard. Vite proxies its game APIs to localhost:8090. The voice studio link proxies to the existing development server on localhost:8765; production serves the studio directly from the existing image. Gameplay remains usable if the backend is unavailable, including skipping score entry. Browser-submitted scores remain unverified, as in the existing player.

For source development, `npm.cmd run dev` runs Vite at http://127.0.0.1:5173/three/. The production-style local server also proxies game APIs to PocketBase, serves the existing voice studio directly, and links the VPX fallback to the existing local server on port 8765.

## Implementation

- `full-game.js` binds authored switches, drop targets, spinners, gates, kickers, ball release, ball saving and multiball to physical balls. `physics.js` owns fixed 240 Hz stepping, flipper contact geometry and the ramp collision surfaces.
- `rules.js` supplies table objects, timers, delayed calls, storage, audio and lamp sequences to `@devscholar/vbs-engine-js`. Host integration is disabled. The rules asset retains the full scoring and progression script, including all seven tasks, Cake Time, Friendship, Disco and the other original modes, skill shots, bonuses, supplies, special abilities, extra balls, multiplayer and initials entry.
- `scene.js` uses the saved table/hardware geometry, independently animated targets and Finni parts, registered insert polygons, a full-color DMD and a capped mobile render buffer. The static meshes are grouped by material and Draco compressed; the decoder is bundled locally.
- `media.js` streams music and loads individual callouts/effects on demand. Decoded sound buffers have a 16 MiB retention budget. No audio archive is downloaded at startup.

The native bootstrap, three invisible toy-animation balls, rolling-sound initializer and dynamically generated flasher routines are replaced by JavaScript host behavior. Two display-width expressions are corrected to use numeric character counts; `rolling` is explicitly declared, and the native light collection assignment is adapted to a VB array. These changes are reproducible in `scripts/prepare-three-assets.py`; they do not simplify the scoring or mission rules.

Physics is a new implementation, with a directional shooter-lane feed and gate handling. It is not certified to reproduce VPX’s contact response, friction, ramp travel times or flipper tricks exactly. Headless desktop checks do not establish physical Android/iPhone frame rate. Physical device testing and shot-by-shot feel comparisons remain necessary before treating this branch as a replacement release.

## Rebuilding assets

The optimized assets under `three/public/` are included so a clean checkout can play and build without VPX, Blender or the original table. Rebuilding them requires the existing local extracted Finni table and tools:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-assets.py
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/export-three-model.py
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-audio.py
```

Audio encoding also requires ffmpeg on PATH. Preserve the original author attribution, permissions and asset/music/font credits recorded in the root README and `references/deadpool/VPX-SOURCE.md`. The upstream libraries retain their respective licenses: Three.js (MIT), Rapier (Apache-2.0), vbs-engine-js (MIT) and Vite (MIT).

## Verification

```powershell
npm.cmd test
npm.cmd run build
# With the Vite server running:
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/check-three.py
```

The rule checks exercise all seven mission completions and scoop jackpots, four players, skill shots, every authored shot/target handler, and Friendship qualification. The physics checks cover powered flippers, lane feed, elevated ramp support, capture/eject, cancellation, tilt, ball progression and real multiball creation. The browser runner uses real WebGL and the real rules in headless Edge, checking portrait, small-phone, landscape and desktop layouts, simultaneous touches, cancellation, launch, camera changes and the absence of VPX network requests. Captures remain local under `.work/three-review/`.
