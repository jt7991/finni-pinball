# Native renderer integration checkpoint

This is development evidence for the full port. `three/scene.js` now loads the
complete original basic geometry instead of the joined GLB: 682 meshes include
558 main-view parts and 124 reflection-only wall bottoms. Six source flipper
parts and 25 classic inserts retain their separate native paths. The original
open wire ramp geometry, main arcade UI and lossless source artwork are retained.
The shared transmission/bloom temporary buffer follows the source reuse path.
The final whole-frame comparison and seven older physics comparisons remain
unfinished. The full suite passes 179/186 tests.

The actual scene now runs source planar reflections with D16 depth, native
transmission, target/gate/spinner/trigger/bumper vertex updates and all 57
source-generated plunger mesh frames. `native-opaque-cache.js` caches color and
depth together and invalidates on camera, viewport, vertex, transform or
visibility changes. Fourteen browser scenarios, including three real game balls
and all 25 classic inserts lit in four cameras, match uncached rendering across
60,942,960 HDR RGB samples, with no differences
or GL errors. This is a cache equivalence test, not a whole-frame VPX comparison.

Trigger and bumper animation matches 89 updates of the original compiled
engine. All 154,240 observed skirt vertex fields and 269 original Float32 atan
results match. The full table's 25 lossless images match 147,945,552 native GPU
RGBA bytes. Original shader bytes and all source vertex/index bits are retained.
The complete table mesh compresses from 12,630,508 to 3,142,237 bytes with gzip.
The static server allows compression of this larger mesh; it does not lower
texture quality or quantize geometry.

`native-ball-render.js` now runs in the actual scene. It uses the original
181-vertex sphere, 960 indices, native scratch/environment textures, compiled
ball shaders and a 256-byte matrix block. Eight independent main/reflection
packets match all 512 block fields and 864 ordinary uniform fields. GPU output
matches 101,400 HDR RGB samples; all 1,056,768 uploaded texture bytes match.
The GPU component test supplies native orientations and a synthetic previous
frame as explicit shared inputs. Neither is published as runtime data.

Live rendering receives original Float32 orientation matrices and native
positions for all physical balls through the worker, including the three
bobble balls under the apron. A six-ball browser check reads actual GL uniforms
and verifies each ball's orientation/color, source visibility and reflection
eligibility. Ball parts share one compiled material and stream their state per
draw; new balls do not need fresh shader compilation. The previous HDR frame
copies without changing any half-float bits. Submission-time ball calculation
is now checked separately below. Hardware presentation timing, anti-stretch,
trails and whole-frame VPX equivalence remain unverified.

All 63 source flashers now run in the scene. Their independent ownership capture
reveals hidden variants and restores every original visibility flag.
`native-flasher-mesh.js` reproduces all 2,016 position/normal/UV fields bit for bit
from authored control points, source rotation order and wrap/world UV rules.
Original compiled shaders match 1,008 camera fields, 945 ordinary uniform fields
and 317,709 HDR RGB samples. GPU copies from the existing DMD atlas match 142,688
RGBA bytes across 13 native uploads, including transparent RGB. Runtime assets
contain fixed artwork and source image names, not captured camera/state packets.
The original dispatch independently verifies 46 setter/getter conversions.

The live transparent queue matches the complete 234-draw native sequence:
63 flashers, 133 halos, 17 bulb glass parts, 17 bulb emission hulls and four wall
parts. Source depth and authored submission order drive sorting; captured draw
indices are test evidence only. Walls with an alpha top retain native dynamic
classification even when their side draw disables GL blending. Twenty-five
classic inserts now run in the native opaque pass despite additive GL blending.

Their original compiled shader and 25 native lightmap meshes replace the
approximate batched shader. All 2,000 matrix and 1,075 static material fields
match native packets. One hundred controlled on/fade/color/hidden cases match
504,300 HDR RGB samples; the combined 780x1532 component image matches 3,584,880.
The pinned reference engine uploads invalid dynamic classic-light vectors,
confirmed again by a fresh capture. The fixture retains those rejected fields;
runtime state follows source Light properties and animation. Controlled valid
inputs are shared only in the component comparison. Actual native dynamic
insert-packet parity remains unproven.

