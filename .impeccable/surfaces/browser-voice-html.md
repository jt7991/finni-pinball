---
version: 1
slug: "browser-voice-html"
primary_target: "browser/voice.html"
related_targets: ["browser/voice.css","browser/voice.js"]
---

# Voice studio

Mode: Operate. Extend the existing recording page with the established Pixel Cabinet identity. Preserve recording, upload, processing, download, private login/library, roles, transcripts and review workflow. Prefer recording first, with the full cast directory discoverable below. No gameplay or PocketBase schema changes; the later local AI integration adds a Python processing bridge. The follow-up request asks for a handful of preset voice effects instead of manual controls.

## Direction contract

THESIS: A working recording desk in the same cabinet as the game. Put the script and Record action before the supporting cast directory.

OWN-WORLD: Inherit navy, yellow actions, cyan focus and pink headings, Pixel short titles, DM Sans controls, 3px controls and 4px surfaces from DESIGN.md. No new rasters or decorative motion.

STORY: Choose a role and line, record or upload, compare the original and processed take, choose any of eighteen automatically previewed effects, then download or sign in to submit. Expand recording sets to browse alternatives.

FIRST VIEWPORT: Compact brand/navigation row, Voice studio title, and a wide script/recording section beside a narrower sound section. The yellow Record action is visible on desktop and phone. Role direction lives in a disclosure so long direction does not displace recording. Signature interaction: choosing a cast row selects the role and returns focus to the recording desk. State changes are immediate; reduced motion stays static.

FORM: Local extension of the existing voice surface; the user's instruction “it should match the theme of the rest of the site” pins the world. No open whole-surface concept round; the existing role/line, recording, sound and library structure remains authoritative.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance


## Voice treatments

Eighteen dialogue, speaker, character and pitch effects are independently selectable, with role recommendations as suggestions. Clean & natural is the default. Auto-trim clips only quiet ends and retains the full original. Local presets are separate from cloud enhancement.

## AI recording enhancement

The current workflow replaces the character voice trial with ElevenLabs Voice Isolator. Enhance recording explicitly sends the original to AI noise cleanup, then uses local finishing and game-format export. There are no target voices, tone transfers, or blended performances. Cost is shown before sending audio. The original stays available; undo and reapply use the cached result without another paid call. The bridge is localhost-only, keeps Secrets Manager credentials server-side and never retries paid work automatically.

Preserve the Pixel Cabinet palette and recording-first hierarchy. Audio comparison remains exclusive across players. The AI group explains realistic cleanup limits without promising restoration of clipped or heavily muffled audio.

## Validation

The prior ten-preset page passed its visual review. This functional replacement requires separate checks of explicit enhancement, caching, error recovery, original retention and responsive layout. No paid API conversion is used for validation; use an existing recording and mocked provider responses. No new permanent tests are requested.
