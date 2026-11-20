# Accepted flat cozy-village playfield

Style 6 selected by the user, with the piñata shifted left to expose its face beside the new wire ramp. Artwork generated with built-in imagegen; prompts and source provenance are in `generation.json`.

The complete current assets are stored here: the clean illustration, assembled 2048 × 4550 PNG, editable SVG, print with 52 transparent light cutouts, unchanged insert lenses and registered light overrides. All existing light shapes, label positions and centers are retained. `scripts/compose-playfield-style-studies.py` rebuilds these separations from the saved illustration and revision-10 registered layers.

`scripts/party-hardware.py` generates four stainless wire rails and sparse underslung braces on the original right return/lock route. `scripts/build-live-vpx.py` exports the visible noncollidable `FinniWireRamp` using the VPX Metal material. The original invisible Ramp013/Ramp012 objects retain all collision settings and geometry.

Verification: the assembled table was extracted again; embedded artwork and browser table hashes match the selected assets. The wire mesh and metallic material are installed, the former solid chute is absent from the table index, and ramp collision objects equal the original source. Hardware validation checks the scene, portable export, original fox, sling covers and packed texture. Registration checks all 52 cutouts, alpha holes and seven lens labels. DMD and multiball script validation pass. VPX audit reports zero errors with existing source warnings. These checks do not constitute a new runtime physics playtest.

Local review render: `on-table.png`. Regular playable output: `output/live-vpx/Finni-Big-Day.vpx`; browser package: `.work/browser-assets/Finni-Big-Day.vpx`.