`native-samplers.js` uses GL sampler objects for per-draw filtering and wrapping,
allowing one uploaded image per source texture. All 25 table images are present
as 25 distinct live GPU textures. The old 27 parameter-specific copies consumed
74,547,200 additional base-level bytes. Primitive, world, mechanism, reflected
and playfield component references retain independent textures with the original
sampler parameters; expected samples and zero-difference gates are unchanged.
Older isolated mechanism assets gain authored source order for alpha ties;
the reflected reference composite follows its independently captured draw order.

The restored bulb emission hulls use the original compiled LightShader and
geometry in both main and reflected views. All 986 uniform fields and 171,462
HDR RGB samples match 34 native packets. All 133 halos now use their original
lightmap vertex/index buffers, source matrix upload and compiled shader. Seven
authored lights use the original raytraced-ball-shadow program. Independent
native packets match 4,081 uniform fields and 670,719 HDR RGB samples. Captured
attract-mode colors and ball positions are explicit shared component inputs;
they are excluded from runtime assets. A live six-ball check reads all seven
shadow draws and verifies exact creation-order positions and hidden-ball
omission. Ball submission timing is checked separately below; synchronized
shadow/body submission timing remains unverified.
Cached and uncached rendering continues to match across all eight scenarios.

The ownership audit covers 650 authored renderable objects. All 589 BasicShader
draws in the independent frame with revealed sling variants have exactly one
resolved owner. Twelve shared geometry digests are disambiguated by native
world matrices. This covers the basic geometry pass; ball and flasher component
evidence is described above. Final whole-frame comparison remains outstanding.

Reference engine: `c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8`.
Source revision: `195f214dd4849b8ef6113fd377258b78d0dec3bf`.
All generation and browser checks run in the physics worktree. Main is read only.

## Components

`three/native-basic-render.js` renders the original BasicShader programs with
the original native attributes, texture/sampler states, and source-derived
matrix packets. One streamed uniform buffer handles many parts without
exhausting Three's uniform-group binding slots. Hidden parts are compiled using
visible proxies before rules can reveal them. Screen dimensions update with
the viewport. Unsupported normal-map/refraction paths fail explicitly. Authored planar probes require their rendered texture.

`scripts/publish-native-render-parts.mjs` publishes selected verified parts and
their required shaders/textures. Camera uniforms and captured ball positions
are removed. Projection and screen uniforms come from the current camera.
The native geometry codec uses integer prediction and byte planes without
changing any float or index bits. For the five actors it reduces the gzipped
geometry from 2,397,965 to 1,674,634 bytes. Production asset hashes are checked
again after decoding in the live scene.

`scripts/test-native-actors-browser.mjs` drives the actual worker's script
properties and reads the GPU uniform buffer immediately before each real scene
draw. All 800 uploaded main/reflection fields match independent VPX packets; visibility changes
hide all five meshes and each source name occurs once. A default short-window
case also covers the main UI's collapsed start-screen canvas. It uses the
backing buffer camera until ResizeObserver receives visible dimensions.

`three/transmission-render.js` renders the eight transmitting bulbs and both
original 19x19 Gaussian shader programs. It derives camera matrices, light
vectors, and scissor rectangles from the authored data. It preserves the blur
temporary buffer outside the area of interest, matching `DrawBulbLightBuffer`
and `RenderPass::Execute`. The live frame pipeline now shares these same two
buffers with bloom, as VPX does. Bloom's full-target writes become the next
frame's retained transmission blur history.

The transmission comparison explicitly supplies the captured previous blur
buffer and live colors as test inputs. Previous buffer contents, live colors,
held poses, native matrix packets, and reference output pixels are never
production assets. This component result does not establish full-frame parity.

