---
version: 1
slug: "browser-index-html"
primary_target: "browser/index.html"
related_targets: ["browser/arcade.css","browser/app.js","browser/views.js"]
---

# Player shell

Mode: Operate for loading, tools and scores; the unchanged game remains the Experience.
Scope: whole player flow on phones and desktop. Code-first, selected Pixel Cabinet sketch.

## Direction contract

THESIS: Pixel Cabinet brings filled 1980s raster lettering and saturated controls to the existing table-first player. No vector outlines, permanent button grid or slogans.

OWN-WORLD: midnight navy #0c102a, hot pink #ff4b98, cyan #55d8ed, yellow #ffdb4c and ivory #faf2da. Self-hosted Press Start 2P titles, DM Sans controls, square and stepped corners. The vivid native table and DMD stay intact.

STORY: load the real table, press Start game to enter fullscreen, play with two thumbs or keyboard, open compact help/settings/high scores, then replay the loaded engine.

FIRST VIEWPORT: small help and fullscreen controls at the top corners; a centered two-line yellow/pink game name, original DMD title artwork, table preview with cyan brackets, readable loading state and one yellow Start action below. Phone composition follows .impeccable/mocks/decision/pixel80.html; desktop expands the preview beside the title and action. Signature interaction: a single stepped progress fill resolves into the Start action. Reduced motion stays static; no in-game UI animation.

FORM: picked Pixel Cabinet, grounded rank 1; seed:7b77ff808b8a832c, reroll 1. The user explicitly rejected Asteroids and selected pixel80 with code build path. Keep Balanced default, saved preferences, silent invisible flipper holds and release cleanup.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Validation

Phone portrait/landscape, small phone, tablet and desktop; loading, failed loading, help, settings, high scores, initials and replay. Real engine integration and Android smoke test preserve fullscreen, two-thumb inputs and lighting fixes. Physical iPhone performance remains unverified. Merge documentation with existing table-art and DMD notes, as previously authorized by the user.

## Gameplay background refinement

The user requested a funky background around the table, replacing the empty blue corners in Balanced view. Extend Pixel Cabinet with static pink zigzags, cyan orbital bands, violet stepped fields and sparse pixel confetti. Spare page space uses a bundled SVG; empty far-depth canvas pixels receive matching procedural geometry during the existing cache restore. Preserve real table geometry, lighting, DMD, cameras and the small help/fullscreen controls. No animation, extra controls or slogans. This local decorative extension keeps the established DESIGN.md and its tokens.
