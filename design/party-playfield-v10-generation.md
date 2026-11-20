# Approved chore playfield, revision 10

Generated November 18, 2026 with the built-in imagegen tool. The reference/edit
target was `output/playfield-party-v6/mission-party-environment.png`. The final
image is stored in `output/playfield-party-v10/mission-party-environment.png`.
No paid API/CLI fallback was used. The generated raster remains a bare scene;
deterministic composition supplies the actual light cutouts and typography.

## Generation specification

Use case: precise-object-edit / illustration-story. Preserve the narrow 952:2115
garden composition, bright cartoon style, cocoa outlines, sky, tree, winding
path, fence, orange gingham table and its lower shelf. No lettering, hardware,
holes, badges or simulated inserts. Keep the scene connected rather than making
separate icons. Replace the old tabletop bunting with a partly wrapped lavender
present and ribbon; retain the envelope; replace the tabletop cake with an
inflating peach balloon and hand pump; replace the shopping bag on the shelf
with rolled bunting and streamers; replace the plate with a plain baked cake in
its tin; replace the checklist with a large hanging donkey piñata attached to
the tree by a rope. Retain the record player and a clear gold front panel.

The object faces were requested at these exact registered centers, in the
952 × 2115 VPX coordinate system, with broad unobstructed surfaces:

| Light | Object face | X | Y |
| --- | --- | ---: | ---: |
| li008 | Wrapped present | 262.3 | 1405.5 |
| li010 | Envelope | 418.3 | 1412.3 |
| li011 | Balloon belly | 578.9 | 1403.2 |
| li007 | Rolled bunting | 356.06686 | 1548.5393 |
| li009 | Plain baked cake | 508.44827 | 1549.4294 |
| li012 | Piñata torso | 667.1 | 1282.1 |
| li013 | Record player front | 571.0 | 1201.8 |

## Registration correction prompt

Precise registration correction to this existing illustration. Keep entire
image, garden, table, envelope, present, balloon and bunting unchanged. Same
narrow portrait aspect ratio. Only reposition the donkey piñata and lower-shelf
baked cake for pinball light alignment. In the displayed 842 × 1870 coordinate
space, place the piñata torso at (590,1134), with a broad face spanning
x550–630/y1110–1155; move it left approximately 60 pixels and down approximately
70 pixels, preserve the rope connection, avoid the record player, and keep the
legs above the balloon. Place the baked cake's clear face at (450,1370), spanning
x408–492/y1350–1395; move the cake/tin left approximately 55 pixels. Keep the
rolled bunting at (315,1370), mitt to the right, envelope at (370,1249), balloon
at (512,1241), present at (232,1243), and music-station panel at (505,1062).
No words, lamp shapes or holes: production masks are applied separately.

## Composition and verification

The existing 52 cutout shapes and registered light overrides are retained.
Mission labels come from `design/party-tasks.json`; Chewy text is fitted against
each actual irregular light silhouette, including its black outline. Mission
text belongs to the lens layer, not the opaque print. The print has actual
alpha holes; the VPX floor texture combines the print and lens layers.

`scripts/validate-playfield-registration.py` compares every cutout transform and
outline with the source/override light geometry, checks transparent interiors
across all 52 windows, and checks all seven label anchors and complete ink
containment. Its registration overlay is a technical visual check of object
placement, which cannot be established by testing label coordinates alone.

## Final overlap correction

The table render revealed that the piñata overlapped the music-station lamp.
A compact-body trial still overlapped it and was discarded. The final built-in
edit used the preceding large-piñata illustration plus the technical
registration closeup. Prompt: move the ENTIRE donkey piñata exactly 60 pixels
RIGHT in the 842 x 1870 reference space; do not move vertically, scale or
shorten it. Extend the rope to the new back position; expose the gold player
panel at the upper star, reconstruct the panel to x360..600/y1040..1085, keep
piñata left of torso no further left than x555 in that band and retain body
coverage x558..623/y1115..1155 for its own lamp. Keep all other objects unchanged.
Do not include the guide's pink outlines, stars, labels or dots in the artwork.
This preserves all existing light centers, outlines and assignments.
