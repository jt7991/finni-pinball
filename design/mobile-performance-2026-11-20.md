# Mobile rendering measurements, November 20, 2026

Automatic uses the Performance profile on phones. It caps SDL's final render density at 1.5 and its width at 720 pixels, then renders internally at that size (`AAFactor=1`). If the browser cannot temporarily override its density, the profile falls back to `AAFactor=0.5`. The browser's real density and canvas context factory are restored immediately after synchronous native startup, including on failure. Detailed retains the engine defaults.

All graphics profiles explicitly disable ball trails and motion blur (`BallTrail=0`, `ForceMotionBlurOff=1`). After native table loading, `Table1.BallTrail=0` also overrides legacy preferences imported from the packed table. The real-engine test checks the table's resulting BallTrail property.

Performance also uses `MaxTexDimension=2048`, `DisableAO=1`, `DynamicAO=0`, `PFReflection=0`, `SSRefl=0` and `ForceBloomOff=1`. These settings reach native initialization through Emscripten's preRun array. Rules, physics, artwork, audio and the compact help/controls layout are preserved.

The 166,285,312-byte packed table is handed to MEMFS with `canOwn:true`, avoiding another full download-buffer copy. Its virtual file is unlinked after successful native loading. Replay keeps the loaded player.

## Android lighting correction

The Android hardware-GPU emulator showed large solid white bulb-light polygons over the playfield. Bypassing bulb draws and invalidating the static prepass removed them; ordinary geometry and classic lamp meshes rendered correctly.

VPX's bulb/flashers encode additive strength using source alpha as high as 9999. The upstream reverse-subtract blend applies that strength to alpha too. A one-pixel RGBA16F reproduction returned finite RGB and non-finite alpha: squaring 9999 exceeds the half-float range. Preserving destination alpha for the specific `SRC_ALPHA, ONE_MINUS_SRC_COLOR` blend removed the white polygons in the live Android diagnostic. The RGB blend factors and shader calculations remain unchanged; ordinary transparency keeps its native factors.

`startTable` installs the correction on the context the engine creates, without creating an early context or changing its attributes. The real-engine integration check confirms VPX light passes use the corrected blend. A GPU regression verifies expected RGB, finite alpha, ordinary transparency and idempotent installation. The existing high-precision depth/HDR sampler patch also remains in place.

## Android measurements and limits

Device: Android 15 / API 35 emulator, Pixel 7 configuration, Chrome 124, 412 by 783 CSS viewport, DPR 2.625.

| Sample | Graphics driver | Canvas | Rendered FPS | Median interval | p95 interval |
|---|---|---|---:|---:|---:|
| Original baseline | SwiftShader software GPU | 1081 by 1837 | about 8 | 116.7 ms | 166.7 ms |
| Capped render buffer, before lighting correction | Android Emulator GLES translator / host RTX 4080 | 618 by 1050 | 56.65 | 16.7 ms | 33.3 ms |

The second sample counted 680 frames containing native WebGL draws over 12.004 seconds, with no long tasks. DMD/state polling consumed about 77 ms total over the sample. The table was visible but its lights were overexposed; this sample does not certify usable presentation.

These samples use different GPU backends and **do not establish a comparable Android speedup or physical-phone performance**. The host-GPU setting eventually took effect without restarting T3. The lighting correction was then visually confirmed in that Android session. During a fresh application reload, device screenshots failed twice and the read-only debugger timed out. No complete post-correction Android gameplay/performance sample was obtained. The reason for the emulator failures has not been established.

Remaining validation: a fresh Android run with the final code, simultaneous input/fullscreen during actual play, a comparison on the same GPU backend, and physical Android/iPhone testing.

## Real-engine desktop comparison with final code

Desktop Edge/Chromium on an NVIDIA RTX 4080, with a 412 by 783 phone viewport at DPR 2.625. The test instruments both `texImage2D` and `texStorage2D` allocations.

| Measurement | Detailed | Performance |
|---|---:|---:|
| Final canvas | 1081 by 1837 | 618 by 1050 |
| Allocated texture/render-target texels | 91,487,921 | 27,962,109 |
| Largest allocated texture dimension | 4550 | 2048 |
| Shader compile/link errors | 0 | 0 |
| Packed table retained after loading | No | No |
| Sampled FPS | 59.82 | 59.82 |
| p95 animation-frame interval | 17.7 ms | 17.5 ms |

Performance uses 67.32% fewer final-buffer pixels and allocates 69.44% fewer texels than Detailed. Allocation totals cover startup, not live VRAM bytes. Both profiles reach the desktop display's refresh rate; these numbers do not establish an Android speedup.

## Reproduction

Run `python scripts/check-mobile-player.py --profile` using the repository's configured Blender Python. This checks actual VPX settings, final-buffer dimensions, GPU texture sizes, shader compilation and packed-table release. JSON/screenshots are saved under `.work/render-profiles/`.

`--renderer` checks real HDR blending, native light passes, animated geometry, camera/orientation changes and native game-over/replay. The default command checks responsive layout, the small help button on mobile and desktop, simultaneous flipper zones, cancellation/focus cleanup, camera preferences and fullscreen API recovery using an isolated engine fixture. `node scripts/test-render-density.mjs` checks restoration of browser state after successful and failed native startup.

For Android, open and start the game through the Device panel's bound agent-device command. Forward Chrome diagnostics with `adb -s emulator-5554 forward tcp:9223 localabstract:chrome_devtools_remote`, then run `node scripts/profile-android-player.mjs sample-name 12 9223 http://10.0.2.2:8765`. Use the actual test server's origin if different. Close duplicate test tabs before collecting. The profiler checks foreground/context state and actual native draw frames, restores its instrumentation, and rejects disconnected or stopped samples. Always inspect visible rendering separately.
