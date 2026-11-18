# fin-ball

Finni's Big Day is a party-themed visual reskin of JP Salas's Deadpool VPX table. The current design uses a connected garden-party scene, clear insert windows, bubbly white lettering with black outlines, balloon pop-bumper caps, a party-streamer ramp trial with a tall lilac right wall and open top, triangular sling covers, and the saved Finni fox sculpture on a small cake.

The design choices, preserved gameplay and remaining work are recorded in [design/decisions.md](design/decisions.md). [design/current-assets.json](design/current-assets.json) selects the current playfield, revision 9.

## Current files

- [Current playfield](output/playfield-party-v9/finni-playfield-base.png): the assembled VPX floor texture.
- [Editable layers](output/playfield-party-v9/playfield-editable-layers.svg): artwork and independent insert lenses, with the Chewy font embedded.
- [Print separation](output/playfield-party-v9/playfield-print-cutouts.png): opaque artwork with 52 transparent insert cutouts.
- [Lens separation](output/playfield-party-v9/playfield-insert-lenses.png): neutral plastic and insert lettering.
- [Party hardware](output/vpx-v1/finni-party-hardware.glb): the fox, small cake, balloons, streamer ramp and triangular sling covers.
- [Model/layout source](output/vpx-v1/finni-table-layout-source.blend): the saved checkpoint containing the accepted short-muzzle, flat-nose fox and source table layout. The hardware builder applies the current replacements to this checkpoint.
- [Fox atlas](output/vpx-v1/finni-fox-atlas.png): shared texture for the four separately animated fox parts.

The revision-6 files retained in Git are inputs to the current composition, including the unified illustration and registered mission windows. Older design previews are superseded.

## Local build

### Play directly in a browser

