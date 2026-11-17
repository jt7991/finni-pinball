# fin-ball

Finni's Big Day is a party-themed visual reskin of JP Salas's Deadpool VPX table. The current design uses a connected garden-party scene, clear insert windows, bubbly white lettering with black outlines, balloon pop-bumper caps, an open metal wire ramp, triangular sling covers, and the saved Finni fox sculpture on a small cake.

The design choices, preserved gameplay and remaining work are recorded in [design/decisions.md](design/decisions.md). [design/current-assets.json](design/current-assets.json) selects the current playfield, revision 9.

## Current files

- [Current playfield](output/playfield-party-v9/finni-playfield-base.png): the assembled VPX floor texture.
- [Editable layers](output/playfield-party-v9/playfield-editable-layers.svg): artwork and independent insert lenses, with the Chewy font embedded.
- [Print separation](output/playfield-party-v9/playfield-print-cutouts.png): opaque artwork with 52 transparent insert cutouts.
- [Lens separation](output/playfield-party-v9/playfield-insert-lenses.png): neutral plastic and insert lettering.
- [Party hardware](output/vpx-v1/finni-party-hardware.glb): the fox, small cake, balloons, wire ramp and triangular sling covers.
- [Model/layout source](output/vpx-v1/finni-table-layout-source.blend): the saved checkpoint containing the accepted short-muzzle, flat-nose fox and source table layout. The hardware builder applies the current replacements to this checkpoint.
- [Fox atlas](output/vpx-v1/finni-fox-atlas.png): shared texture for the four separately animated fox parts.

The revision-6 files retained in Git are inputs to the current composition, including the unified illustration and registered mission windows. Older design previews are superseded.

## Local build

Run commands from this repository's root. The existing local tools are Blender 4.5.16 LTS, vpxtool 0.40.1, and the Python packages in `.tools/pydeps/` (including Pillow and resvg_py). These tools are not committed.

Obtain the original table described in [references/deadpool/VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md) and extract it to `.work/deadpool-extracted/`. The original table, extracted runtime assets, generated VPX files and runtime installation remain local.

```powershell
& .tools/vpxtool/vpxtool.exe extract --output-dir .work/deadpool-extracted 'path/to/original-table.vpx'
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/cutout-playfield-inserts.py
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/render-vpx-concepts.py -- --skip-renders
& .tools/blender/blender-4.5.16-windows-x64/blender.exe --background --python-exit-code 1 --python scripts/build-live-vpx.py
& .tools/vpxtool/vpxtool.exe assemble .work/finni-live-extracted output/live-vpx/Finni-Big-Day.vpx --force
```

Omit `--skip-renders` to generate Blender stills. The composition script checks transparency at all seven mission centers. The VPX builder checks that the regular table's source script, lock collision route, sling collision walls and moving rubbers remain unchanged. `scripts/validate-party-hardware.py`, run in Blender, checks the geometry, source fox fit, hidden covers and packed current texture.

`scripts/create-mission-light-check.py` creates a separate lamp-inspection table; `scripts/create-vpx-autoplay.py` supplies an optional real-physics autoplay helper. Recording and review scripts remain available, but their videos, audio, HTML pages and test tables are ignored by Git.

## Sources and scope

The base is JP Salas's Deadpool (Stern 2018), version 7.0.0. The source table credits OneSharpEdge for the original Mini Deadpool model. Source attribution and mod permission are recorded in [VPX-SOURCE.md](references/deadpool/VPX-SOURCE.md). Original Finni website artwork and URLs are recorded in [assets/finni/manifest.json](assets/finni/manifest.json). Chewy is bundled with its [Apache 2.0 license](assets/fonts/chewy/LICENSE.txt).

The regular playable build retains the original gameplay script. Printed mission names and visual replacements are implemented; the original DMD content, sounds and callouts still need a separate reskin pass. This is a work in progress.
