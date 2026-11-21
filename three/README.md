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

- `full-game.js` binds authored switches, drop targets, spinners, gates, kickers, ball release, ball saving and multiball to physical balls. `physics.js` owns fixed 1000 Hz stepping, finite-torque dynamic flippers and invisible ramp collision surfaces. Flippers use the source pivot-to-tip lengths, radii, inertia, strength and return strength, quartic EOS torque transition, and stop rebound within the remaining part of the physics tick. The source rules run before physics integration and control EOS torque and live-catch elasticity.
- `index.html` and `style.css` use the main player's existing interface. `ui.js` binds its toolbar, phone touch zones, settings popover and desktop DMD layout to the independent runtime.
- `rules.js` supplies table objects, timers, delayed calls, storage, audio and lamp sequences to `@devscholar/vbs-engine-js`. Timers catch up at their authored intervals, including the 1 ms flipper timer and its 10 ms live-catch window. Host integration is disabled. The rules asset retains the full scoring and progression script, including all seven tasks, Cake Time, Friendship, Disco and the other original modes, skill shots, bonuses, supplies, special abilities, extra balls, multiplayer and initials entry.
- `scene.js` uses the saved table/hardware geometry, independently animated targets and Finni parts, registered insert polygons, a full-color DMD and a capped mobile render buffer. The static meshes are grouped by material and Draco compressed; the decoder is bundled locally.
- `media.js` streams music and loads individual callouts/effects on demand. Decoded sound buffers have a 16 MiB retention budget. No audio archive is downloaded at startup.

The native bootstrap, three invisible toy-animation balls, rolling-sound initializer and dynamically generated flasher routines are replaced by JavaScript host behavior. Two display-width expressions are corrected to use numeric character counts; `rolling` is explicitly declared, and the native light collection assignment is adapted to a VB array. These changes are reproducible in `scripts/prepare-three-assets.py`; they do not simplify the scoring or mission rules.

Physics is a new implementation, using the table's gravity and inclination, the authored curved shooter-lane boundary and directional gate handling. Wall collision meshes have closed tops and exact footprints to preserve the narrow rollover openings. Ramp collision strips include drag-point height offsets and source wall heights, with joined side faces to avoid segment seams. An invisible filled guide with a sloping face under the right return plastic closes an inaccessible pocket narrower than a ball and avoids a notch at the post junction. The accepted wire-ramp model is unchanged.

This is not certified to reproduce VPX’s contact response, friction, ramp travel times or flipper tricks exactly. Headless desktop checks do not establish physical Android/iPhone frame rate. Physical device testing and shot-by-shot feel comparisons remain necessary before treating this branch as a replacement release.

Native comparison fixtures are in `three/tests/fixtures/vpx-motion.json`. Run `node scripts/compare-vpx-physics.mjs --check` to compare the full runtime's unloaded flippers against the recorded native simulation clock, including stop rebound and return. This gate covers these measured cases, not whole-table parity. Material overrides are resolved from the extracted materials, including velocity-dependent restitution. Ball/ball restitution is independently .8, surface friction is not averaged with an invented ball coefficient, and artificial rolling drag and the un-authored velocity cap are removed.

Reference equations: upstream VPX [flipper dynamics](https://github.com/vpinball/vpinball/blob/master/src/physics/hitflipper.cpp), [ball response](https://github.com/vpinball/vpinball/blob/master/src/physics/hitball.cpp), and [elasticity falloff](https://github.com/vpinball/vpinball/blob/master/src/physics/collide.h). The reference probe records live native output; passing the general stability suite alone does not establish a VPX match.

## Rebuilding assets

The optimized assets under `three/public/` are included so a clean checkout can play and build without VPX, Blender or the original table. Rebuilding them requires the existing local extracted Finni table and tools:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-assets.py
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/export-three-model.py
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-audio.py
```

Audio encoding also requires ffmpeg on PATH. Preserve the original author attribution, permissions and asset/music/font credits recorded in the root README and `references/deadpool/VPX-SOURCE.md`. The upstream libraries retain their respective licenses: Three.js (MIT), Rapier (Apache-2.0), vbs-engine-js (MIT) and Vite (MIT).

In an isolated worktree, `prepare-three-assets.py --source-root PATH` reads extracted sources and Python dependencies from another checkout while writing all generated assets into this worktree. Normal builds need only the committed assets.

## Verification

```powershell
npm.cmd test
npm.cmd run build
node scripts/probe-three-physics.mjs --flippers
node scripts/probe-three-physics.mjs --full --cases=24 --seconds=120
node scripts/probe-three-physics.mjs --full --multiball --cases=6 --seconds=120
# With the Vite server running:
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/check-three.py
```

The rule checks exercise all seven mission completions and scoop jackpots, four players, skill shots, every authored shot/target handler, Friendship qualification, ramp-assist object arguments and initials entry. Physics regressions cover the previous jam locations, ramp ends and wall heights, flipper timing and symmetry, short taps, 32 heel/tip shot combinations, cradle release, lane feed, capture/eject, cancellation, tilt, ball progression and real multiball creation. The randomized probe monitors every unheld ball for stalls and invalid velocities, resolves scoop choices, enters initials and restarts completed games; reports remain under `.work/three-physics/`.

The browser runner uses real WebGL and the real rules in headless Edge, checking portrait, small-phone, landscape and desktop layouts, simultaneous touches, cancellation, launch, camera changes and the absence of VPX network requests. Pass a production URL and `--production` to check the compressed build without the development debug hook. Captures remain local under `.work/three-review/`.

Use `--seed-start=N --cases=1` to rerun a particular input seed. Seed ranges write separate reports so independent batches can run concurrently.
