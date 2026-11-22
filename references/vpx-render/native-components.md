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
the viewport. Unsupported probe/normal-map paths fail explicitly.

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
