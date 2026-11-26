# Finni DMD

The complete native DMD set lives in `sprites/`, indexed by `manifest.json`: 166 images covering every original DMD asset slot, the seven task selections/instructions/completions, Cake Time phases, Friendship, Disco, supplies, collectibles, mystery, combos, player announcements, tilt, game over, scores, letters, digits and meters. Every original DMD bitmap is replaced, including unused compatibility slots. Legacy image and sound IDs remain internal compatibility keys; no original-theme pixels or display wording remain.

The seven task selections use large character art beside their real remaining-work meter. Instruction and completion cards reserve the lower native text row. Scores, collectible counts, qualification, shot logic, existing effects, queue flags, timings and voice routing remain driven by the source table.

87 scene backgrounds now have native pixel-art loops: rising balloons, candle glints, party lights, sparkles, and confetti with a small illustration cheer for rewards. The expanded pass adds flying envelopes, a swaying pinata, mystery reveal rays, a returning pinball, selection arrows, moving parcels, fluttering ribbons, rotating records, snack steam, friendship hearts and timer hands. Twenty-one additional live event calls now use motion, including jackpot/skill-shot awards, ball saves, bonus counting, super combos and qualification notices; their two native text rows stay protected. Each loop has twelve 160ms frames; lettering, live instructions and meters remain pixel-identical. `animations.json` records scene routing and effects. The separate `FinniDmdAnimationTimer` updates only the background flasher (and FlexDMD background when enabled), without changing the event queue. Tilt, credits and compatibility-only aliases stay static. The browser plays these same installed loops directly from `runtime/dmd-animations.json`, using the native background assignment to select the scene and preserving live score/instruction glyphs. Native frame polling and score updates do not restart or double the animation. Playback pauses in hidden tabs. The original static sprite is used when `prefers-reduced-motion` is enabled, including preference changes during play. Native users can set `FinniDmdMotion = False` in the script.

`approved-concepts.png` is the first built-in ImageGen sheet approved in chat on November 18, 2026. `main-scenes-reference.png` adds invitations, balloons, decorations, baking, the pinata and party guests in the same approved pixel style. Its exact generation prompt is in [main-scenes-prompt.txt](main-scenes-prompt.txt). Input reference: the approved four-scene sheet, itself based on `assets/finni/originals/fox-leaning.png`. Generation used the built-in image tool, not the CLI/API fallback. The reference sheets are preserved composition inputs; their generated lettering is not used in the game. Exact text and glyphs are composed deterministically at native resolution.

The feature mapping is recorded in `design/finni-dmd-theme.json`: confetti replaces ninja stars, snacks replace chimichangas, supplies replace weapons, ribbons replace diamonds, Supply Run replaces Mech Suit Multiball, Streamer Rush replaces Katanarama, Spinner Rush replaces Berserker Rage and Confetti Burst replaces Ninja Apocalypse. These are presentation changes with the same source rewards and rules. The two ribbon instruction recordings are updated to match. JP Salas is credited in the table metadata and project README.

## Rebuild

The live score screen has a green frame in regular play and switches to the active task or mode’s title and accent color. The edge lights animate around both native text rows. Reduced motion shows the static frames.

The normal `scripts/build-live-vpx.py` pipeline installs all assets through `scripts/build-finni-dmd.py` and `scripts/finni-dmd-assets.py`. `scripts/apply-finni-dmd.py` applies checked DMD-only payload substitutions. The browser packager reads `images.json` rather than globbing leftover extracted files, so unregistered source/dedup images cannot leak into the atlas. Browser rendering uses nearest-neighbor scaling.

## Verification

- `scripts/test-finni-dmd-runtime.py`: executes the actual VBScript queue, effects, formatting and character mapping through Windows Script Host, with timer/flasher objects and game state supplied as fixtures. All 185 event calls pass with two score fixtures (370 variants). Every bitmap reference resolves. This is display-engine testing, not a full VPX physics playtest.
- `scripts/test-finni-dmd-motion.py`: checks all 1044 animation frames for stable text/meter regions and executes the real native timer through complete loops, scene resets and static mode. Writes a local motion filmstrip for inspection.
- `scripts/test-finni-dmd-browser.mjs`: exercises the shipped compositor against the real atlas, including live reduced-motion changes and nearest-neighbor scaling.
- `scripts/validate-finni-dmd.py`: verifies all 166 images against a fresh VPX extraction and the browser atlas, checks every original bitmap was replaced, checks visible messages for original-theme terms, rejects duplicate/missing image IDs, verifies clear live-text regions, and checks unchanged event tails.
- `scripts/validate-multiball-story.py .work/finni-dmd-roundtrip`: verifies all non-presentation VBScript statements and the existing multiball flow are preserved.
- `scripts/validate-party-audio.py .work/finni-dmd-roundtrip`: checks all 234 speech slots, routing and decoded audio against the generated recordings.
- `scripts/render-finni-dmd-review.py`: renders the captured native image assignments for visual inspection. The 61 active scene backgrounds were inspected across four local review sheets.

Final build: `output/live-vpx/Finni-Big-Day.vpx`. Browser bundle: `.work/browser-assets/`.

## Friendship Multiball animation

The real one/two/three-friend lock announcements now select distinct `d_finni_friend1`, `d_finni_friend2` and `d_finni_friend3` scenes. The approved fox, rabbit and bear arrive in that order, retaining previously welcomed friends. Arrivals settle at 800ms within the original 1500ms announcements. The multiball start uses `d_finni_friendship_start`: larger character cutouts, staggered hops and confetti, with fixed FRIENDSHIP / MULTIBALL lettering. Static sprites show the correct assembled group for reduced motion. Lock counts, ball release, multiball activation, scores, queue durations and speech remain unchanged.

## Bake the Cookies

The fifth task now uses `cookies-reference.png` for selection, instructions, active-score backgrounds and completion. Native compatibility IDs remain `d_finni_baking` / `megalodon`; they are not visible labels. Captions read BAKE THE / COOKIES and COOKIES BAKED, with cookie jackpot messages and three matching spoken lines. Its illustration has steam rather than candle glints. Cake Time Multiball keeps its own cake/frosting artwork and callouts. See `design/cookie-task-art.md` for built-in imagegen inputs and final prompts.

## Character animation

Twenty-eight scenes now replace the illustration with six authored poses of Finni and the task props. The poses show waving, tying a present ribbon, stirring and scooping cookie dough, piping frosting, scratching records and dancing, hanging bunting, pumping a balloon and pulling the pinata rope. Each pose holds for two native ticks, retaining the twelve-frame, 160ms cadence. No second fox or decorative prop is layered over the original still.

`character-motion-reference.png` is the built-in ImageGen pose sheet, based on the approved character, task and cookie references. The exact prompt is in `character-motion-prompt.txt`. `character-motion-layout.json` records its measured row boundaries so neighboring animation rows cannot bleed into the native frames. All six poses in a row share one crop and scale, preserving their relative positions. The original static illustrations remain available for reduced motion.

The native table and browser atlas ship the same frames. Lettering, live text, task meters, queue durations, voice routing and gameplay remain unchanged. DMD-only asset rebuilds validate the committed slot inventory when the original table extraction is unavailable; full builds still check the original image index.
