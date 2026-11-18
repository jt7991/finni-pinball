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

- **Right ramp:** the November 18 trial replaces the open wireform with a party-streamer chute following the original `Ramp013`/`Ramp012` route: peach floor, tall solid lilac wall on cabinet-right, low inner lip, cream edging and a decorative curl outside the upper channel. Keep the top open and preserve the ball-lock shot. The source uses the invisible `lock` kicker on `Ramp012`, `Lock_Hit`, `ExitLock` and per-player `BallsInLock` for a virtual three-ball lock. Qualification, timed kickout and multiball behavior remain source behavior.
- **Pop bumpers:** replace the ninja-star caps with peach, lilac and mint balloons. Keep the working bumper mechanisms and gameplay.
- **Fox:** preserve the latest saved short-muzzle sculpture with the small, flatter rounded triangular nose. Do not deform its body, legs or tail. Keep its head and arms as separate parts with the source pivots.
- **Cake:** use a small vanilla cake with lavender frosting on the original toy platform. Making the entire platform a cake was tried and reverted at the user's request. The fox is raised by 0.0215 m onto the small cake.
- **Bobble:** the target under the fox must trigger the real source animation: `Target012_Hit` calls `LilDPShake`, and `lilShakeTimer` drives the head and arms from the source physics routine.
- **Sling covers:** replace the irregular character silhouettes with plain triangular mint covers, softly rounded corners and a thin cream rim. The new covers fit the original three mounting posts. Hide only the old cover tops/sides (`Wall138` and `Wall039`); retain the posts, screws, sling collision walls, switches and animated rubbers. New cover meshes are noncolliding visual objects.

## Gameplay and verification

The regular playable table retains source gameplay with the approved HellHouse scoop feed and presentation-only multiball changes. Cake Time is decorating the cake before the party: frosting at Finni, toppings at the lit shots, a spinner flourish, then another frosting round. Friendship Multiball gathers three friends through the right-ramp locks. Both now have display and voice cues; Cake Time also has an updated printed label. Existing scoring, qualification, progression, ramp lock, toy-target behavior and multiball timers remain in place.

The original `HellHouse.kick 164, 30, 1` uses a one-radian upward inclination, loses speed before rolling downfield, and in the browser crossed the flipper line near x=433 (the center gap). The approved kick is `164, 12, 0`: the same aim, reduced speed, and a flat launch. Four consecutive real-engine tests registered right-flipper collisions at x=512–523, y=1779–1786, with the flipper at rest. `design/gameplay-tuning.json` records the setting. `scripts/apply-gameplay-tuning.py` applies it and calls `apply-multiball-story.py` for checked display/audio substitutions. Validation checks all other script bytes and non-presentation statements remain identical. This does not force a ball trajectory or alter other shots.

Visual review uses actual Visual Pinball X, not a Blender gameplay simulation. A separate inspection copy cycles the seven mission lamps; an optional autoplay copy drives real launcher/flipper inputs. Neither helper is embedded in the regular gameplay build. The latest lettering and triangular covers were inspected in VPX with lights active. Source comparisons verify that sling collisions/animated rubbers and lock collision geometry are unchanged. Asset checks verify the saved fox shape, finite replacement geometry, hidden source covers and current packed texture. The latest table audit reported zero errors and 17 warnings already present in the preceding build.

The current audio trial uses warm female Finni callouts (`en-US-JennyNeural`, -5% rate) and Kevin MacLeod's Funkorama in nine slots: five regular-play slots and the four original title-screen tracks. The user requested replacing the title music too, including the Deadpool rap. All five title-screen selections now use Finni's music: the fifth selection is redirected to `mu_hellhouse5`, preserving the shared in-game multiball track. Fifteen source music cues remain, including disco. Attribution and CC BY 4.0 license details are embedded in the table information and recorded in `design/music-trial.json`. All original voice slots are replaced, including unused assets; 74 random-bank replacements are deliberately silent. The callout review spreadsheet excludes unused, silent and free-play bypassed cues.

All 233 voice slots are covered by `design/finni-callouts.json`, including two missing source assets and four new multiball story cues. Seventy-four random quote/toy-reaction slots are deliberately silent; spoken lines stay brief and do not invent progress. Shared IDs use wording valid at every trigger: `vo_multiball` remains generic for the later collectible mode; Friendship has its own start ID. The toy hurry-up's `vo_lildp_multibal` says "Keep it going", rather than falsely announcing a multiball start. Regeneration remains an extra-ball award. The 52 party effects, original sound IDs, mechanical sounds, routing and settings remain intact. The wider original DMD artwork and remaining feature names still need a pass. No claim is made that every game path has been tested.

The center stand-up target (`Target014`, the source SNIKT shot) is the **Doorbell**. Its ricochet feeds toward the right-ramp Friendship Multiball route: ring the bell as friends arrive early to help with preparations. Use a brief spoken "Ding-dong!" hit reaction and "Ring the doorbell." for the associated instruction asset. This is a small party moment, not a major points objective or a claim that a friend has been locked; friend-ready announcements still belong to the actual ramp locks. Only the hit-reaction ID is currently called by the source script. The earlier "small target" and "Bullseye" wording is superseded.

The four former team-ups are party supplies: Kitchen Timer (extra time), Party Lights (double task points), The Checklist (double task progress) and Party Favors (bonus points on supported events). Their callouts name the supply/effect; DMD announcements and power-meter glyphs use supply labels/icons. The gameplay counters, numerical effects and resets are unchanged. The approved callout polish uses "What's next on the list?", "Let's get these streamers flying!", "Hurry up!" at the Cake Time countdown threshold, "Right, where were we?" when that countdown ends, and "We've got a party to get ready for!" at the delayed launch reminder.

## Repository policy

Commit the accepted artwork, its required composition inputs, the saved model/layout source checkpoint, the current hardware export, licensed font, source/provenance documents and build/validation scripts. The layout checkpoint preserves the exact accepted fox so rebuilding does not depend on finding a revision in another chat.

Keep tools, original table downloads, extracted runtime data, generated gameplay/test VPX files, large generated working scenes, old concept outputs, recordings, audio captures, validation reports and embedded-video review pages local. `.gitignore` explicitly allows the current revision and the inputs needed to rebuild it. When accepting a new revision, update both that allowlist and `current-assets.json`.