`three/native-postprocess.js` replaces the approximate final frame shader with
five active source passes: dynamic AO, bloom cutoff, horizontal and
vertical 39x39 Gaussian blur, and Reinhard tone mapping with dither and the
authored 256x16 color-grade LUT. AO retains two full-size R8 history targets;
bloom uses the transmission targets at quarter resolution. The shifted cutoff
UVs, original fullscreen strip vertices, per-draw sampler objects, Float32 frame
jitter and GLES minimum-magnitude upload rule are preserved.
Two further live frames verify that the exact bloom temporary target becomes
the next transmission pass's incoming history, including nonzero values outside
the light scissor that remain bit-identical after the clipped blur.

An isolated native observer records intermediate buffers without replacing any
native draw. A separate depth-sampling shader saves/restores GL state and uses
an explicit complete nearest sampler. The first depth-reader attempt inherited
an incomplete texture sampler and returned zeros; that diagnostic is rejected.
The accepted capture asserts nontrivial depth. One pre-existing GL error before
observation is retained separately, as in the earlier component captures.

`FrameIndex` is read synchronously through native ScriptGlobalTable at actual
AO/tonemap draws. There is no phase search or inversion of jitter values. The
committed fixture checks 64 uploaded vectors over 32 consecutive observed
frames, original fullscreen vertices, and shader/noise/LUT hashes. Native frame
indices are explicit component inputs; production increments its own rendering
counter before postprocessing, following Player::PrepareFrame.

The five-pass browser comparison has zero differences across 1,194,960 AO
values, 672,165 bloom/blur HDR values and 3,584,880 final RGB bytes. The actual
native HDR/depth frame and previous AO history are supplied once; no computed
intermediate output is corrected. This proves postprocessing equivalence on
that supplied frame, not complete live-scene or presentation-time equivalence.
Only immutable shader programs and static AO noise/LUT texels are published;
captured frame/depth/history/output images remain outside production assets.

The twelve cached/uncached scene comparisons retain all 43,018,560 sampled
values and their zero-difference gates. Each cache mode now receives identical
incoming bloom/transmission history. Comparing successive frames without this
restoration correctly observes changing feedback, rather than isolating the
cache. Production history is never frozen by this test change.

Run `check-three.py NATIVE_URL --native-postprocess`, then
`prepare-native-postprocess.mjs`. Capture `--native-nudge-render` and run
`prepare-native-nudge-render.mjs` before `publish-native-postprocess.mjs`. Run
`check-three.py THREE_DEV_URL --postprocess-render` for the framebuffer check
and `node --test three/tests/native-postprocess.test.js` for the retained
clock, geometry and source-asset regressions.

The runtime now carries cabinet displacement in native metres through the
worker. `Renderer::SetScreenOffset` scales it by the pinned visual strength,
rotates into viewport coordinates and shifts the final quad. Any nonzero
source offset selects the original filtered Reinhard program, including its
half-texel UV offset and linear frame sampler; a settled cabinet selects the
original unfiltered program. The six compiled programs therefore still produce
five active passes. Source clipping behavior and framebuffer history remain
intact; the scene geometry and collision world are not translated by this path.

The nudge observer discovers CabinetPhysics using its immutable mass, oscillator
frequency, spring and damping fields, then validates vector layout and the
native getter's exact return pointer. Vertex2D's alignas(8) padding is included.
A typed WASM dispatch wrapper calls the original GetCabinetOffset and returns
its pointer unchanged while reading the actual position and activation counter.
It writes no body, RNG, timer or cabinet state. This proves the state used when
VPX selects its screen offset, rather than substituting the later draw-time
GameTime. The public-clock-only and rejected unaligned-ABI diagnostics remain
separate from the accepted capture.

The three directions retain 270 native cabinet states and 5,400 fullscreen
vertex fields with zero differences. The shifted/filtered framebuffer check
also matches all 5,452,005 intermediate/final channel values, using the observed
cabinet counter and FrameIndex as explicit inputs. The prior output target is
supplied once because a shifted quad can leave edge pixels uncovered. Captured
positions, clock values and framebuffer data remain test evidence only.

An actual worker-driven Nudge reproduces the same native displacement and real
quad, selects the filtered pass, then returns to zero/unfiltered after the
source ten-second activation interval. The ordinary unshifted comparison still
passes unchanged. The reference INI leaves BallAntiStretch/BallTrail empty;
the pinned Settings_properties.inl defaults are both false. NudgeStrength and
KeyboardNudgeStrength default to one, with the CabModel mode selected. Those
source defaults are recorded with their pinned Git blob digest.

