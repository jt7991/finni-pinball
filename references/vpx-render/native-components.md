# Native renderer component checkpoint

This is development evidence for the full port. The native renderer is now
connected to `three/scene.js` for the fox head, arms, body, and disco ball. Their
five separate GLB nodes are removed before adding the source geometry, so no
duplicates remain. The joined static table still awaits complete replacement.
Whole-table parity, reflection/bloom integration, and the remaining physics
comparisons are unfinished.

The ownership audit covers 650 authored renderable objects. All 589 BasicShader
draws in the independent frame with revealed sling variants have exactly one
resolved owner. Twelve shared geometry digests are disambiguated by native
world matrices. This covers the basic geometry pass; ball and flasher shader
passes still need their own rendering work.

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
draw. All 400 uploaded fields match independent VPX packets; visibility changes
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
additional reflected geometry. The actual game still uses its accepted joined
GLB until the complete replacement and animated vertex paths are connected.
The native reflection flags exclude both textured flipper tops, while keeping
the base/rubber parts; returning to the main camera restores both tops.

`native-target-render.js` reproduces original stand-up vertex updates using
the unposed template from the pinned native header. All11 initial GPU buffers
match byte-for-byte, including signed zeros and UVs. All four native animated
poses for each target match independently compiled Float32 position/normal
values. The older JSON pose fixture loses signed zero, so that comparison
normalizes zero signs only; the independent initial GPU digests do not.
GenerateMesh and UpdateTarget(offset0) have distinct rounding orders, exposed
by Target014 and preserved separately. This component is ready for the native
mechanism renderer; the live GLB targets remain on the existing pivot mapping.
