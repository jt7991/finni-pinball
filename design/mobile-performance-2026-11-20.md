# Mobile rendering measurements, November 20, 2026

Automatic uses the Performance profile on phones. It caps SDL's final render density at 1.5 and its width at 720 pixels, then renders internally at that size (`AAFactor=1`). If the browser cannot temporarily override its density, the profile falls back to `AAFactor=0.5`. The browser's real density and canvas context factory are restored immediately after synchronous native startup, including on failure. Detailed retains the engine defaults.

All graphics profiles explicitly disable ball trails and motion blur (`BallTrail=0`, `ForceMotionBlurOff=1`). After native table loading, `Table1.BallTrail=0` also overrides legacy preferences imported from the packed table. The real-engine test checks the table's resulting BallTrail property.

Performance also uses `MaxTexDimension=2048`, `DisableAO=1`, `DynamicAO=0`, `PFReflection=0`, `SSRefl=0` and `ForceBloomOff=1`. These settings reach native initialization through Emscripten's preRun array. Rules, physics, artwork, audio and the compact help/controls layout are preserved.

The 166,285,312-byte packed table is handed to MEMFS with `canOwn:true`, avoiding another full download-buffer copy. Its virtual file is unlinked after successful native loading. Replay keeps the loaded player.

## Android lighting correction

Ball material: the source table has `BallPlayfieldReflectionScale=3`, clamped by the engine to a full-strength playfield reflection. Reducing it alone did not resolve the washed-out ball in Android diagnostics. All browser profiles now use `DisableLightingForBalls=1`, retaining the ball's chrome/environment texture while bypassing table lighting and the previous-frame playfield-reflection path. `Table1.BallFrontDecal=""` removes the noisy scratch overlay before game balls are created. An actual Android ball-draw probe confirmed alpha 1 and blending disabled; bypassing lighting gave it a darker metallic edge. The real-engine regression checks the resulting ball shader uniforms and native decal setting.

The Android hardware-GPU emulator showed large solid white bulb-light polygons over the playfield. Disabling the static prepass rendered correctly but increased geometry draws from roughly 188 to 680 per frame, reducing the measured rate to about 26 FPS. The final fix keeps static prerendering enabled.

VPX's bulb/flashers encode additive strength using source alpha as high as 9999. The upstream reverse-subtract blend applies that strength to alpha too. A one-pixel RGBA16F reproduction returned finite RGB and non-finite alpha: squaring 9999 exceeds the half-float range. Preserving destination alpha for the specific `SRC_ALPHA, ONE_MINUS_SRC_COLOR` blend prevents this overflow. The RGB blend factors and shader calculations remain unchanged; ordinary transparency keeps its native factors. This alpha correction alone did not resolve the visible Android artifacts after a fresh startup.

On mobile contexts, `startTable` also installs a shader copy for the full-size, nearest-filtered color-and-depth framebuffer restore used by the static cache. It samples the cached HDR color and depth textures and writes both to the destination, then restores the engine's graphics state. Other framebuffer copies retain their native path. Replacing that combined blit removed the white polygons in Android; the exact driver-level cause has not been established. Depth-only replacement, scissor-state changes and higher-precision depth storage did not resolve them.

Both corrections are installed on the context the engine creates, without creating an early context or changing its attributes. The existing high-precision depth/HDR sampler patch remains in place. Real GPU regressions verify HDR color, finite alpha, depth occlusion, complete-target copying, ordinary transparency, repeated installation and restoration of engine graphics state. The final code was visually checked after a fresh Android reload, during actual launched-ball play and in native fullscreen. Static prerendering remained enabled and the playfield/lamp glows rendered without the previous white polygons.

## Mobile input and recovery

Flipper zones now cover the full left/right stage sides, including the previously inactive upper side space. Pointer tracking releases controls if pointer capture fails or a touch ends outside its original button. Cancelled toggle-mode touches release the flipper; ordinary tap-to-toggle still works. Help, settings, focus loss and engine failure clear input. Native input exceptions offer the existing Reload and retry recovery with readable error details.

Fullscreen ignores duplicate pending requests, handles asynchronous error events and clears earlier messages on success. The prefixed Safari API receives no standard fullscreen options argument. Unsupported browsers keep an explicit message. These Safari paths have browser-fixture coverage; they have not been tested on physical iPhone hardware. The existing compact help button and player layout remain.

## Android measurements and limits

