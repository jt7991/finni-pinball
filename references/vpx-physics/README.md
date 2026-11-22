# VPX physics reference

The collision response and target geometry in the Three.js experiment derive
from Visual Pinball contributors' GPLv3-or-later sources at commit
`195f214dd4849b8ef6113fd377258b78d0dec3bf`, the revision pinned by
`@valknar/vpinball-wasm` 0.3.4.

The unmodified target mesh headers are retained here so the generated collision
geometry can be reproduced without fetching upstream files. See
`three/public/licenses/VPX-Physics-NOTICE.txt` and `GPL-3.0.txt`.

`cvpmImpulseP.vbs` retains the unmodified impulse-plunger class from that
revision's `scripts/core.vbs`. `three/impulse-plunger.js` adapts the table's coil
ball dictionary, generated trigger/timer events, power and sound behavior.

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

The pinned wasm32 build uses scalar quadtree traversal, without the x86/ARM SSE
duplicate-visit behavior. `native-tree.js` now retains that scalar partition and
query order, including disabled shapes. `native-rubber.js` and
`native-target.js` retain source float mesh transforms; vertical posts use
HitLineZ instead of a slightly tilted generic cylinder transform.

The authored three physical animation balls are now restored. Their collisions
split time for every moving part. New `--all-ball-state` native captures retain
every body's exact initial float state; fresh raw-flipper and spinner fixtures
retain their existing acceptance limits and closely reproduce both trajectories.
The kicker fixture also checks exact sampled lifecycle, score and pocket count.
Older fixtures omit the hidden bodies' initial state and several gates currently
fail. They remain in the suite with unchanged limits. Ball/ball response now uses
native HitBall quadratic search and impulses, including frozen bodies, with a
separate scalar HitKD tree. Rapier's duplicate pair response is disabled. Five
independent native recordings verify head-on, oblique, vertical, embedded and
frozen-body impacts through the production simulation.

The camera mismatch exposed an inverted contact-order random branch, now fixed.
A separate instrumented native table records actual MWC64X state through read-only
WASM memory observation at native debug markers. The compiled engine hash and
global-load instructions verify the state address. `vpx-camera-native-state.json`
retains every body, source position-history slots and random-state observations.
Replay seeds once from the first observed frame, then audits every subsequent
state without reseeding. Position, speed and spin match all 387 millisecond
observations at .001 VPU/.00001 speed/.00001 angular velocity. Source uint64 MWC64X
arithmetic and both float mappings are independently tested. Remaining plunger,
switch, spinner/gate, wire-entry and older raw-flipper comparisons still fail;
complete gameplay parity remains unfinished.

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

`vpx-bumpers-native-state.json` records fourteen isolated bumper scenarios:
three approach speeds at each bumper, live threshold/force/HasHitEvent/Collidable
changes, and a second strike within 100ms. The authored bumper callbacks remain
active. `native-bumper.js` follows `BumperHitCircle::Collide` in `collideex.cpp`:
the force adds velocity independently of mass, and HasHitEvent controls both
the kick and event. There is no invented scoring cooldown.

Reproduce the separately instrumented table with
`prepare-vpx-contact-reference.py --source-root PATH --output-root NEW_PATH
--all-scatter-zero --instrument-timers --instrument-ball-trails --instrument-rng
--instrument-bumpers`, then use `check-three.py URL --native-contact --bumpers
--all-ball-state --ball-trails --rng-state --native-internals --no-state-trace`.
Never regenerate a table while a reference server is serving it. The replay is
`node scripts/compare-vpx-bumpers.mjs three/tests/fixtures/vpx-bumpers-native-state.json --check`.

The read-only observer validates the pinned WASM checksum and HitBall self
pointers before reading position, velocity, angular momentum, collision gap,
event history, pointer order and the ball-collision swap phase. This is observed
initial state, not a fitted seed or a runtime physics override. Native diagnostic
CStr output can lose the exponent of tiny floats; validated memory snapshots
retain those values. Dense observations are hashed in the fixture metadata;
the committed fixture retains initial snapshots and every physics RNG word.

Pitch variation in native `audio/SoundPlayer.cpp` consumes two draws from the
same MWC generator used by physics. The rules bridge preserves those parameters
even without an attached audio player. The browser uses original WAV sample
rates from the manifest when applying pitch offsets after device resampling.
The six script Rnd outputs in each authored bumper shake are separately observed
and replayed only within that callback. The fourteen cases reproduce 1,454
observed physics frames, exact callback clocks/scores, and sampled trajectory
errors below .0001 VPU / .000001 velocity / .000001 angular velocity. This does
not establish parity for other mechanisms or complete gameplay.

`vpx-slingshots-native-state.json` adds eighteen slingshot recordings across
both sides, three positions on the active segment, two approach speeds, live
Disabled/SlingshotThreshold settings, and Collidable=False. Add
`--instrument-slingshots` to a fresh diagnostic table and capture with
`--slingshots --all-ball-state --ball-trails --rng-state --native-internals
--no-state-trace`. The script RNG observer preserves the authored shake calls.
Run `node scripts/compare-vpx-slingshots.mjs --check` for the committed replay.

The native response boosts velocity inward before wall reflection; Disabled
and the threshold suppress this boost and event while preserving the wall.
Callbacks run during collision, with native position-based repeat suppression,
and start the original animation timer and scoring handler. Disabled is wired
to the authored DisableTable routine. Rapier no longer emits an additional
slingshot scoring callback in native mode. The native source's SlingshotStrength
setter updates its stored setting without replacing the already-built segment
force; this change does not invent live strength behavior.

