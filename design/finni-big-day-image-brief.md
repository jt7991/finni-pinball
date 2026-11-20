# Finni's Big Day — image-generation brief

Source of truth: `design/rules-direction.md`. This replaces the garden-growing, butterfly-chasing and trail-adventure direction of the first base. Flowers, butterflies and garden paths remain scenery. The main story is preparing for and hosting Finni's first neighborhood party.

## Deliverable

A newly illustrated raster playfield base, generated using imagegen and then registered to the downloaded JP's Deadpool 7.0.0 layout. Deliver the individual 2048 × 4550 texture and updated renders on the actual table with the existing 3D fox. Do not substitute another manually composed playfield for the requested generated artwork.

The current fox geometry is retained: upright small body, oversized head, clean fox anatomy, original bobble pivots, shallow nearly flush triangular nose. This request changes the playfield direction.

## Story and visual hierarchy

One coherent neighborhood-party illustration should organize the composition. The fox is the main character, actively preparing the party. Make the open central area the main fox focal point, with smaller task scenes flowing through the surrounding artwork. Avoid a collection of pasted mascot heads, circular logo badges or disconnected clip-art panels.

Show concrete party tasks: wrapping presents, sending invitations, inflating balloons, hanging decorations, baking the cookies, hanging the piñata and hosting the party. Use the website's fox, warm colors and garden illustrations as identity references.

The physical disco ball and left-side disco loop support a smaller DJ/check-the-music scene. Keep disco visually explicit. The final party brings the neighborhood together; it should feel like the result of the preparation, rather than an unrelated dance-game theme.

Retain the original hardware, shot geometry, inserts, scoring and progression. The seven tasks are a selectable to-do list, not a numbered linear route. Three modes are initially selectable, six become selectable after three wins, and the hosting finale unlocks after six wins.

## Exact mode anchors

The mapping below is verified against `UpdateBattleLights` in the source script. Coordinates are in the original 952 × 2115 VPX playfield space, with the origin at the upper-left. The mode names are approved. Coordinates below are the original source centers; use mission-window-layout-v6.json for the actual registered build centers.

| Source mode | Working party task | Insert | X | Y | Visual cue |
| --- | --- | --- | ---: | ---: | --- |
| Juggernaut | Wrap the Presents | li008 | 281.7 | 1445.0 | partly wrapped present face |
| Mystique | Send the Invitations | li010 | 432.1 | 1444.8 | invitation envelope |
| Sabretooth | Blow Up the Balloons | li011 | 583.0 | 1444.3 | large balloon belly and hand pump |
| T-Rex | Put Up the Decorations | li007 | 356.1 | 1548.5 | rolled bunting and streamers |
| Megalodon | Bake the Cookies | li009 | 508.4 | 1549.4 | chocolate-chip cookies on a silver baking tray |
| Sauron | Hang the Piñata | li012 | 629.6 | 1345.6 | hanging donkey piñata torso |
| Mr. Sinister | Party Time | li013 | 571.4 | 1219.1 | music station front panel |

The existing upper-right toy/drop-bank area remains Cake Time Multiball. Preserve Disco Loops and Disco Multiball's existing qualification and loop scoring.

## Reference inputs and their roles

1. `.work/source-pf-reference.png`: layout reference only. Preserve the spatial structure, not the Deadpool illustration, costumes, weapons or lettering.
2. `output/vpx-v1/finni-playfield-overhead.png`: reference for the actual hardware coverage and visible art windows. Its existing garden artwork and labels are superseded.
3. `assets/finni/originals/fox-leaning.png`, `fox-running.avif`, `fox-peeking-down.png`: mascot identity and illustration references. Preserve the cream cheeks/chest/tail tip, cocoa outlines, large ears and friendly expression.
4. `assets/finni/website-assets.png`: secondary palette/scenery reference. Flowers and butterflies support the party scene.
5. `output/vpx-v1/finni-fox-individual.png`: installed-toy identity/proportion reference. This is not a request to generate a replacement 3D toy.
6. `design/finni-big-day-mode-anchors.json`: exact mode locations for the registration pass.

## Production constraints

- Generate a bare, flat, orthographic playfield illustration. No cabinet, glass, ramps, flippers, pop-bumper hardware, screws, lights, fake holes or perspective shadows.
- Keep the original aspect ratio and broad composition. Preserve quiet space around inserts and under hardware rather than painting important faces or objects across those areas.
- Generate the illustrated layer without lettering. Add the approved title and exact insert/shot labels after registration, so typography and gameplay markings remain accurate.
- Final title: **Finni's Big Day**. Do not add slogans or motivational copy. Remove the earlier "Grow Together" theme.
- The final base is 2048 × 4550. If the generator cannot produce that size, use a supported portrait size and register/resample the illustration before applying the original insert mask at full resolution.
- Make the art a unified, polished pinball illustration with confident shapes, warm cocoa outlines, layered party scenes and controlled contrast. Finni orange, cream, lilac, violet and green come from the supplied website references.
- Keep clinical/assessment language and score-as-skill interpretations out of the art. No superhero costume, weapons, belt, holsters or Deadpool symbols.

## Prompt

Use `design/finni-big-day-image-prompt.txt` with the references above. Classify this as `illustration-story`: a new illustrated base generated with layout and identity references.

After generation: inspect mascot consistency, party-task coverage, disco identity, visible-art hierarchy and alignment. Apply the existing inserts and exact typography as separate layers, then render the generated texture on the real extracted VPX scene. Save new outputs under `output/big-day-v1/` so the earlier base remains available for comparison.

## Current execution status

Revision 10 uses built-in imagegen, with a second registration correction for the cake and piñata. The generated background is composed with the original 52 insert outlines, the retained registered light overrides, and new chore labels. See design/party-playfield-v10-generation.md for provenance and scripts/validate-playfield-registration.py for geometry, alpha and text containment checks.
