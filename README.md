# fin-ball

Finni's Big Day is a party-themed visual reskin of JP Salas's Deadpool VPX table. The approved direction is the bright comic **party preparation** playfield, revision 13: Finni and friends wrap presents, send invitations, pump balloons, hang decorations, bake cookies and prepare for Party Time. It uses registered insert windows, detailed illustrated task objects, illustrated navy party plastics, a bright pink cake, saturated pink/blue/yellow balloon bumpers, and the existing stainless four-wire ramp and fox sculpture. The four bonus items are Kitchen Timer, Party Lights, The Checklist and Party Favors. General lighting includes neutral ambient fill so the navy playfield remains readable.

The design choices, preserved gameplay and remaining work are recorded in [design/decisions.md](design/decisions.md). [design/current-assets.json](design/current-assets.json) selects the current playfield and its hardware/lighting appearance, revision 13.

## Current files

- [Current playfield](output/playfield-party-v13/finni-playfield-base.png): the assembled VPX floor texture.
- [Editable layers](output/playfield-party-v13/playfield-editable-layers.svg): artwork and independent insert lenses, with the Chewy font embedded.
- [Print separation](output/playfield-party-v13/playfield-print-cutouts.png): opaque artwork with 58 transparent insert and shared-arrow cutouts.
- [Lens separation](output/playfield-party-v13/playfield-insert-lenses.png): clear plastic and correctly assigned insert lettering.
- [Party hardware](output/vpx-v1/finni-party-hardware.glb): the fox, small cake, balloons, stainless wire ramp and triangular sling covers.
- [Model/layout source](output/vpx-v1/finni-table-layout-source.blend): the saved checkpoint containing the accepted short-muzzle, flat-nose fox and source table layout. The hardware builder applies the current replacements to this checkpoint.
- [Fox atlas](output/vpx-v1/finni-fox-atlas.png): shared texture for the four separately animated fox parts.

Revision 13 includes the clean illustrated background, detailed object atlases and registered object layer. The raised plastics and apron use registered bunting, ribbons, gifts, balloons and confetti from `output/party-plastics/`. A concise quick-start card fills the lower-left apron holder; its bounds are recorded in `output/party-plastics/layout.json`. A full Finni rules image replaces Deadpool’s native `rulescard`, retaining VPX’s `![Rules](rulescard)` table-rules reference. Both cards are generated from `design/instruction-card.json`. `scripts/build-party-plastics.py --source <extracted-table>` rebuilds the editable SVGs and textures, and the comic appearance installer applies them during regular builds. Older style studies are superseded. The hardware builder installs the selected navy/pink/vibrant appearance and ambient lighting through `scripts/apply-comic-appearance.py`.

The current artwork replaces the large middle fox and removes the small drain fox,
while preserving the surrounding illustration. Insert covers use deeper amber,
cobalt and neutral smoked-clear finishes, with quieter GI and reduced bloom.
The packaged table and start-screen preview include those changes; the extra
comic label plates from the design studies are omitted.

## Local build

### Play directly in a browser

To install the game, open its HTTPS URL and choose **Install app** in a supporting browser, or **Share → Add to Home Screen** on iPhone/iPad. The manifest launches the game in a standalone window with its own Finni fox icon. Localhost also supports installation for development. Installation still needs a connection to load the game; offline play is not bundled.

The favicon and app icons use the approved DMD title-screen Finni from `assets/finni/dmd/approved-concepts.png`. To rebuild the PNG app icons, Apple touch icon and ICO fallback, install Pillow in a local Python environment and run `python scripts/build-app-icons.py`. Docker copies these files with the rest of `browser/`.