After building `output/live-vpx/Finni-Big-Day.vpx`, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch-browser.ps1
```

Open **http://127.0.0.1:8765**, wait for loading, and choose **Play Finni’s Big Day**. The actual VPX engine, VBScript rules, physics, rendering, and embedded audio run in the browser through WebAssembly; the server only delivers files. Windows VPX is not launched. Current desktop browsers with WebGL 2 and graphics acceleration are required. First load transfers roughly 160 MB of engine and table data.

The controls panel saves unique key bindings locally. Defaults: left/right Shift for flippers, Enter for the plunger, 1 for Start, and Z/Space/slash for nudges. Browser play is free: Start begins a game without credits or a coin button. Touch buttons support simultaneous presses. Optional toggle flippers remove the need to hold buttons; focus loss, tab hiding, and Release all buttons release held inputs. The browser's mappings call the original table key handlers, with SDL default keyboard input suppressed to avoid double inputs. Reserved browser shortcuts cannot be rebound.

`scripts/serve-browser.py` downloads pinned [vpinball-wasm 0.3.4](https://dev.pivoine.art/valknar/vpinball-wasm) on first run and verifies its SHA-512 checksum. The engine stays ignored under `.work/browser-engine/`. It serves only the browser files and the built regular table, on loopback. Use `-Port 9000` on the PowerShell launcher to change ports. Ctrl+C stops the server. No native player, screen capture, input bridge, or runtime table-script modification is used.

Browser verification covered loading the real table, starting a game, launching a physics-driven ball, scoring, flipper movement and release, and configurable browser controls. This is an experimental engine port, not full compatibility certification. The original DMD sprites are mirrored into a separate, upright canvas from their live native image assignments, including background animations and character glyphs. It stays visible above the table in all three live camera presets: Classic, Balanced, and Top-down. Camera choice is saved locally; phones default to Top-down. Phone controls use large lower-table flipper touch areas and a thumb-reachable launch button, with settings in a bottom sheet. Cabinet plugins, external FlexDMD/B2S, saved scores across page reloads, and physical mobile-device performance are not verified. The table's default non-FlexDMD display is used.

Engine source and licensing: [vpinball-wasm](https://dev.pivoine.art/valknar/vpinball-wasm), [Visual Pinball](https://github.com/vpinball/vpinball), [libwinevbs](https://github.com/vpinball/libwinevbs), and [PinMAME](https://github.com/vpinball/pinmame). Their mixed upstream licenses govern the compiled engine. Engine binaries and the original-derived table stay local, following this repository’s existing asset policy. See the engine’s [LICENSE](https://dev.pivoine.art/valknar/vpinball-wasm/src/branch/main/LICENSE) before redistributing a hosted bundle. Existing table, artwork, music, and font credits below still apply.

Run commands from this repository's root. The existing local tools are Blender 4.5.16 LTS (including its Python and numpy), vpxtool 0.40.1, and the Python packages in `.tools/pydeps/` (including Pillow and resvg_py). These tools are not committed.

Obtain the original table described in [references/deadpool/VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md) and extract it to `.work/deadpool-extracted/`. The original table, extracted runtime assets, generated VPX files and runtime installation remain local.

```powershell
& .tools/vpxtool/vpxtool.exe extract --output-dir .work/deadpool-extracted 'path/to/original-table.vpx'
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/cutout-playfield-inserts.py
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/render-vpx-concepts.py -- --skip-renders
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/build-live-vpx.py
& .tools/vpxtool/vpxtool.exe assemble .work/finni-live-extracted output/live-vpx/Finni-Big-Day.vpx --force
```

Omit `--skip-renders` to generate Blender stills. The composition script checks transparency at all seven mission centers. The VPX builder checks that source script bytes remain identical apart from the approved scoop feed and multiball presentation, and that the lock collision route, sling collision walls and moving rubbers remain unchanged. `scripts/validate-party-hardware.py`, run in Blender, checks the geometry, source fox fit, hidden covers and packed current texture. `scripts/validate-multiball-story.py` checks the Cake Time phase cues, Friendship naming and preservation of non-presentation script statements.

`scripts/create-mission-light-check.py` creates a separate lamp-inspection table; `scripts/create-vpx-autoplay.py` supplies an optional real-physics autoplay helper. Recording and review scripts remain available, but their videos, audio, HTML pages and test tables are ignored by Git.

## Shared leaderboard and Docker

PocketBase stores anonymous runs and initials-only scores, with an admin dashboard for moderation. See [pocketbase/README.md](pocketbase/README.md) for Docker Compose, Coolify configuration, packaging the table/DMD assets, persistent volumes, and submission-check limitations. Public score submissions are not replay-verified. No Coolify deployment is performed by the setup.

## Sources and scope

The base is JP Salas's Deadpool (Stern 2018), version 7.0.0. The source table credits OneSharpEdge for the original Mini Deadpool model. Source attribution and mod permission are recorded in [VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md). Original Finni website artwork and URLs are recorded in [assets/finni/manifest.json](assets/finni/manifest.json). Chewy is bundled with its [Apache 2.0 license](assets/fonts/chewy/LICENSE.txt).

The regular playable build retains original rules and scoring with the approved scoop eject: `HellHouse.kick 164, 12, 0`, feeding the right flipper instead of the center gap. Four consecutive real VPX browser-physics tests registered right-flipper contact. The build also applies presentation-only Cake Time and Friendship Multiball titles, instructions and speech. Cake Time is decorating before the party: frosting at Finni, decorations at lit shots, then a spinner flourish. Its printed playfield label is updated. The wider original DMD content still needs a separate reskin pass. This is a work in progress.

## Party audio

The current trial pairs warm female Finni callouts with Kevin MacLeod's **Funkorama** for regular play and the title screen. The four original title tracks, including Deadpool rap, are replaced. Fifteen original music cues remain, including Disco Loops and Disco Multiball. `design/music-trial.json` records the nine replacement IDs, source checksum, download URL and CC BY 4.0 credit. The build embeds attribution in the table information and writes `output/party-audio/MUSIC-CREDITS.txt`.

`design/finni-callouts.json` contains the transcript and delivery settings: `en-US-JennyNeural`, at -5% speaking rate. `scripts/build-finni-callouts.py` uses edge-tts 7.3.1, installed locally with Blender Python (`-m pip install --target .tools/voice-pydeps edge-tts==7.3.1`). It caches each unique line by text/voice/settings hash. Generating uncached lines requires network access; cached PCM rebuilds offline. All original voice and quote slots are replaced. Most random quote/reaction slots are silent so speech stays occasional. Two source-script references missing their original assets (`vo_enterinitials` and `vo_nocredits`) now have recordings as well.

`design/party-audio.json` maps 52 effects to short pops, shuffles and chimes. `scripts/build-party-audio.py` generates stereo 32 kHz, 16-bit effect WAVs and resets source music before the requested music trial is applied. Mechanical sounds, existing playback IDs, routing, volume settings and rule logic remain intact. The main VPX builder generates/installs all audio and synchronizes the regular table's neighboring VBS with the source script.

For an audio-only rebuild of an already built extraction:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/build-party-audio.py --install .work/finni-live-extracted
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/build-finni-callouts.py --install .work/finni-live-extracted
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/apply-music-trial.py
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/validate-party-audio.py
& .tools/vpxtool/vpxtool.exe assemble .work/finni-live-extracted output/live-vpx/Finni-Big-Day.vpx --force
& .tools/vpxtool/vpxtool.exe audit output/live-vpx/Finni-Big-Day.vpx
```

`output/finni-voice/finni-callouts-sampler.wav` auditions the voice alone, including the new multiball stories. `output/party-audio/finni-audio-sampler.wav` auditions four effect families. Generated audio, speech cache and reports remain local; the committed scripts/configurations rebuild them. Validation checks every speech slot, intentional silence, PCM, levels, routing, source-script equality except for the approved scoop feed and multiball presentation, music attribution, and byte equality of all 81 untouched sounds. Pass an extracted round-trip directory to the validator to check the assembled table as well.
