# iPhone compatibility verification

Status, November 21, 2026: real-engine WebKit compatibility passes on Windows and macOS; iOS 18.4 Safari simulator smoke checks ran on a simulated iPhone 16. Physical iPhone sign-off remains open. The iOS title-screen DMD sizing defect was fixed in `browser/arcade.css`.

## Verified

Playwright 1.65.1 / WebKit 27.2 on Windows, using the iPhone 13 descriptor (touch, mobile layout and DPR 3), ran the actual VPX WebAssembly engine and packaged table. This is a separate browser engine from the existing Chromium tests.

- All 83 observed shader programs compiled and linked, including the HDR/depth cache-copy regression. Scene rendering and the full-color DMD were inspected in portrait and landscape captures.
- A trusted Start tap loaded the native table with Balanced selected. Missing fullscreen support did not block gameplay; the existing unsupported-browser message appeared when requested.
- Two independently synthesized pointer IDs moved both native flippers. Release, cancellation and page exit cleared held controls. Hold/release Launch ran against the native engine. These are DOM-pointer tests, not physical two-finger hardware input.
- Help, settings popovers and camera changes worked. Start remained reachable at 375×548 and 844×320, allowing for browser chrome. Help, footer and DMD stayed within the viewport at 375×548, 430×739 and 844×320 without horizontal overflow.
- No uncaught page errors or shader compile/link failures were observed. The final render buffer was 585×879 despite the emulated DPR of 3.

## Reproduce

Serve the real player with `python scripts/serve-browser.py` (default port 8765), or target the deployed game. Install the test tool separately from shipping assets:

```powershell
npm.cmd install --prefix .tools/iphone-webkit playwright@1.65.1
node .tools/iphone-webkit/node_modules/playwright/cli.js install webkit
$env:PLAYWRIGHT_MODULE = "$PWD/.tools/iphone-webkit/node_modules/playwright/index.mjs"
node scripts/test-webkit-player.mjs http://127.0.0.1:8765 .work/webkit-review
```

The runner writes portrait/landscape PNGs and `result.json`. Its default module import also supports a normally installed `playwright` package. Each run starts with a fresh browser context and uses real engine loading, not fixture output.

## Remaining Apple-device checks

The current Mac exposes iOS simulators. Safari on an iPhone 16 simulator loaded the actual 166 MB table and engine, rendered the table and live DMD, started a game, and accepted a held/released Launch (the Launch control disappeared after release). Repeated two-point gestures were issued and portrait/landscape rotation rendered the table without a reload. Native startup logged successful shader compilation and audio-device initialization. A ten-second host system-audio probe detected output (peaks around -13 dBFS); this is supporting evidence, not isolated app-audio certification.

Safari stretched the title DMD image behind the preview and Start button because its percentage height resolved incorrectly in the grid. Replacing that percentage with the grid row's explicit clamped height and `object-fit:contain` fixed the observed iOS layout; the corrected title screen was inspected after reload.

An initial session displayed the engine's “Apply Device Layout” prompt for “Extended Gamepad #1” and paused gameplay. Web touch controls could not dismiss that canvas-native prompt. A later fresh run did not detect that controller and played without the prompt. Controller-connected startup remains an unresolved compatibility case; no speculative controller-disabling change was retained.

The existing `test-webkit-player.mjs` also passed on macOS with Playwright WebKit 27.2: 83 shader programs, native flipper movement/release/cancel, launch, camera/settings, missing fullscreen API recovery and short layouts. Local results are under `.work/iphone-webkit-mac/`. This suite is separate from iOS Safari. Simulator gestures do not establish physical touch latency, Apple phone GPU frame rate, memory pressure, thermal behavior or long-session stability. Help and Settings & camera opened in portrait iOS Safari, and the controls panel closed successfully. Landscape taps through simulator automation did not conclusively activate Help. A brief Home → Safari round trip returned to the same playing table without a reload. A complete game, initials/replay and prolonged background recovery still need device verification.

Before claiming complete iPhone support, run the deployed HTTPS game in an iOS simulator or a cloud/physical iPhone. Verify two actual simultaneous fingers, prolonged flipper holds, audible effects/music after Start, portrait/landscape rotation, Safari bars and safe areas, app switching/background recovery, a complete game with initials/replay, and at least ten minutes of play without reloads or graphics corruption. Use an older/smaller supported iPhone as well as a current model. Fullscreen must be checked on the actual target browser; do not infer its availability from Android or desktop Safari.

Playwright documents that its WebKit is derived from upstream WebKit rather than being branded Safari: https://playwright.dev/docs/browsers#webkit.