After building `output/live-vpx/Finni-Big-Day.vpx`, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch-browser.ps1
```

Open **http://127.0.0.1:8765**, wait for loading, and choose **Play Finni’s Big Day**. The actual VPX engine, VBScript rules, physics, rendering, and embedded audio run in the browser through WebAssembly; the server only delivers files. Windows VPX is not launched. Current desktop browsers with WebGL 2 and graphics acceleration are required. First load transfers roughly 160 MB of engine and table data.

The controls panel saves unique key bindings locally. Defaults: left/right Shift for flippers, Enter for the plunger, 1 for Start, Space for Action (confirm a task or use the earned special ability), and Z/X/slash for nudges. Existing controls upgrade automatically while preserving custom bindings. Completed tasks are skipped by the chooser for that player until the next party round. Choose 1–4 players on the start screen before starting a game; the full roster joins before the first ball. Start confirms this selection and does not add players during play. After game over, choose the player count again and Play again starts a new free-play game on the loaded engine; finish or skip score entry first. Browser play is free: Start begins a game without credits or a coin button. Touch buttons support simultaneous presses. Optional toggle flippers remove the need to hold buttons; focus loss, tab hiding, and Release all buttons release held inputs. The browser's mappings call the original table key handlers, with SDL default keyboard input suppressed to avoid double inputs. Reserved browser shortcuts cannot be rebound.

`scripts/serve-browser.py` downloads pinned [vpinball-wasm 0.3.4](https://dev.pivoine.art/valknar/vpinball-wasm) on first run and verifies its SHA-512 checksum. The engine stays ignored under `.work/browser-engine/`. It serves only the browser files and the built regular table, on loopback. Use `-Port 9000` on the PowerShell launcher to change ports. Ctrl+C stops the server. No native player, screen capture, input bridge, or runtime table-script modification is used.

To test from another device on Tailscale, run `./scripts/launch-browser.ps1 -BindAddress (tailscale ip -4)` and open `http://<this-PC-Tailscale-IP>:8765` from that device. The explicit bind address limits the listener to that interface; the default remains loopback. Keep the host PC awake while testing. This direct HTTP route does not require Tailscale Serve or Funnel.

Browser verification covered loading the real table, starting a game, launching a physics-driven ball, scoring, flipper movement and release, and configurable browser controls. This is an experimental engine port, not full compatibility certification. The installed DMD sprites are mirrored into a separate, upright canvas from their live native image assignments, including background animations and character glyphs. It stays visible beside the table on wide desktops and above it on phones. Four live camera presets are available: Classic, Balanced, Top-down, and the closer Playfield view. Camera choice is saved locally; Balanced is the default on every device, with saved camera choices preserved. The portrait button rotates the complete game and DMD clockwise for a physically rotated screen. During fullscreen desktop play, move the pointer to the top edge (the physical right edge when rotated), or use Tab, to reveal the toolbar; Escape exits fullscreen. Phone controls use large lower-table flipper touch areas and a thumb-reachable launch button, with settings in a bottom sheet. Cabinet plugins, external FlexDMD/B2S, saved scores across page reloads, and physical mobile-device performance are not verified. The table's default non-FlexDMD display is used.