Run `node --test three/tests/native-nudge-render.test.js` and
`check-three.py THREE_DEV_URL --nudged-postprocess`. The live worker check must
pause through the actual Controls popover, since the page's frame loop owns its
pause state. A stale long-running Vite module cache initially served the old
snapshot without cabinetOffset; restarting only that worktree dev server fixed
the diagnostic environment. Production builds contain the new snapshot field.

`check-three.py PRODUCTION_URL --production-nudge` verifies actual keyboard Z
input through the shipped shared UI, authored rules and worker, without a game
debug hook or direct script/state injection. Phone and desktop viewport runs
each observe 598 filtered frames, motion in both directions and natural return
to the original unfiltered quad. These are desktop browser checks at those
viewport sizes, not physical-phone certification.

## Verified results

| Comparison | Cases / samples | Differences |
| --- | ---: | ---: |
| Primitive matrices | 118 × 80 fields | 0 |
| Primitive HDR fragments | 595,074 RGB samples | 0 |
| All primitives together | 151,200 RGB samples | 0 |
| Wall/ramp/rubber matrices | 366 × 80 fields | 0 |
| Wall/ramp/rubber HDR fragments | 1,845,738 RGB samples | 0 |
| All world parts together | 151,200 RGB samples | 0 |
| Native bulb transmission output | 224,055 RGB samples | 0 |
| Encoded world texture GPU uploads | 121,907,280 RGBA bytes | 0 |
| Encoded primitive texture GPU uploads | 22,282,240 RGBA bytes | 0 |

The 366 world draws include all six initially hidden sling rubber variants.
Individual and combined draw tests compile every part while hidden first.
Material comparisons use identical explicit black transmission inputs on both
sides; transmission has its own independent native framebuffer comparison.
The native capture records one pre-existing GL error before its first observed
draw. The observer and Three component passes report no GL errors.

The world texture image files total 8,893,024 bytes; primitive images total
172,034 bytes. They use lossless WebP with transparent RGB preserved.
`createImageBitmap` disables color conversion and premultiplication. Every
uploaded GPU byte is hashed against the native RGBA upload, independently of
the material comparison. No texture quality reduction is used.

## Development commands

The generators consume isolated native captures and extracted source data in
`.work`; these are development inputs, not dependencies of the current game
build. Capture files must have completed restoration and contain no observer
errors. `prepare-native-draw-owners.mjs` associates geometry by vertex/index
digests, records native transforms for shared-geometry diagnosis, and rejects
duplicate owner entries. Numeric draw IDs are local to each capture.

1. Generate primitive, world, and transmission assets with
   `prepare-native-primitive-visuals.mjs`, `prepare-native-world-visuals.mjs`, and
   `prepare-native-transmission.mjs`.
2. Run `prepare-native-texture-images.py` into separate output directories.
   It verifies every decoded byte, including RGB under zero alpha. Use
   `--pillow-root` when Pillow is provided by the local tools directory.
3. With Vite running, use `scripts/check-three.py` with `--native-primitives`,
   `--native-primitives --world-geometry`, `--native-textures`, or
   `--transmission-render`. `--asset-directory=...` selects the lossless
   primitive/world candidate. Texture validation also accepts
   `--metadata=native-primitives.json`.

These are isolated headless Edge checks, not physical-phone certification.
The main UI stylesheet blobs and accepted open wire ramp GLB remain unchanged.


## Planar reflection and playfield components

The planar pass is implemented and independently checked, but is not yet wired
into the running table. `native-reflection.js` follows native Float32 matrix,
normal and projected-bounds calculations. `reflection-render.js` renders a
full-resolution HDR/depth probe, reverses raster culling without changing
material normal defines, and restores Three's cached GL state afterward.
It clears the whole target before clipping draws to the receiver's projected
local bounds. At the native 780 by 1532 test viewport that scissor is
`33,75,713,1187`, matching the independently recorded GL state.

