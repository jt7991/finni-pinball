# Bake the Cookies artwork

The fifth chore is now **Bake the Cookies**, retaining task ID 5, internal
`megalodon` compatibility keys, insert `li009`, shot requirements and scoring.
Cake Time Multiball and the fox's small cake platform remain separate features.

The selected playfield is `output/playfield-party-v12/`. Its source illustration
replaces only the former lower-shelf baking prop with chocolate-chip cookies on
a silver tray. `scripts/cutout-playfield-inserts.py` rebuilds the print, lens and
floor textures, fitting `BAKE THE / COOKIES` to the original insert. The saved
Blender scene is refreshed with `scripts/refresh-playfield-scene.py`.

The separate DMD input is `assets/finni/dmd/cookies-reference.png`, consumed only
by the cookie task's selection, instruction, active-score and completion assets.
Cookie scenes use steam rather than candle glints. The three existing baking
voice IDs now announce cookies, the flashing-shot instruction and cookies baked.
Cookie jackpot wording replaces the generic baking jackpot wording.

Both final bitmap assets were generated with the built-in imagegen tool,
without the CLI/API fallback. The earlier playfield revisions and original DMD
reference sheets remain preserved as historical inputs.

## Final playfield alignment prompt

Edit target: the first cookie edit of the accepted v11 illustration.

> Precise local alignment correction to this exact 841x1870 portrait garden-party illustration. The new cookie tray on the lower shelf is good but its BACK EDGE is too low for the fixed pinball lamp. Keep the tray's front edge/bottom at the same place around y1472. Extend the tray's top plane UPWARD so the back rim begins at y1335 rather than y1375, and the top row of chocolate-chip cookies occupies y1350..1395. The fixed mission lamp overlays rectangle x418..482,y1354..1388 (center x449,y1370). This entire rectangle must be clearly within the cookie-filled baking tray silhouette, not on the green background above the tray. Increase the apparent depth/tilt of the tray toward the viewer to achieve this, using the same original width around x390..580 and same grounded lower shelf position. Keep five golden chocolate-chip cookies, silver shallow rectangular baking sheet, no cake. Do NOT add any lamp, text, badge, hole or outline: these coordinates just guide object placement. Preserve ALL other pixels/composition as closely as possible, including the oven mitt, rolled bunting, ribbon spools, complete picnic table, all tabletop items, left-shifted pinata, record player, landscape and full portrait frame. Change only this tray and its cookies locally; match the existing cozy flat illustration.

## DMD prompt

Style reference: `assets/finni/dmd/main-scenes-reference.png`.

> Create ONE standalone pixel-art sprite illustration for the Bake the Cookies mission in the supplied Finni pinball DMD style reference. The reference is a six-scene sheet; take character design, palette, hard pixel edges and dark plum background from its lower-left baking scene. New output: ONE single scene only, not a sheet. A happy orange Finni fox with cream muzzle, cheeks and belly, dark tiny outline, rounded ears and closed happy eyes, wearing oven mitts, proudly holding a shallow silver metal rectangular baking tray with six golden round chocolate-chip COOKIES visibly dotted with chocolate chips. A small purple mixing bowl with wooden spoon beside him. Cookies are the clear focal prop; NO cake, NO round cake tin, NO candles, NO frosting. Match the source's genuine chunky low-resolution pixel-art rendering with clean hard stair-step edges, no soft shading, no blurred pixels, no vector smooth outlines. Use orange, warm cream, lavender, mint accents on a flat uniform very dark plum background #10051d. Center the full fox and tray, fill most of a square composition while keeping ears, tray and feet entirely visible. No typography, no text, no borders, no UI. This will be reduced with nearest-neighbor to a native 104x58 or 64x28 pixel-art game display.

## Verification

`scripts/validate-cookie-task.py` checks the task configuration, native completed
message, DMD asset/motion routing, all three spoken transcripts, playfield lens
lettering and delivered floor texture, and ensures Cake Time remains intact.
The existing display, audio, selection, registration and presentation-preservation
checks cover their respective pipelines. These checks are not a physics playtest.
