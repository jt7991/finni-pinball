# iPhone compatibility verification

Status, November 21, 2026: real-engine WebKit compatibility passes; physical iPhone sign-off remains open. No production behavior changed during this audit.

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

This machine exposes only Android; its device service reports that iOS Simulators require macOS with Xcode. WebKit on Windows is not iOS Safari, even when its viewport and user agent emulate an iPhone. In particular, this build exposes no AudioContext, so audio playback and iOS audio-unlock behavior were not exercised. Its host GPU does not establish Apple GPU rendering, frame rate, memory-pressure stability, thermal behavior or long-session reliability. CSS viewport checks do not reproduce real notch/home-indicator insets or Safari toolbar movement.

Before claiming complete iPhone support, run the deployed HTTPS game in an iOS simulator or a cloud/physical iPhone. Verify two actual simultaneous fingers, prolonged flipper holds, audible effects/music after Start, portrait/landscape rotation, Safari bars and safe areas, app switching/background recovery, a complete game with initials/replay, and at least ten minutes of play without reloads or graphics corruption. Use an older/smaller supported iPhone as well as a current model. Fullscreen must be checked on the actual target browser; do not infer its availability from Android or desktop Safari.

Playwright documents that its WebKit is derived from upstream WebKit rather than being branded Safari: https://playwright.dev/docs/browsers#webkit.