`prepare-native-probes.py` reads authored RPRB/PLST records directly. The
playfield strength is decoded from byte51 using the native Float32 multiply;
it is `0.20000001788139343`. The playfield's original local mesh has293vertices
and1017indices, and uses its authored size100 world matrix. Its vertices match
the native GPU digest. Treating it as already transformed world geometry is
incorrect.

`prepare-native-reflection-fixture.mjs` emits separate independent reflected
matrix/cull packets. All116 reflection-enabled primitives match9280 uploaded
matrix fields; Screw013 and Screw018 remain excluded by source settings.
The GPU comparison covers584988 individual RGB samples and151200 combined
samples, with zero differences and no GL errors. It also verifies return to
all independent main-view packets and restores the material setter/sides.

`prepare-native-playfield-visuals.mjs` exports the local source-owned mesh,
original reflection-capable shader and lossless playfield texture. Its isolated
GPU check matches3584880 RGB samples,80 matrix fields and4 mirror fields.
The native HDR reflection image is an explicit test input in a separate
`reference-reflection.bin`; it must never become a production asset. This
checks receiver geometry/material/sampling, not the whole reflected scene.

Run `scripts/check-three.py` with `--reflection-render` or `--playfield-render`
after preparing the respective `.work` assets. The CPU reflection fixture is
checked by `three/tests/native-reflection.test.js`. Existing live actor GPU,
118-primitive material, camera and flipper render regressions still pass.
Full static geometry, animated mechanisms, ball/flasher shaders, the shared
transmission/bloom pipeline and scene integration remain unfinished.


## Reflected world and remaining basic geometry

`prepare-native-reflected-world-visuals.mjs` adds124 original bottom wall caps
to the366 verified world draws. It associates each cap with a source-owned top
using the native Surface index-buffer relationship within one capture, and
rejects ambiguous matches. Shaders and textures are matched across captures
by content digests. The bottom caps are reflection-only. The434 enabled
reflected world draws match2188662 individual and151200 combined RGB samples,
all uploaded matrix fields, and the independent main-view return. All124 caps
are hidden when the main camera returns. This is a component comparison with
an explicit black transmission input, not a full reflected-table comparison.

`prepare-native-mechanism-visuals.mjs` exports73 remaining source-owned basic
draws: targets, gate brackets/wires, spinner plates, bulb/socket bodies,
bumpers, trigger wires, plunger and procedural Primitive15. Main-view tests
match368139 individual plus151200 combined RGB samples;72 reflected draws
match363096 individual plus151200 combined samples. Matrix and screen fields
match, with no shader or GL errors. These held-rest checks do not validate
mechanism animation. The14 lossless images total490246bytes, and all8605696
native RGBA upload bytes also match after GPU upload.

Use `--native-primitives --mechanism-geometry` for main-view checks and
`--reflection-render --world-reflections` or `--mechanism-reflections` for the
additional reflected geometry. These parts are now connected to the actual
game with original animated vertex paths; the GLB is retained only for comparison.
The native reflection flags exclude both textured flipper tops, while keeping
the base/rubber parts; returning to the main camera restores both tops.

`native-target-render.js` reproduces original stand-up vertex updates using
the unposed template from the pinned native header. All11 initial GPU buffers
match byte-for-byte, including signed zeros and UVs. All four native animated
poses for each target match independently compiled Float32 position/normal
values. The older JSON pose fixture loses signed zero, so that comparison
normalizes zero signs only; the independent initial GPU digests do not.
GenerateMesh and UpdateTarget(offset0) have distinct rounding orders, exposed
by Target014 and preserved separately. Live native target meshes update through
this path, including revision tracking for an initial zero-offset update.

Ball submission timing now has independent native evidence in
`vpx-ball-presentation-native.json.gz`. The capture wrapper calls the original
pinned function2531 (table index6514) unchanged and observes actual SDL clock
imports, physical position/velocity, scheduled rotation/scale, last-step time
and the resulting ShaderState matrix. It performs no body, clock or RNG writes.
The three captures cover moving balls, a locked kicker ball and a defocused
window: 192 callbacks / 3,072 matrix fields match bit for bit. All 189 GPU
uploads retained within the complete callback observation window independently
match an observed native callback result (3,024 fields).

