# Approved comic party preparation playfield

Selected November 19, 2026. Bright comic artwork shows Finni and friends getting
ready for the party. Detailed illustrated objects surround the seven actual task
status lamps. All 58 insert/shot-arrow outlines retain their table coordinates.
Task labels belong on status lamps; shared arrows follow the active rules.

The four former team-ups are Kitchen Timer, Party Lights, The Checklist and
Party Favors. Friendship Lock is the separate right-ramp multiball feature.

The selected appearance uses navy plastics, a bright pink cake, and hot pink,
electric blue and vivid yellow balloon bumpers. `apply-comic-appearance.py`
installs these colors without changing collision geometry. General illumination
uses neutral ambient fill and a 0.7 global emission scale to keep the dark navy
art readable, including between games. The previous table used 0.21 and black
ambient light.

The rear panel now uses matching navy comic bunting rather than the old sky and
green hill. The desktop backdrop uses a plain navy background. Three broad,
steady neutral fill lights illuminate the center and task illustrations. The
legacy decorative GI outlines extend beyond each light's falloff so their old
straight edges cannot crop the glow into square patches. Functional insert
shapes, GI colors/state timing, physics and scoring remain unchanged.

The built-in imagegen prompts and the transparent object atlases are included.
`illustrated-objects.svg` records the precisely placed object layer;
`illustration-anchors.json` records its task-face anchors. The print and lens
separations preserve exact light windows. The completed floor texture is
`finni-playfield-base.png`; `design/current-assets.json` selects this directory.

The November 21 local artwork edit replaces the large central fox with the first
selected alternative (`center-fox-reference.png`) and removes the small fox,
clipboard and pencil near the drain. The bottom title and other artwork remain
in place. `fox-replacement.json` records the exact composition inputs and placement.
All non-background SVG content and all insert alpha cutouts are unchanged.

The selected insert finishes now use deeper amber and cobalt rather than pastel
yellow/cyan. Task and multiplier lenses and shared arrows use neutral smoked-clear
plastic so dynamic shot colors remain legible. `cover-palette.json` records the
gradient colors; all 58 insert contours and their registration remain unchanged.
The rejected extra comic caption plates are not included.

The quieter GI, smaller halos, reduced bloom, and restrained runtime color cycle
are defined in `design/finni-lighting.json`. The complete build applies that
optical profile after installing the comic hardware and steady fill lights.
The packaged table and `browser/player-preview.png` include the selected fox,
insert finishes and lighting.
