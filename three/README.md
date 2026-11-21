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

- `full-game.js` binds authored switches, drop targets, spinners, gates, kickers, ball release, ball saving and multiball to physical balls. `physics.js` owns fixed 1000 Hz stepping and finite-torque flippers. The native contact modules split each tick at impacts and stopper contacts, including ball spin, finite flipper recoil, restitution falloff and friction. Gravity is integrated once per millisecond, then collision and persistent-contact responses run separately. The source rules control EOS torque and live-catch elasticity before integration.
- `index.html` and `style.css` use the main player's existing interface. `ui.js` binds its toolbar, phone touch zones, settings popover and desktop DMD layout to the independent runtime.
- `rules.js` supplies table objects, timers, delayed calls, storage, audio and lamp sequences to `@devscholar/vbs-engine-js`. Timers catch up at their authored intervals, including the 1 ms flipper timer and its 10 ms live-catch window. Host integration is disabled. The rules asset retains the full scoring and progression script, including all seven tasks, Cake Time, Friendship, Disco and the other original modes, skill shots, bonuses, supplies, special abilities, extra balls, multiplayer and initials entry.
- `scene.js` uses the saved table/hardware geometry, independently animated targets and Finni parts, registered insert polygons, a full-color DMD and a capped mobile render buffer. The static meshes are grouped by material and Draco compressed; the decoder is bundled locally.
- `media.js` streams music and loads individual callouts/effects on demand. Decoded sound buffers have a 16 MiB retention budget. No audio archive is downloaded at startup.

The native bootstrap, three invisible toy-animation balls and dynamically generated flasher routines are replaced by JavaScript host behavior. Two display-width expressions are corrected to use numeric character counts; `rolling` is explicitly declared, and the native light collection assignment is adapted to a VB array. The original rolling timer retains its 10ms spin, speed, ramp-assist and audio behavior. Its locked-ball offset is changed from three to zero because the host supplies playable balls directly. `GetBalls` returns a real VB array of live dispatch objects, and ball proxies expose native angular-momentum units. These changes are reproducible in `scripts/prepare-three-assets.py`; they do not simplify the scoring or mission rules.

The collision response adapts the native revision pinned by the reference WASM engine. Drag curves use VPX's per-control-point smoothing and adaptive subdivision. All collidable walls and ramps are exported, including zero-height and below-playfield surfaces beneath target slots, elevated walls and the original shooter deflector. Wall sides retain their full height; only ramp walls use the source height subdivisions. Caps use the native polygon tests, with finite edges and endpoint spheres. The playfield uses its actual 293-vertex mesh, holes and edge contacts. The ten other collidable primitives retain their original mesh transforms and material overrides. Their hit shapes stay baked when scripts animate their visual rotations, matching native behavior. Targets use the native mesh geometry, reflected rotation and material overrides; nonlegacy drop targets trigger from the front and complete their drop at the authored speed. Bumpers and slingshots use their authored forces and thresholds. A spatial grid limits collision queries to nearby geometry. The accepted wire-ramp model is unchanged.

Ball positions now accumulate as native Float32 table units before being published to Rapier and Three.js. Flipper angles and angular momentum also retain the native units and operation order, including finite contact recoil and stop rebounds. This matters at very small repeated collision times: rounding scaled render coordinates can change which impact is found next. The existing 70-sample coupled flipper/floor gate remains unchanged; the unloaded flipper recording now differs by less than .00005 degrees. Ball/ball resolution still uses Rapier.

The manual plunger now uses the authored geometry, pull acceleration, release speed, moving-tip collisions, momentum transfer, travel limits and spring rebound. Rod movement uses native float rounding, including pull, spring tracking and release. Lane balls remain dynamic; weak shots can roll back without being frozen or automatically launched. The shooter switch controls lane state. The separate auto-launch coil follows the authored nominal force and random variation. Focus/pointer cancellation returns the rod to park without crossing it and firing an interrupted gesture.

Spinners use native two-sided line crossings and height tests, ball-speed-driven plate motion, gravity, damping and actual revolution events. The former speed-derived spin count and delayed scoring queue are removed. The original plate mesh rotates around its axle. `vpx-spinners.json` contains ten independently started native recordings: both spinners, forward/reverse shots at several speeds, three-second coasting and overhead misses. Every score and authored spinner-count observation matches across 1,560 samples. Motion remains a separate measured difference: two driven cases stay within .001 degrees, while the largest remaining coasting error is about 5.8 degrees. Per-case regression limits retain these differences explicitly; this is not complete motion parity. Capture isolation disables other colliders through native GetElementByName and asserts every setter by reading it back.

Cabinet nudges use the native 25ms force envelope and calibrated side/front damped oscillators, projected onto the inclined playfield. They replace the old instant sideways/upward impulse. `node scripts/compare-vpx-nudge.mjs --check` compares three separately started native directions in `vpx-nudge.json`; a fresh engine for each capture avoids residual oscillation from a preceding nudge. `vpx-pocket-nudge.json` separately records a side nudge after the target/wire pocket has settled. Native and port make a small excursion and remain trapped; the functional test checks excursion and settling. Its original strict point-by-point diagnostic gate still reports later rebound differences. Native contact ordering is randomized even with all scatter disabled: two independent controlled captures differed by about .48 VPU after aligning their nudge callbacks. Diagnostic replays use a fixed independent random seed, without fitting it to native output. There is no automatic rescue or exemption from stall reporting.