`ball-presentation.js` follows the source Float32 arithmetic, including
velocity units, locked-ball height and GLES matrix clamping. The pinned SDL
backend falls back to integer Date milliseconds and a 1 MHz counter. Source
Window/RenderDevice defaults supply adaptive sync, 60 Hz and a zero initial
present reference. The worker records actual wall time at the start of each
physical step; publishing a snapshot does not advance that timestamp. The
renderer reads its own current wall clock twice as the native callback does.
Pausing/defocusing disables the correction. No recorded phase, lag, body state
or orientation is shipped as runtime data.

Reproduce with `scripts/check-three.py http://127.0.0.1:50826/
--native-ball-presentation`, adding `--locked` or `--defocused` for the other
captures; then run `node scripts/prepare-native-ball-presentation.mjs`.
`node --test three/tests/ball-presentation.test.js` checks the native fixture.
`scripts/check-three.py http://127.0.0.1:5173/three/ --ball-presentation`
checks actual six-ball GPU uploads, active/paused behavior, worker timestamps
and unchanged physical body state.

The render protocol now separates preparation from the later physical read.
`prepareSubmissionFrame` retains the scheduled ball identities and holds
incoming scene snapshots while the worker returns newer position/velocity
data and its corresponding actual last-step clock. Scene and ball rotation,
visibility, reflection eligibility and light state stay prepared. Removed balls
retain their final state, matching source Ball references; later births wait
for the next frame. Replies remain queued with their snapshots so a resolved
command cannot expose unapplied state. Disposal releases the hold.

Native `RenderFrame::Execute` runs all begin-of-frame callbacks before GPU
passes. The live renderer now computes separate reflected/main ball submission
matrices at that point, then uploads them unchanged at their actual draws.
The pinned source file has Git blob SHA1
`b95ced53e012d12f8b8f98a7e9374db4c61a0379`:
https://github.com/vpinball/vpinball/blob/195f214dd4849b8ef6113fd377258b78d0dec3bf/src/renderer/RenderFrame.cpp

Four protocol regressions cover later physical motion with unchanged scheduled
orientation, retained kicker removal, later births, read-only physical/RNG
state, ordered command replies, disposal during preparation, and queued
game-over/replay. A real six-ball
GPU check verifies prepared matrices, newer worker bodies and the exact clock
associated with that physical read. The fixed fallback profile and worker
message latency do not establish hardware/VR presentation or physical-phone
input timing. Older physics failures, dynamic native insert packets and
synchronized whole-frame equivalence remain open.

A further read-only capture exposes the current physical orientation at the
original callback, separately from its captured rotation/scale. All64 callbacks
retain a different earlier rotation (574 Float32 fields differ); their original
submission matrices still match all1,024 fields using the scheduled rotation.
Capture with `--spin --output-name=native-ball-scheduled-rotation.json`, then run
`node scripts/analyze-native-ball-scheduling.mjs`. The explicit spin is a test
input. A pre-callback ShaderState orientation is a zero placeholder in this
build, so it supplies no evidence of the earlier physical position. This
diagnostic establishes why the stages must stay separate; it does not recover
the earlier native physical position or prove synchronized whole-frame output.

The first whole-table control uses the original native renderer at780x1532,
with all timers disabled through GetElementByName, sequencers stopped, bulb
lights on, classic inserts explicitly hidden, and physics defocused. It
observes3,041 properties on733 objects and four physical ball poses, plus
previous HDR, AO and filtered transmission-buffer history. Four additional
requests address FinniStreamerRamp, an unused port placeholder absent from the
native table; it has neither a native mesh nor a collider. No rendered object's
missing input is silently accepted. Original GPU pixels remain expected outputs,
never production textures or per-pass corrections.

This exposed the authored backdrop missing from both the port's scene clear
and its opaque cache. Renderer::DrawBackground uses m_colorbackdrop and
RenderCommand normalizes its ARGB bytes directly before clearing; it applies
no sRGB conversion. native-lighting.json now includes the authored #090f22.
The cache retains the caller's clear color/alpha and invalidates when either
changes. The observed native RGBA16F background matches all four channels.