These eighteen runs retain all 1,821 observed physics RNG states. Dense
read-only memory comparisons found zero position difference for all four balls
at every observed frame, velocity difference below 2e-9, and momentum difference
below 4.8e-7. Committed public position samples use a .001-VPU bound because
native CStr rounds positions around Y=1500 to that precision; callback velocity,
sampled velocity and angular velocity keep .000001 bounds. Other parity failures
remain independently enforced.

`vpx-flipper-events-native-state.json` records twenty-four flipper scenarios:
heel/middle/end face impacts at two speeds on both sides, rounded-tip impacts, base-circle Hit
events, quiet rebounds, moving strokes and repeat impacts below/above the
native idle threshold. Build a new diagnostic table with
`--instrument-flippers --instrument-ball-trails --instrument-rng
--all-scatter-zero`, then capture with `--flipper-events --all-ball-state
--ball-trails --rng-state --native-internals --no-state-trace`. The observer
retains the original Collide handler and adds an observer for the previously
empty base Hit handler. Run `node scripts/compare-vpx-flipper-events.mjs --check`.

Native `HitFlipper::Collide` computes the speed argument before response and
fires the callback after applying the impulses. A qualifying impact needs
normal speed above .25 and more than 250ms since the last resolved collision
on that flipper. Every resolved impact renews that clock, including quiet
collisions and hits from another ball. Base-circle hits use Hit; face and tip
hits use Collide(speed). Collide follows FireVoidEventParm, bypassing collection
FireGroupEvent suppression. The port now dispatches this in the native solver
and suppresses the duplicate Rapier flipper sensor event.

The moving-stroke recording also exposed approximate snapping in the angle
reported to the rules. `Flipper::get_CurrentAngle` multiplies the native radians
by the Float32 degrees conversion; it does not snap angles near the stop. This
matters to the authored exact-equality EOS/live-catch timer. The port now uses
that conversion. Initial solenoid input precedes restoring the first observed
physics RNG state, because its sound already consumed the native draws at the
recorded clock. All twenty-four cases retain all 4,812 observed RNG states,
callback times/arguments and trajectories within .001 VPU / .000001 velocity
and angular velocity. The position bound reflects native CStr precision.

`vpx-material-events-native-state.json` adds seventeen wall/primitive/rubber
recordings. Build a separate table with `--instrument-materials
--instrument-ball-trails --instrument-rng --all-scatter-zero` and capture with
`--material-events --all-ball-state --ball-trails --rng-state --native-internals
--no-state-trace`. The observer prepends logging to the original sound collection
handlers, retains their bodies, and observes previously empty Camera1/Camera2/
Rubber001 Hit handlers. Run `node scripts/compare-vpx-material-events.mjs --check`.

Native Surface sets event flags on its components, but their collision classes
decide whether to dispatch: vertical faces, vertical corner lines and points
can fire Hit, while horizontal 3D edges and polygons with eNull cannot. Primitive,
rubber and ramp components use ePrimitive, enabling triangle/polygon/3D-edge
events as well. Rubber's threshold is hard-coded to 2. Primitive HitThreshold
updates before native rest-event filtering, only for the relevant collision
classes. HasHitEvent and Threshold setters change stored settings without
rebuilding these colliders; the initial event metadata remains baked. Collidable
still updates the actual collision components.

`native-hit-event.js` preserves those rules and NativeBall's shared per-ball
last-event position and squared-travel filter. Dispatch runs after reflection
at the collision clock with the correct ActiveBall. This restores the authored
rubber collection sounds and the three long-band 110-point awards. The replay
checks sound names/times, post-response volume/pitch, scores, callback velocity,
primitive HitThreshold and all 1,739 observed physics RNG frames. Dense native
memory replay had zero position difference across all four balls and velocity
difference below 2e-9. Quiet hits, silent wall tops/edges, active corner points,
disabled colliders and a temporarily enabled native 3D rubber are included.

The accepted mesh/physics numbers are retained. The asset generator now includes
hit_event/threshold metadata. `prepare-three-event-metadata.py --source-dir
EXTRACTED_GAMEITEMS` updates just that metadata for existing accepted assets,
without regenerating geometry. The reference helper also zeroes scatter on the
Rubber array when a diagnostic fixture declares allScatterZero.


`vpx-spinner001-forward-native-state.json.gz` adds a complete independent
Spinner001 strike/coast recording. All four balls' position, velocity, angular
momentum and orientation match at every one of2970 physics frames; all11880
body observations, both RNG streams, four rotations and source scores agree.
Run `node --test three/tests/native-spinner-state.test.js`.

Capture the pinned script/RNG-instrumented reference with `--native-contact
--spinners --case=Spinner001-forward-12 --all-ball-state --ball-trails
--rng-state --native-internals --plunger-state --script-rng-state
--trace-ms=250 --no-state-trace`, then use
`prepare-native-spinner-fixture.mjs CAPTURE OUTPUT.json.gz`. The compressed
fixture retains the raw capture digest and strict complete-body/RNG gates.
No measured state is injected after initialization.

The ten recent trail slots and their native clock are essential diagnostic
inputs. A capture without trails matched the measured ball but diverged in
another ball's spin at21ms and physics RNG at132ms. Recording/restoring the
actual history removes those differences without a physics implementation
change. Old partial-state recordings and their seven failing suite gates
remain unchanged; this additional complete recording does not declare them
resolved or relax their limits.
