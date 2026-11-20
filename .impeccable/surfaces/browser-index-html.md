---
version: 1
slug: "browser-index-html"
primary_target: "browser/index.html"
related_targets: []
---

# Player

Mode: Experience
Build path: code
Current scope: mobile performance and the established player layout.

## Direction contract

Keep the previous table-first interface, touch zones, conditional Start/Launch/Action controls, DMD positioning and dismissible settings/high scores. Provide the small question-mark help button on both mobile and desktop. Help supplies touch instructions on phones and keyboard instructions on desktop. The user explicitly rejected the new permanent eight-button grid and the follow-up proposal for compact controls around the table edges. Do not implement another control-layout redesign under this performance task.

Keep Balanced as the default camera and preserve saved choices. Keep mobile fullscreen reachable. Independent touches hold the lower-left/right flippers, with release on cancellation, focus loss and resizing. Preserve the actual VPX engine, rules, physics, art, full-color DMD, audio and voice studio.

Functional copy only. No slogans, decorative quips or generated sayings. The user previously requested Asteroids-style angular lettering; the rejected grid implementation does not establish a new visual system. Preserve the incumbent styling for this change.

## FORM

- Mode: Experience.
- Build path: code-first, approved by the user.
- Historical direction reference: seed:778eb93f11d124e2 (direction exploration, reroll 1, pick). Its button-grid implementation was rejected; the latest instruction restores the prior layout.
- Pinned scope: iPhone and Android priority, original small help control on mobile and desktop, prior game controls, mobile fullscreen and multi-touch, Balanced default, functional copy, preserve table/DMD/gameplay/audio.
- Signature interaction: simultaneous lower-left/right touch zones in the established player. Controls release on cancellation and focus loss.
- Motion grammar: preserve table and DMD motion; no additional UI effects.

## Performance work

Install lighter native graphics settings before engine initialization. Avoid duplicating the packed table download, and release its virtual file after successful native loading. Graphics changes are reversible through Settings and restart the game. Report actual measurement scope and limitations, including the software GPU and repeated emulator disconnections. Desktop tests do not certify physical phone performance.

## Verification

Check phone portrait and landscape, small phones, tablet and desktop. Verify the small help control on both mobile and desktop, simultaneous flippers, input cleanup, fullscreen recovery, camera preferences, actual shader compilation, animated geometry and replay after upload cleanup.