Engine source and licensing: [vpinball-wasm](https://dev.pivoine.art/valknar/vpinball-wasm), [Visual Pinball](https://github.com/vpinball/vpinball), [libwinevbs](https://github.com/vpinball/libwinevbs), and [PinMAME](https://github.com/vpinball/pinmame). Their mixed upstream licenses govern the compiled engine. Engine binaries and the original-derived table stay local, following this repository’s existing asset policy. See the engine’s [LICENSE](https://dev.pivoine.art/valknar/vpinball-wasm/src/branch/main/LICENSE) before redistributing a hosted bundle. Existing table, artwork, music, and font credits below still apply.

Run commands from this repository's root. The existing local tools are Blender 4.5.16 LTS (including its Python and numpy), vpxtool 0.40.1, and the Python packages in `.tools/pydeps/` (including Pillow and resvg_py). These tools are not committed.

Obtain the original table described in [references/deadpool/VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md) and extract it to `.work/deadpool-extracted/`. The original source table, extracted assets and runtime installation remain local. The packaged playable table and DMD atlas are committed in `runtime/` for deployment.

```powershell
& .tools/vpxtool/vpxtool.exe extract --output-dir .work/deadpool-extracted 'path/to/original-table.vpx'
# The registered revision-13 textures are included under output/playfield-party-v13.
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/render-vpx-concepts.py -- --skip-renders
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/build-live-vpx.py
& .tools/vpxtool/vpxtool.exe assemble .work/finni-live-extracted output/live-vpx/Finni-Big-Day.vpx --force
```

Omit `--skip-renders` to generate Blender stills. The composition script checks transparency at all seven mission centers. The VPX builder checks that source script bytes remain identical apart from the approved scoop feed and multiball and main-task presentation, and that the lock collision route, sling collision walls and moving rubbers remain unchanged. `scripts/validate-party-hardware.py`, run in Blender, checks the geometry, source fox fit, hidden covers and packed current texture. `scripts/validate-playfield-registration.py` verifies all 58 insert and shared-arrow cutouts against the actual light geometry, transparent print interiors, centered mission labels and full text containment. Pass an extracted table directory to verify the delivered floor image and lights. `scripts/validate-multiball-story.py` checks the Cake Time phase cues, Friendship naming and preservation of non-presentation script statements.

`scripts/create-mission-light-check.py` creates a separate lamp-inspection table; `scripts/create-vpx-autoplay.py` supplies an optional real-physics autoplay helper. Recording and review scripts remain available, but their videos, audio, HTML pages and test tables are ignored by Git.

## Shared leaderboard and Docker

### Team voice studio

The studio divides recordings into sets of 12–25 lines for a first session. Mini Finni has 12 complete toy reactions, reused across all 44 game slots; Cake Time has a separate host. Party chatter is shared across the host and two guests. Gameplay guidance is split into basics, party modes, combos/multipliers, rewards, and welcome/timer cues, so different teammates can record different instruction sets. The selector filters scripts, supplies direction and starting settings, and labels new shared takes. See the [casting and recording guide](design/voice-casting.md) for ownership, auditions, and follow-up recording rounds.

Open `/voice` on the game website (also linked in Controls). Teammates can record up to 30 seconds or upload audio, choose an existing game callout or enter a custom line, preview sound settings, download a game-format WAV, and submit both the original and processed take to a shared library.

**Finni Party** defaults to a +2-semitone pitch lift, a 100 Hz rumble filter, gentle compression, and matched speech level. **Natural** preserves pitch; **Toy Friend** adds a +5-semitone character voice. All presets target −18 dB active-speech RMS with a −1 dB peak ceiling and at most 12 dB makeup gain. This is a starting sound to audition with real team voices, not LUFS mastering or room-noise removal. Pitch changes preserve duration using overlapping grains; stronger shifts can sound synthetic. Export is 32 kHz stereo 16-bit PCM WAV, matching the existing callout builder.

The new PocketBase migration creates `voice_team` and `voice_takes`. In the admin dashboard (`/_/`), create one `voice_team` account per teammate with their name, email, and password. There is no public signup. Team members sign in on `/voice`; recordings remain in the browser until submitted. Shared records and audio files require membership. Sign-in lasts for the open page only. Both submitted audio versions and settings persist in the existing PocketBase Docker volume. Use HTTPS for microphone access on a team website; localhost also works. HTTP over a Tailscale IP supports uploads but browsers generally block the microphone.

Reviewers use the PocketBase dashboard to set a take’s `status` to `approved` or `needs-retake` and add a `review_note`. Teammates can see these decisions in the library. Approval does not replace audio in the live table. `scripts/import-team-voices.py --url <studio-origin>` downloads approved processed WAVs and expands reused reactions automatically; add `--install <extracted-table-directory>` to insert them before assembling the next VPX release. The importer uses a team session token from `VOICE_TEAM_TOKEN`, rejects conflicting approvals and outdated scripts, and reports missing takes. See the [import workflow](design/voice-casting.md#automatic-insertion-into-the-game). The studio never edits table rules or installs unreviewed takes.

After changing game callout scripts, run `scripts/export-voice-lines.py` using the project’s Blender Python to refresh the studio list. `scripts/test-voice-audio.mjs` checks pitch, duration, headroom and WAV format; `scripts/test-voice-backend.py` exercises real migrations, authenticated submissions, private downloads and review permissions against a temporary PocketBase database.

PocketBase stores anonymous runs and initials-only scores, with an admin dashboard for moderation. For Coolify, select [compose.yaml](compose.yaml): the image includes the table/DMD assets from `runtime/`, and a persistent volume keeps PocketBase, including original and processed voice WAVs, across redeploys. Enable Git LFS in Coolify before deploying. See [deployment instructions](pocketbase/README.md#coolify-deployment) for account setup and backups. Public score submissions are not replay-verified.

## Sources and scope

The base is JP Salas's Deadpool (Stern 2018), version 7.0.0. The source table credits OneSharpEdge for the original Mini Deadpool model. Source attribution and mod permission are recorded in [VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md). Original Finni website artwork and URLs are recorded in [assets/finni/manifest.json](assets/finni/manifest.json). Chewy is bundled with its [Apache 2.0 license](assets/fonts/chewy/LICENSE.txt).

The regular playable build retains original rules and scoring with the approved scoop eject: `HellHouse.kick 164, 12, 0`, feeding the right flipper instead of the center gap. Four consecutive real VPX browser-physics tests registered right-flipper contact. The build also applies presentation-only Cake Time and Friendship Multiball titles, instructions and speech. Cake Time is decorating before the party: frosting at Finni, decorations at lit shots, then a spinner flourish. Its printed playfield label is updated. The complete Finni DMD presentation is installed; see the DMD section below for coverage and validation. This is a work in progress.

## Finni DMD scenes

The complete pixel-art Finni DMD is installed in the regular VPX and browser atlas. All 166 display assets are Finni artwork: all seven tasks, Cake Time, Friendship, Disco, supplies, mystery, collectibles, combos, scores, player screens and attract mode. Confetti, snacks, supplies and ribbons replace the source collectibles; the secondary modes are Supply Run Multiball, Streamer Rush, Spinner Rush and Confetti Burst. Every original DMD bitmap is replaced, including unused slots, and all visible original-theme wording is removed. JP Salas's table credit remains. Live instructions, scores, event timings and gameplay still use the original table. See [DMD artwork, provenance and validation](assets/finni/dmd/README.md). The actual VBScript display engine passed all 185 event calls with two score fixtures (370 variants); all embedded and browser sprites were checked against a fresh extraction. This is not a full physics playtest.

## Party audio

Playfield LEDs use the garden-party palette in `design/finni-lighting.json`: peach, honey, lilac, violet, sage, mint and warm cream. The build applies it to static lamps/flashers, live shot colors and the animated rainbow/spotlight shows. Green and white shot cues still match their instructions. Lamp geometry, brightness, states, blink intervals and show timing are preserved. Run `scripts/validate-finni-lighting.py` with a freshly extracted table directory to check the delivered lamps and execute the actual VBScript palette and a complete color-show cycle.

The packaged table uses the supplied instrumental version of **Lovely Day — Bill Withers** during regular play, mixed about 6 LUFS below the mode tracks, and **Le Freak — CHIC** during Disco Multiball. The title screen, shooter lane and bonus count use effects and Finni callouts without music. Friendship Multiball plays **September — Earth, Wind & Fire**, Cake Time plays **Don’t Stop ’Til You Get Enough — Michael Jackson**, and all seven tasks play **Give Me the Night — George Benson**. Disco Loops plays [Funky Disco Beats to Boogie/Woogie to by Fupi](https://opengameart.org/content/funky-disco-beats-to-boogiewoogie-to) ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)). All other legacy music slots are silent. `design/music-trial.json` records the local source paths and their mode IDs. Place the recordings at those paths before running `scripts/apply-music-trial.py`; a missing recording leaves that slot silent and is reported explicitly. Sources remain local under `.work/music-sources/`. Cake Time skips the first 16 seconds of the spoken opening for an immediate full-band entrance. The installer converts audio only to stereo 32 kHz OGG, targets −20 LUFS for mode tracks, −26 LUFS for regular play, and a −2 dB true peak limit, and embeds the installed/pending status and song credits in the table. Existing sound routing, speech, effects and gameplay are preserved; the priority rules below control music transitions.

`design/finni-callouts.json` contains the transcript and delivery settings: `en-US-JennyNeural`, at -5% speaking rate. `scripts/build-finni-callouts.py` uses edge-tts 7.3.1, installed locally with Blender Python (`-m pip install --target .tools/voice-pydeps edge-tts==7.3.1`). It caches each unique line by text/voice/settings hash. Generating uncached lines requires network access; cached PCM rebuilds offline. All original voice and quote slots are replaced. The 42 random remarks have distinct lines. The 44 toy reaction slots reuse 12 canonical recordings, preserving the original JP trigger frequency without silent selections. A new "Ball saved!" cue plays with the actual ball-save display; ball handling and save timing are unchanged. Two source-script references missing their original assets (`vo_enterinitials` and `vo_nocredits`) now have recordings as well.

`design/party-audio.json` maps 55 effects: routine switch accents use dry taps, knocks and rattles; switch closures and spinners use short, subdued ticks; progress cues use lower musical accents. The Doorbell target plays a recorded two-tone household chime. See [sound research and direction](design/sound-direction.md). `scripts/build-party-audio.py` generates 32 kHz, 16-bit effect WAVs (mono for positional table contacts, stereo for backglass effects) and resets source music before the requested music trial is applied. Existing playback IDs, routing, volume settings and rule logic remain intact. The switch and spinner samples are replaced; all other mechanical recordings are preserved. The main VPX builder generates/installs all audio and synchronizes the regular table's neighboring VBS with the source script.

Balloon bumpers have tapered bodies, tied necks and curled ribbons. Their regular-hit cues (`sfx_sword1–3`) and task-hit cues (`sfx_hit1–3`) use a short rubbery balloon bop, without a reward chime. The task-hit IDs also serve other task shots, which share this sound. The underlying mechanical bumper contact remains audible.

To update effects in an existing extraction without resetting its installed music or speech, run `python scripts/build-party-audio.py --effects-only --install <extracted-table-directory>`, then assemble and audit with vpxtool. The default full-build path still resets source music before applying the music trial.

For an audio-only rebuild of an already built extraction:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/build-party-audio.py --install .work/finni-live-extracted
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/build-finni-callouts.py --install .work/finni-live-extracted
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/apply-music-trial.py
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/validate-party-audio.py
& .tools/vpxtool/vpxtool.exe assemble .work/finni-live-extracted output/live-vpx/Finni-Big-Day.vpx --force
& .tools/vpxtool/vpxtool.exe audit output/live-vpx/Finni-Big-Day.vpx
```

`output/finni-voice/finni-callouts-sampler.wav` auditions the voice alone, including the multiball stories, ball-save announcement and a selection of varied remarks/reactions. `output/party-audio/finni-audio-sampler.wav` auditions nine effect families: switch, spinner, tap, knock, rattle, balloon, progress, power and success. Generated audio, speech cache and reports remain local; the committed scripts/configurations rebuild them. Validation checks every speech slot, full spoken coverage, PCM, levels, routing, source-script equality except for the approved scoop feed and multiball and main-task presentation, music attribution, and byte equality of all untouched sounds. Pass an extracted round-trip directory to the validator to check the assembled table as well.

Music priority is fixed: three-lock Friendship Multiball first, Cake Time second, and active tasks third, regardless of which started last. Disco Multiball and Disco Loops come next, in that order. Ending a mode restores the highest-priority remaining track. Task selection and saved-ball launches preserve multiball music. `scripts/apply-multiball-music.py` applies this routing during the normal table build. Browser tilt penalties remain disabled.

## Cookie baking task

Bake the Cookies replaces the former cake-baking chore across the v12 playfield, fitted insert lettering, animated DMD selection/instructions/completion, jackpot captions and three spoken callouts. Cake Time Multiball remains a separate cake-decorating mode. The internal task IDs, shot requirements and scoring are retained. See [cookie artwork and generation prompts](design/cookie-task-art.md). Run `scripts/validate-cookie-task.py` alongside the existing presentation, audio and registration checks.

### Lock-ramp difficulty tuning

The loop into the Friendship ball lock has a small entrance assist, configured in `design/gameplay-tuning.json`. Only aligned climbing shots on Ramp010 with at least 18 units of horizontal speed receive a floor of 24. Weak shots still roll back; stronger shots, aim, ramp geometry, other lanes and lock rules are preserved. Run `scripts/test-lock-ramp-tuning.py` with an extracted table path to check the shipped script and collision geometry.


Mobile play uses simultaneous left/right touch zones with no browser tap highlight or long-press selection. Swipe left or right at least 24 CSS pixels on either flipper area to nudge sideways once per touch. The flipper stays held until release, including during upward thumb movement. Use the Nudge forward button in Controls for a forward nudge. Action remains a separate bottom button. Browser play disables tilt warnings and penalties by setting the table’s tilt sensitivity to zero at startup; nudge physics and strength are unchanged. Android Chrome can enter fullscreen using the top-right button. Phone landscape keeps its touch controls and places the DMD beside the table. Balanced is the initial camera; explicitly saved choices are preserved. The portrait render buffer fills the available stage without being shrunk as a wide image.

Run `scripts/check-mobile-player.py` with the project's Blender Python for headless Chromium layout, synthesized multi-touch, camera sizing, saved preferences, and fullscreen API recovery checks. It uses an isolated engine fixture, so it does not certify Android GPU performance or physics. Real-engine rendering was also checked in a Chromium phone viewport; physical Android frame rate and native fullscreen still require device testing.

The browser applies a sampler-precision compatibility patch to vpinball-wasm 0.3.4 before it compiles its shaders. Upstream's shared GLSL ES header sets high-precision floats but leaves texture samplers at their low-precision defaults. Depth and HDR texture samples need high-precision samplers as well; otherwise mobile GPUs can quantize depth and clamp lighting values. `browser/renderer.js` corrects these declarations in the engine's virtual filesystem without modifying the downloaded engine, table, or gameplay. See [WebGL precision guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices). This corrects a confirmed portability defect; elimination of the recording's artifacts still requires verification on the affected Android GPU.

Run `scripts/check-mobile-player.py --renderer` to exercise the real VPX engine, verify that the precision declarations reach the compiled shaders, check all 80 shader programs for compile/link errors, and exercise flipper/cap animation, release, the rotating disco ball, both phone orientations, and camera changes. Captures stay local in `.work/renderer-review/`. These are desktop Chromium checks, not a physical Android GPU test.

The player uses the selected Pixel Cabinet interface: filled 1980s pixel lettering, a navy shell, pink/cyan accents and yellow primary actions. Its loading/start screen, settings, scores and replay share the same system. Press Start 2P and DM Sans are bundled with their OFL licenses under `browser/fonts/`; the title DMD and table-preview PNGs are also bundled and carry embedded source provenance. The actual table and live DMD artwork remain unchanged.

The table-first layout and touch controls retain the small help button on mobile and desktop. Start game and Play again request fullscreen where supported; the fullscreen button can exit or re-enter. Flipper holds stay silent and show no floating Flip tabs. Settings and camera options remain behind help, and all copy uses functional labels and messages.

**Settings → Graphics** offers Automatic, Performance and Detailed. Automatic uses Performance on phones: half-resolution internal rendering, textures capped at 2048 pixels, ambient occlusion/reflection passes disabled, and bloom disabled. These settings are installed before native engine initialization. Detailed keeps the engine defaults. Applying a change restarts the game. The packed table download is transferred into the virtual filesystem without copying, then removed after the native table loads; replay uses the existing player.

Run `scripts/check-mobile-player.py --profile` to compare both profiles with the real engine in desktop Chromium at a phone viewport. It verifies the texture cap reaches GPU allocations, checks shaders, checks that the packed upload is released, and saves frame samples plus captures under `.work/render-profiles/`. See [the measured results and remaining Android check](design/mobile-performance-2026-11-20.md).

`scripts/test-webkit-player.mjs` adds a separate Safari-engine smoke test using the real game, native shaders and flippers, camera/settings, missing-fullscreen recovery and short phone layouts. See [iPhone compatibility results and reproduction steps](design/iphone-compatibility.md). WebKit on Windows passes these checks; actual iOS audio, Apple GPU performance and physical touch/safe-area behavior remain unverified.
