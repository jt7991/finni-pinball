# VPX physics reference

The collision response and target geometry in the Three.js experiment derive
from Visual Pinball contributors' GPLv3-or-later sources at commit
`195f214dd4849b8ef6113fd377258b78d0dec3bf`, the revision pinned by
`@valknar/vpinball-wasm` 0.3.4.

The unmodified target mesh headers are retained here so the generated collision
geometry can be reproduced without fetching upstream files. See
`three/public/licenses/VPX-Physics-NOTICE.txt` and `GPL-3.0.txt`.

The current native contact work additionally adapts TriggerLineSeg,
TriggerHitCircle, Hit3DPoly, flipper face/end searches, Float32 vector response
and the HitLine3D cylinder transform. Binary primitive collision meshes can be
regenerated with `prepare-three-assets.py --vpx-source TABLE.vpx` and the
`olefile` Python package; the original VPX stays read-only. Visible GLB geometry
is independent of these collision assets.

`vpx-triggers.json` contains four independently started native circle/wire/overhead
recordings. Their sampled BallCntOver memberships must match exactly, with strict
early-position and velocity checks. Full floor-supported paths retain contact
phase variation. `vpx-shooter-feed.json` retains a complete native shot and 1ms
timer observations; its test checks the initial 184ms at .001 VPU/.00001 speed.
The subsequent curved-guide path is retained diagnostically and still diverges.
`vpx-shooter-guide.json` adds a separate 500ms native state trace. The strict
gate through 396ms covers the feed and first two guide impacts; the full trace
remains in `compare-vpx-shooter.mjs` diagnostics. The guide's blank physics
material uses VPX's zero-physics dummy material, rather than the wall's unused
elasticity setting. See `PinTable::GetMaterial` and `parts/Material.h` at the
pinned revision. This fixes the first large shooter-wall rebound difference.

`native-curve.js` retains Float32 Catmull coefficients, evaluation and adaptive
subdivision for walls, ramps and wire triggers. `native-ramp.js` retains source
miter intersections, wall joints/subdivisions, floor diagonals and underside
faces. Its collision shapes remain independent of the visible wire GLB.
Native ball momentum is preserved across Rapier orientation updates unless a
physical ball/ball contact actually requires adopting the Rapier result.

The camera reference gates now pass. The full suite still has four unchanged
failures: directional nudge speed, upper-ramp geometry contact, wire-entry path
and the old raw left-tip/floor recording. Native quadtree traversal and its
duplicate contact visits are not ported. Shrinking every mechanism's search
time in the existing grid order regressed the strict heel recording; query
limits must be integrated with the native traversal, not applied in isolation.

Native measurement fixtures include their source-table hash, controlled-table
hash and the exact comparison overrides. `scripts/prepare-vpx-contact-reference.py`
builds a separate table-scatter-zero table under this worktree's ignored `.work/`;
`scripts/serve-vpx-reference.py --metadata ... --port 0` serves that copy with
matching metadata. The original table is never changed.

The default flag leaves material and object scatter intact. Use
`--all-scatter-zero` for a separate reference with every material/object scatter
field disabled as well; its metadata records each original value. Geometry
recordings in `vpx-geometry.json` use this stronger control. The physics response
still randomizes persistent-contact traversal, so embedded pocket rebounds can
vary between independent native starts. Strict tests cover the measured top
boundary, glass, camera and upper-post shots; full diagnostic traces retain the
remaining left-boundary and return-pocket differences.

`vpx-camera-animation.json` adds `--geometry --case=camera-drop --rotate-camera`
to the native probe. The script sets Camera1.RotY=90 before releasing the ball.
Its physics still follows the baked startup collider, which the port preserves.

The nonlegacy front hit-plane constants from `parts/hittarget.cpp` are adapted
in `three/target-contact.js` under the same GPLv3-or-later license. The plane is
physical as well as event-generating, and shares native edge IDs with the body.
`vpx-wire-entry.json` is an independent all-scatter-zero instrumented capture
that exposed the missing shape. Its raw 1ms trace verifies the initial contact
displacement; the full path separately guards against the old downfield escape.

The corrected contact probe waits for the real plunger switch and verifies four
balls at selection time: three animation balls followed by the playable ball.
Earlier contact measurements selected an animation ball during startup. They
remain explicitly scoped as a raw-engine baseline; the authored ball controller
does not apply to that ball. The separate playable-ball fixture includes the
authored 10ms spin/speed controller and records unresolved contact divergences.

The separate `vpx-heel-milliseconds.json` fixture also records native timer
callbacks and ball state every millisecond. Build its diagnostic table with
`prepare-vpx-contact-reference.py --source-root PATH --instrument-timers`, serve
`.work/vpx-timing-reference/zero-scatter.vpx` with its matching metadata, then run
`check-three.py URL --native-contact --case=right-35-40 --exact-input-delay=23`.
The normal source and regular zero-scatter reference are untouched. The source
diff and table hash record the added observation/input code. STATE rows observe
the ball after the preceding millisecond's physics, before the current update;
linear/angular velocity fields are encoded as integers at 1e6 scale.

The trace identified skipped contact handling at zero-time impacts. Native
contacts still cancel their recorded incoming normal velocity at dtime=0. The
port now preserves this behavior through the coupled floor/flipper heel shot.

`vpx-nudge.json` combines three directions, each captured with `--nudge --case=...`
after a fresh native engine start. The default native cabinet model uses a 25ms
force envelope, separate side/front oscillators and acceleration projected onto
the playfield slope. The pocket fixture adds `--pocket --no-timer-trace`, waits
about one second through the native delayed callback, and retains the observed
input time. Both native and port remain trapped after the same side nudge.

The `slot-back` fixture records a target/wire pocket that also holds the ball in
native VPX. Keep this separate from port regressions. The randomized gameplay
probe still reports it as a stall; it has no blanket exception or automatic rescue.
