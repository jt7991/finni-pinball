# Native renderer integration checkpoint

This is development evidence for the full port. `three/scene.js` now loads the
complete original basic geometry instead of the joined GLB: 682 meshes include
558 main-view parts and 124 reflection-only wall bottoms. Six source flipper
parts and 25 classic inserts retain their separate native paths. The original
open wire ramp geometry, main arcade UI and lossless source artwork are retained.
The shared transmission/bloom temporary buffer, final whole-frame comparison
and seven older physics comparisons are unfinished. The full suite passes
159/166 tests.

The actual scene now runs source planar reflections with D16 depth, native
transmission, target/gate/spinner/trigger/bumper vertex updates and all 57
source-generated plunger mesh frames. `native-opaque-cache.js` caches color and
depth together and invalidates on camera, viewport, vertex, transform or
visibility changes. Twelve browser scenarios, including three real game balls
and all 25 classic inserts lit in four cameras, match uncached rendering across
43,018,560 HDR RGB samples, with no differences
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
copies without changing any half-float bits. Presentation-time extrapolation,
anti-stretch settings, trails and source dynamic light shadows still need
separate native comparisons. Whole-frame VPX equivalence remains unverified.

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
omission. Presentation-time extrapolation still needs a separate comparison.
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
and `RenderPass::Execute`. The complete frame pipeline must share this buffer
with bloom, as VPX does.

The transmission comparison explicitly supplies the captured previous blur
buffer and live colors as test inputs. Previous buffer contents, live colors,
held poses, native matrix packets, and reference output pixels are never
production assets. This component result does not establish full-frame parity.

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