The same control exposed one D16 depth tie between LilRightArm and its fixed
torso Primitive077. Rendering the torso from the cache reversed their original
order and changed three HDR channels, then684 bloom and28 final channels.
The existing actor assembly descriptor now keeps all its parts in the live pass.
With identical scene/history inputs, cached and uncached HDR, reflection,
bloom and final RGBA now agree exactly. The observed native pose is retained
in vpx-actor-cache-pose-native.json. All original twelve cache scenarios remain;
new clear-state and full-resolution actor cases raise the total to14 and
60,942,960 compared HDR RGB values.

For control-r3, the authored background reduces native-versus-port HDR
differences from712,650 to14,463 of3,584,880 channels. Final RGB differences
fall from739,889 to17,224. The remaining3,336 depth pixels and81,016 reflected
RGB differences are retained, not accepted as parity. These are a frozen,
unlit-classic control with selected shared history; ordinary lit scenes,
unobserved mechanism poses and remaining temporal dependencies still need
comparison. In particular, native reflection draws precede transmitted light
and use both null and prior shared-buffer bindings. The live pass sequence
has not been changed to guess at those dependencies.

Reproduce a new control with:

```powershell
python scripts/check-three.py http://127.0.0.1:50826/ --native-whole-frame --capture-name=control-next
node scripts/prepare-native-whole-frame.mjs .work/three-review/native-whole-frame-control-next
python scripts/check-three.py http://127.0.0.1:5173/three/ --whole-frame-render --capture-name=control-next --report-name=current --compare-cache
```

Use this workspace's bundled Python on Windows if python is not installed.
The capture refuses to overwrite existing evidence. Whole-frame diagnostics
assert the native background and cache equivalence; they report all remaining
scene differences without presenting them as a passing whole-scene comparison.

## Native prerender composition

The later control-r6/r7 render-all comparisons match all color, alpha and depth
outputs with common observed scene/body/history inputs. Their original gates
remain intact and passing. That mode explicitly disables native prerendering
and hides the 25 classic inserts in both scenes.

Normal-mode static composition is now connected separately. Two unchanged
startup captures retain the complete native static draw states: 493 main and
563 reflected draws, associated uniquely through original GPU mesh hashes and
authored world transforms. Source classification covers all 615 static parts.
Runtime proxies share the original table geometry and GPU image storage, with
the original source samplers. Neither camera packets nor expected images enter
runtime assets. Independent Gaussian sample calculations and original shaders
produce identical full-size RGBA16F accumulated colors and centered D16 depth.
RenderProbe clips its final color blit to the computed playfield area, leaving
the centered sample outside it; clipping every sample instead is incorrect.

The ordinary frame now copies these static color/depth buffers and draws live
objects. The static playfield contributes through its original additive
reflection-only shader. Independent Balanced and Top-down captures retain the
native prepass and supply actual scene/body/history inputs. With classic
inserts explicitly hidden in both scenes, all HDR, reflection, bloom, final
RGBA and depth values match exactly, including cold/reused-buffer comparisons.
The source reflection pass in this mode binds an observed 1x1 black transmission
texture; the strict comparison checks that actual binding rather than omitting
an unobserved history input. Original render-all history requirements remain.

A Top-down reflected flipper exposed one differing blue channel. Its original
16x anisotropic sampler value had been omitted by an older observer, which used
an invalid extension query; the runtime defaulted to 1x. A separate read-only
capture records all three flipper image samplers from actual setter calls.
Restoring those settings removes the difference without fitting pixels. Live
flippers now reuse the complete original BasicShader program and source indices
and cull state. Existing material, projection and assembly sample counts and
zero-difference gates remain unchanged. The orthographic fallback material is
checked separately from the live native-camera program.

The enabled-insert normal-mode diagnostic remains different. The pinned native
build's invalid classic-light uniforms are retained as evidence, never copied
into production or fitted. Production uses valid source lamp properties and
keeps authored inserts enabled. These controlled frames do not establish
uninterrupted gameplay parity, resolve the seven older physics failures, or
certify physical-phone performance.