The earlier three exterior rails and invented right-return guide have been replaced with the native four boundary lines, sloped glass polygon and infinite glass contact plane. `vpx-geometry.json` records independent native boundary, primitive and return-pocket shots with all table, material and object scatter disabled. Strict tests cover the top boundary, glass, camera and upper post; the later left-boundary interactions and deeply embedded return-pocket oscillation remain measured differences. Endpoint contacts now reproduce the native return-pocket containment instead of sending the ball downfield. `vpx-camera-animation.json` verifies that changing Camera1.RotY keeps the source collider fixed. Gate and kicker behavior, cabinet visual movement and physical tilt-bob simulation retain approximations. This is active port work, not a completed parity claim.

Resting balls also use the native 80/90ms position-history heuristic to reduce excessive spin while retaining ordinary free rolling. Repeated zero-time collisions use the native ten-event allowance and .2ms minimum advance. Persistent contacts retain the source randomized traversal direction.

This is not certified to reproduce VPX’s contact response, friction, ramp travel times or flipper tricks exactly. Headless desktop checks do not establish physical Android/iPhone frame rate. Physical device testing and shot-by-shot feel comparisons remain necessary before treating this branch as a replacement release.

Native comparison fixtures are in `three/tests/fixtures/vpx-motion.json`. Run `node scripts/compare-vpx-physics.mjs --check` to compare the full runtime's unloaded flippers against the recorded native simulation clock, including stop rebound and return. This gate covers these measured cases, not whole-table parity. Material overrides are resolved from the extracted materials, including velocity-dependent restitution. Ball/ball restitution is independently .8, surface friction uses the source coefficient, and artificial continuous rolling drag is removed. The authored per-axis speed control at 52 and vertical-spin factor .95 run every 10ms.

`node scripts/compare-vpx-contact.mjs --check` checks the raw contact baseline in `vpx-contact.json`: sliding, eight heel/tip shots and two cradle releases. Those early measurements selected an animation ball before the delayed playable ball existed, so authored ball controllers skipped it. The replay explicitly disables the port's rolling controller for that raw-physics comparison. These data do not establish playable-ball parity.

The corrected `vpx-playable-contact.json` waits for the actual plunger switch and asserts that the measured ball follows the three animation balls. It includes the active authored spin/speed controller and a controlled timer phase. Run `node scripts/compare-vpx-contact.mjs three/tests/fixtures/vpx-playable-contact.json` to report its differences. Some later shooter-feed contacts remain known divergences. `vpx-slot-back.json` uses the corrected playable-ball probe and confirms the native target/wire trap separately. The gameplay soak probe still reports that pocket as a stall; ordinary nudges do not reliably release it.

Nonlegacy drop targets also have a separate physical front hit shape, beyond the visible body. `target-contact.js` preserves its native triangles, endpoint contacts and shared edge IDs. The former sensor-only front missed those physical contacts, causing the wire-entry shot to escape hundreds of VPU downfield. `vpx-wire-entry.json` independently records its native path and first 70 millisecond states; tests verify the first displacement within .01 VPU and the complete recorded path within .5 VPU. Its deeply embedded start remains contained in native VPX, so the old assertion that it must escape has been replaced with floor-support and native-trajectory checks.

`node scripts/compare-vpx-heel.mjs --check` checks all 70 millisecond observations in `vpx-heel-milliseconds.json`, including a coupled floor/flipper impact near EOS that previously diverged at 47ms. An independent instrumented native table records actual timer clocks and delivers the input at exactly 23ms. The complete subsequent shot also has a separate comparison gate. Zero-time impacts still process contacts to cancel their incoming normal velocity, matching native behavior. The diagnostic generator flag `--instrument-timers` creates a separate table; it never edits the source table or the regular reference fixture.

`node scripts/compare-vpx-plunger.mjs --check` compares six live native pull/release recordings in `vpx-plunger.json`, including the actual input callback time and live rod position. The gates cover head movement and initial launch energy, including pulls too weak to launch. The complete trace retains later shooter-feed trajectory differences; this gate does not certify those downstream contacts.

Reference equations: pinned VPX [flipper dynamics](https://github.com/vpinball/vpinball/blob/195f214dd4849b8ef6113fd377258b78d0dec3bf/src/physics/hitflipper.cpp), [ball response](https://github.com/vpinball/vpinball/blob/195f214dd4849b8ef6113fd377258b78d0dec3bf/src/physics/hitball.cpp), and [collision shapes](https://github.com/vpinball/vpinball/blob/195f214dd4849b8ef6113fd377258b78d0dec3bf/src/physics/collideex.cpp). The reference probe records live native output; passing the general stability suite alone does not establish a VPX match.

## Rebuilding assets

The optimized assets under `three/public/` are included so a clean checkout can play and build without VPX, Blender or the original table. Rebuilding them requires the existing local extracted Finni table and tools:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-assets.py
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/export-three-model.py
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/prepare-three-audio.py
```

Audio encoding also requires ffmpeg on PATH. Preserve the original author attribution, permissions and asset/music/font credits recorded in the root README and `references/deadpool/VPX-SOURCE.md`. The upstream libraries retain their respective licenses: Three.js (MIT), Rapier (Apache-2.0), vbs-engine-js (MIT) and Vite (MIT).

The derived native physics modules and target mesh sources are GPL-3.0-or-later. See `public/licenses/VPX-Physics-NOTICE.txt`, the full GPL text and `references/vpx-physics/README.md` for attribution, corresponding source and the pinned upstream revision. Artwork, audio, fonts and third-party libraries retain their separately documented rights.

In an isolated worktree, `prepare-three-assets.py --source-root PATH --extracted-root EXTRACTION` reads Python dependencies from another checkout and table data from an explicitly selected extraction, while writing all generated assets into this worktree. Item filenames come from the extraction manifest, including sanitized punctuation. `appearance-overrides.json` retains the accepted insert polygons, toy positions and decorative streamer mesh independently of physical source data; it cannot introduce collidable objects. `native_source_order` records manifest provenance and does not claim to reproduce native broadphase traversal order. Normal builds need only the committed assets.

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
