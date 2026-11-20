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