Device: Android 15 / API 35 emulator, Pixel 7 configuration, Chrome 124, 412 by 783 CSS viewport, DPR 2.625.

| Sample | Graphics driver | Canvas | Rendered FPS | Median interval | p95 interval |
|---|---|---|---:|---:|---:|
| Original baseline | SwiftShader software GPU | 1081 by 1837 | about 8 | 116.7 ms | 166.7 ms |
| Capped render buffer, before lighting correction | Android Emulator GLES translator / host RTX 4080 | 618 by 1050 | 56.65 | 16.7 ms | 33.3 ms |
| Final cache-copy fix, native fullscreen | Android Emulator GLES translator / host RTX 4080 | 618 by 1050 | 48.63 | 16.7 ms | 33.4 ms |
| Final fix, after launching the ball | Android Emulator GLES translator / host RTX 4080 | 618 by 1050 | 43.46 | 16.7 ms | 49.9 ms |

The second sample counted 680 frames containing native WebGL draws over 12.004 seconds, with no long tasks. DMD/state polling consumed about 77 ms total over the sample. The table was visible but its lights were overexposed; this sample does not certify usable presentation.

The final fullscreen sample counted 584 frames with native draws over 12.008 seconds, with no long tasks. DMD/state polling consumed about 83 ms total. Its lighting was visually checked separately in device screenshots. This is a short sample with a ball waiting in the plunger, not a full-game benchmark.

The launched-ball sample counted 522 native draw frames over 12.011 seconds, with no long tasks and a maximum frame interval of 100 ms. DMD/state polling consumed about 125 ms total. These measurements include diagnostics overhead and do not demonstrate a sustained 60 FPS game.

These samples **do not establish physical-phone performance**. The original baseline used a different GPU backend. On the same host-GPU backend, the correct cache-copy rendering costs some frames relative to the corrupted native-copy path, while remaining substantially faster than redrawing all static geometry.

Actual Android device checks confirmed both simultaneous flippers reached their native held angles (68 and 292 degrees), returned to rest (120 and 240 degrees), native fullscreen entered, and a held/released Launch sent the ball into play and registered scores. Remaining validation: physical Android and iPhone testing, extended play, and real device orientation changes. Desktop integration tests exercise portrait/landscape and camera switching; that does not certify OS rotation behavior on phones.

## Real-engine desktop comparison with final code

Desktop Edge/Chromium on an NVIDIA RTX 4080, with a 412 by 783 phone viewport at DPR 2.625. The test instruments both `texImage2D` and `texStorage2D` allocations.

| Measurement | Detailed | Performance |
|---|---:|---:|
| Final canvas | 1081 by 1837 | 618 by 1050 |
| Allocated texture/render-target texels | 91,684,529 | 27,962,109 |
| Largest allocated texture dimension | 4550 | 2048 |
| Shader compile/link errors | 0 | 0 |
| Packed table retained after loading | No | No |
| Sampled FPS | 59.82 | 59.82 |
| p95 animation-frame interval | 16.8 ms | 16.8 ms |

Performance uses 67.32% fewer final-buffer pixels and allocates 69.50% fewer texels than Detailed. Allocation totals cover startup, not live VRAM bytes. Both profiles reach the desktop display's refresh rate; these numbers do not establish an Android speedup.

## Reproduction

Run `python scripts/check-mobile-player.py --profile` using the repository's configured Blender Python. This checks actual VPX settings, final-buffer dimensions, GPU texture sizes, shader compilation and packed-table release. JSON/screenshots are saved under `.work/render-profiles/`.

`--renderer` checks real HDR blending, native light passes, animated geometry, camera/orientation changes and native game-over/replay. The default command checks responsive layout, the small help button on mobile and desktop, simultaneous flipper zones, cancellation/focus cleanup, camera preferences and fullscreen API recovery using an isolated engine fixture. `node scripts/test-render-density.mjs` checks restoration of browser state after successful and failed native startup.

For Android, open and start the game through the Device panel's bound agent-device command. Forward Chrome diagnostics with `adb -s emulator-5554 forward tcp:9223 localabstract:chrome_devtools_remote`, then run `node scripts/profile-android-player.mjs sample-name 12 9223 http://10.0.2.2:8765`. Use the actual test server's origin if different. Close duplicate test tabs before collecting. The profiler checks foreground/context state and actual native draw frames, restores its instrumentation, and rejects disconnected or stopped samples. Always inspect visible rendering separately.
