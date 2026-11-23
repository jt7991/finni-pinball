# Finni rules direction

## Confirmed direction

- Use **Finni's Big Day**: the fox is planning his first neighborhood party. Every main mode must be an actual party-preparation task or the party itself.
- His to-do list provides the story: presents, invitations, balloons, decorations, baking, hanging the piñata, then hosting. Tasks can be chosen in the existing mode-selection order; do not require a new linear campaign.
- Skill building supports those tasks through planning, sequencing, attention, and adapting when things get busy. Present the activity and its purpose in the story; these are thematic interpretations of existing gameplay, not new skill assessments.
- Replace the earlier garden-growing, butterfly-chasing, and trail adventures. Flowers and butterflies can remain scenery and character details.
- Feature the fox, flowers, butterflies, trails, and garden scenery from Finni's website.
- Keep **Disco Loops** and **Disco Multiball**, including their disco identity and existing qualification. During planning, the fox is checking the music and getting carried away behind the decks; the final party brings the whole neighborhood together.
- Base the reskin on the downloaded JP's Deadpool v7.0.0 script and existing hardware, shot patterns, scoring, and progression.
- Callouts should be short, natural, and useful. The initial promotional and motivational lines were rejected by the user. Use occasional dry humor; leave room for music and sound effects.

## Working mode mapping

Artwork requirement: each mission lamp overlays a related object within one cohesive party-preparation scene. Use the lowered shared table/shelf; presents light a wrapped gift, invitations light an envelope, balloons light a balloon, decorations light rolled bunting, baking lights the cookie tray, piñata lights its torso, and Party Time lights the music station. Revision 10 cuts the opaque print away at all 52 inserts and uses a separate lens layer with bubbly white Chewy lettering outlined in black. Revision-6 lamp centers are registered in `mission-window-layout-v6.json`; assignments and source light shapes remain intact. See `decisions.md` for the current artwork and hardware decisions.

Hardware requirement: replace the sword appearance with an open stainless four-wire ramp and sparse underslung supports, leaving the printed piñata visible. The former peach/lilac streamer chute and curl are superseded. Retain the right-ramp ball-lock shot and original collision route. JP's VPX implements a virtual lock through `lock` on `Ramp012`, `Lock_Hit`, `ExitLock` and per-player `BallsInLock`. Preserve qualification, three-lock multiball, hold/kickout timing and release behavior. Balloon bumpers replace the ninja-star caps; Finni sits on a cake.

The main mode names are implemented in playfield labels, DMD selection/instructions/completions, active-score backgrounds and speech. The chore mapping below is approved; source gameplay is retained apart from the approved right-flipper scoop feed in `gameplay-tuning.json`.

| JP mode | Proposed Finni mode | Existing gameplay used |
| --- | --- | --- |
| Juggernaut | Wrap the Presents | Target-bank phase wraps the gifts; subsequent lit shots finish the ribbons. |
| Mystique | Send the Invitations | Center loop, with ramps joining as progress advances, represents invitation deliveries. |
| Sabretooth | Blow Up the Balloons | Outer loops and pop bumpers inflate the balloons; preserve both contributions. |
| T-Rex | Put Up the Decorations | Changing pairs of lit shots hang bunting and streamers around the garden. |
| Megalodon | Bake the Cookies | The flashing priority shot among blue shots advances baking the cookies. Cake Time Multiball handles frosting and decorating separately. |
| Sauron | Hang the Piñata | Adds two balls as friends help hoist the piñata; retain the left-ramp and cross-shot objectives. |
| Mr. Sinister | Party Time | Timed multiball with a changing flashing shot; welcome guests and host the party. |
| Ninja lock multiball | Friendship Multiball | Gather three friends through the existing virtual locks on the right ramp. New lock/start display and speech cues frame their arrival as helping prepare the party. Retain six jackpot shots and the right-ramp super jackpot. |
| Lil Deadpool multiball | Cake Time Multiball | Decorate the cake before the party: five toy jackpots add frosting, five wider-shot jackpots collect candles and decorations, then the spinner hurry-up adds the final flourish. The existing repeat cycle returns to frosting. Keep the drop bank, toy hits, jackpots, timers and scoring. |
| Disco Loops | Disco Loops | Preserve existing qualification and loop scoring. |
| Disco Multiball | Disco Multiball | Preserve existing qualification and multiball scoring. |

JP v7 starts with three selectable battles. At three wins it expands selection to six; at six wins it makes the seventh available. Preserve that progression when presenting the adventures. A battle is ready at each new ball; completing the DEAD bank also qualifies one.

The main-mode names above are approved; design/party-tasks.json is the canonical mapping. The complete DMD pass uses Confetti, Snacks, Supplies and Ribbons for collectibles; Supply Run Multiball, Streamer Rush, Spinner Rush and Confetti Burst for secondary features. The canonical mapping is design/finni-dmd-theme.json. Earlier Little Wins and flower mappings are superseded.

## Revised voice samples

The approved November 18 multiball stories are implemented as presentation changes: Friendship on the right ramp and Cake Time at the middle toy. Cake Time is decorating before the party, not serving slices or starting the celebration. Its playfield label, DMD title/jackpots and phase-specific voice/display instructions now use this story. Timers never claim the cake was completed; the spinner timer returns to another frosting round.

The center ricochet target feeding toward the Friendship ramp is the **Doorbell**. Its two-tone doorbell sound represents friends arriving early to help; the three actual locks still count friends ready. The shot's original points and physical behavior are retained.

The approved party-supply replacements are installed: Kitchen Timer (Dazzler: extra time), Party Lights (Colossus: double battle points), The Checklist (Wolverine: double battle progress/damage), and Party Favors (Domino: extra points on supported events). Each has its own spoken announcement, DMD name/effect and small supply icon. Existing qualification counters, effects and resets remain source behavior; friends belong to Friendship Multiball.

The table below records the earlier line direction. The current implemented transcript, including mode names, shot instructions, full random-remark and toy-reaction banks, and the ball-save announcement, is `finni-callouts.json`. The user selected a warm female voice; the current trial uses Jenny Neural at -5% rate.

| Event | Sample |
| --- | --- |
| Mode selection | "What's next on the list?" |
| Correct shot | "That's the one." |
| One qualifying hit remains | "One more." |
| Lock qualifies | "Shoot the right ramp to gather your friends." |
| Ball lock | "One friend is ready." / "Two friends are ready." |
| Friendship starts | "Friendship multiball. Everyone's here to help." |
| Cake Time starts | "Cake Time multiball. Shoot Finni to add the frosting." |
| Jackpot | "Jackpot!" |
| Disco qualifies | "Disco's ready." |
| Disco starts | "Let's dance." |
| Party starts | "Everyone's here." |

Potential situational lines include "Forgot the plates." and "Who requested this?" Use only where a scene or event gives them context. Final wording and delivery remain open.

Use progress-specific cues only when the actual rule state supports them. Prioritize clear shot instructions and milestone announcements. Avoid narrating every switch hit; let drains pass without a stock joke.

## Source

Verified against `.work/deadpool-extracted/script.vbs` and `info.json` from the local JP's Deadpool v7.0.0 table. Approved script changes are the scoop's eject speed/inclination and presentation-only multiball display/audio cues. `validate-multiball-story.py` checks that all non-presentation script remains identical apart from the scoop feed.
