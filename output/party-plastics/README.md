# Party plastics and instruction cards

The apron’s quick-start card is printed into `plastics2.png` at the bounds in `layout.json`. `instruction-card.png` is the standalone card at 1240 × 480, with editable SVG alongside it.

`rulescard.png` is the full 2048 × 1152 rules reference. The original JP’s Deadpool v7 table uses an image named `rulescard` referenced from `info.json` by `table_rules: "![Rules](rulescard)"`. No playfield object references that image. The installer retains that native reference and replaces its image with Finni artwork; it also puts the shorter card on the visible apron.

`design/instruction-card.json` owns both versions of the copy and records the rule sources. The card uses action names instead of fixed browser keys so custom bindings remain valid. It describes the existing game; it does not change rules.

Rebuild from an extracted shipped table:

```sh
python3 scripts/build-party-plastics.py --source <extracted-table>
```

Pillow and resvg_py are required. The bundled Chewy and DM Sans fonts are loaded explicitly. `build-party-instruction-card.py` can rebuild just the standalone cards. The normal comic appearance installer installs the plastics and native rules card during table builds.
