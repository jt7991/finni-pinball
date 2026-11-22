# Mobile rendering measurements, November 20, 2026

The Performance profile reduces the engine's GPU workload before table loading. It uses `AAFactor=0.5`, `MaxTexDimension=2048`, `DisableAO=1`, `DynamicAO=0`, `PFReflection=0`, `SSRefl=0` and `ForceBloomOff=1`. Automatic selects this profile on phones; Detailed retains the engine defaults. Rules, physics and audio are unchanged.

The 166,285,312-byte packed table is handed to MEMFS with `canOwn:true`, avoiding another full download-buffer copy. Its virtual file is unlinked after successful native loading. The real-engine checks verify subsequent rendering, flipper animation, camera changes and replay controls; replay keeps the loaded player.

## Android baseline

Device: Android 15 / API 35 emulator, Pixel 7 configuration, Chrome 124, 412×783 CSS viewport, DPR 2.625. The GPU reported ANGLE / Google SwiftShader, so this is a software-rendered emulator measurement, not a physical phone result.

Before the changes, a 12-second sample of the running game waiting in the plunger lane recorded 96 animation-frame intervals: approximately 8 FPS, median 116.7 ms and p95 166.7 ms. The render canvas was 1081×1837. DMD and game-state script calls together consumed about 73 ms across the full sample, indicating that reducing those polls would not address the primary rendering bottleneck.

The emulator disconnected when starting the comparison run. After reopening it at the user's request, it booted and loaded the restored player but disconnected again when starting the table. Device diagnostics returned `adb.exe: device 'emulator-5554' not found`. There is no valid post-change Android FPS sample. The disconnection's cause has not been established. Physical Android and iPhone testing, including native fullscreen behavior, remains outstanding.

## Real-engine profile comparison

Desktop Edge/Chromium on an NVIDIA RTX 4080, with a 412×783 phone viewport at DPR 2.625. Both profiles used the restored player layout and 1081×1837 canvas. The test instruments both `texImage2D` and `texStorage2D` allocations.

| Measurement | Detailed | Performance |
|---|---:|---:|
| Allocated texture/render-target texels | 91,487,921 | 25,701,737 |
| Largest allocated texture dimension | 4550 | 2048 |
| Shader compile/link errors | 0 | 0 |
| Packed table retained after loading | No | No |
| Sampled FPS | 59.83 | 59.92 |
| p95 animation-frame interval | 16.8 ms | 16.8 ms |

Performance allocated approximately 71.91% fewer texels. These are allocation counts across startup, not measured live VRAM bytes. Both profiles hit the desktop display's refresh rate; these numbers do not establish an Android speedup.

## Reproduction

Run `python scripts/check-mobile-player.py --profile` using the repository's configured Blender Python. This runs the actual VPX engine, asserts that native settings loaded before startup, verifies GPU texture sizes and packed-table release, and saves JSON and screenshots under `.work/render-profiles/`.

`--renderer` verifies the real shaders, animated geometry and native game-over/replay after upload cleanup. The default command checks the restored responsive layout, the small help button on mobile and desktop, simultaneous flipper touch zones, cancellation/focus cleanup, camera preferences, and fullscreen API recovery using an isolated engine fixture. None of these desktop tests substitutes for the remaining Android/iPhone device check.
