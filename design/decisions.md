# Finni's Big Day: design decisions

Recorded November 17, 2026. This document captures the current accepted direction and the reasons behind the main choices.

## Story and artwork

Finni is preparing his first neighborhood party. The main missions represent party tasks, followed by hosting the party. Disco Loops and Disco Multiball keep their music identity and original qualification.

The middle playfield uses one connected garden-party scene with a lowered shared table and shelf. Separate sticker-like illustrations were rejected because they did not read as a cohesive scene. Each mission lamp sits within the object associated with its task:

| Lamp | Printed mission | Related object |
| --- | --- | --- |
| li008 | Put Up the Decorations | Bunting and string-light supplies |
| li010 | Send the Invitations | Invitation envelope |
| li011 | Bake the Cake | Cake face |
| li007 | Party Shopping | Shopping bag |
| li009 | Set the Table | Plate/place setting |
| li012 | Last-Minute Setup | Checklist |
| li013 | Party Time | Music station |

Revision 9 is selected by `current-assets.json`. Its illustration and lamp registration come from revision 6. `mission-window-layout-v6.json` records the translated mission centers; the original light outlines and gameplay assignments are preserved.

## Insert windows and lettering

Opaque scene artwork must stop at the insert windows so lamps do not appear buried under paint. The production print layer has 52 real alpha cutouts, including all seven mission windows. A separate lens layer holds neutral tinted plastic and readable labels. VPX uses the assembled print/lens floor texture beneath its existing dynamic Light objects; the runtime floor itself is not an open hole.

The type direction is playful, bubbly white lettering with a black outline. Chewy is the current font. The condensed block style was replaced because it felt too rigid; the white fill and black contour were retained from the requested Deadpool-like treatment. Mission labels are fitted to their windows, and the font is embedded in the editable SVG.

## Hardware

- **Right ramp:** replace the sword silhouette with an open metal wireform following the original `Ramp013`/`Ramp012` route. Preserve the ball-lock shot. The source uses the invisible `lock` kicker on `Ramp012`, `Lock_Hit`, `ExitLock` and per-player `BallsInLock` for a virtual three-ball lock. Qualification, timed kickout and multiball behavior remain source behavior.
- **Pop bumpers:** replace the ninja-star caps with peach, lilac and mint balloons. Keep the working bumper mechanisms and gameplay.
- **Fox:** preserve the latest saved short-muzzle sculpture with the small, flatter rounded triangular nose. Do not deform its body, legs or tail. Keep its head and arms as separate parts with the source pivots.
- **Cake:** use a small vanilla cake with lavender frosting on the original toy platform. Making the entire platform a cake was tried and reverted at the user's request. The fox is raised by 0.0215 m onto the small cake.
- **Bobble:** the target under the fox must trigger the real source animation: `Target012_Hit` calls `LilDPShake`, and `lilShakeTimer` drives the head and arms from the source physics routine.
- **Sling covers:** replace the irregular character silhouettes with plain triangular mint covers, softly rounded corners and a thin cream rim. The new covers fit the original three mounting posts. Hide only the old cover tops/sides (`Wall138` and `Wall039`); retain the posts, screws, sling collision walls, switches and animated rubbers. New cover meshes are noncolliding visual objects.

## Gameplay and verification

The regular playable table embeds the original source script unchanged. Printed mission names are a thematic mapping, not a rewrite of the rules. Existing scoring, progression, ramp lock, toy-target behavior and multiballs remain in place. See `rules-direction.md` for the mode mapping and remaining voice proposals.

Visual review uses actual Visual Pinball X, not a Blender gameplay simulation. A separate inspection copy cycles the seven mission lamps; an optional autoplay copy drives real launcher/flipper inputs. Neither helper is embedded in the regular gameplay build. The latest lettering and triangular covers were inspected in VPX with lights active. Source comparisons verify that sling collisions/animated rubbers and lock collision geometry are unchanged. Asset checks verify the saved fox shape, finite replacement geometry, hidden source covers and current packed texture. The latest table audit reported zero errors and 17 warnings already present in the preceding build.

The original DMD labels, music, sound effects and callouts remain. Their party-themed replacements and remaining feature names require a later pass. No claim is made that every game path has been tested.

## Repository policy

Commit the accepted artwork, its required composition inputs, the saved model/layout source checkpoint, the current hardware export, licensed font, source/provenance documents and build/validation scripts. The layout checkpoint preserves the exact accepted fox so rebuilding does not depend on finding a revision in another chat.

Keep tools, original table downloads, extracted runtime data, generated gameplay/test VPX files, large generated working scenes, old concept outputs, recordings, audio captures, validation reports and embedded-video review pages local. `.gitignore` explicitly allows the current revision and the inputs needed to rebuild it. When accepting a new revision, update both that allowlist and `current-assets.json`.
