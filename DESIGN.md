# Browser player design

The accepted table artwork is revision 13's bright comic party-preparation scene, with navy plastics, a pink cake and saturated balloon bumpers. Keep the expressive, playful energy and the detailed task illustrations. Ambient fill keeps the navy table readable. The exact insert coordinates and active-shot meaning remain authoritative.

Space is the dedicated Action input and X is forward nudge; older saved bindings migrate without losing preferences. After a completed game, the existing start overlay offers **Play again**, starting a free-play game on the loaded engine. Native initials entry finishes first; score dialogs can be skipped even when the online leaderboard is unavailable. Closing a dialog returns focus to the canvas.

The fifth chore is Bake the Cookies. Its registered playfield insert retains the existing two-line Chewy label, fitted as BAKE THE / COOKIES over the silver cookie tray. Its DMD shows Finni with chocolate-chip cookies, with gentle steam, while Cake Time Multiball keeps its separate frosting/decorating presentation and cake artwork.

Friendship Multiball has an authored lock-to-celebration sequence using the approved fox, rabbit and bear art. The first, second and third real lock announcements show exactly one, two and three friends; only the newcomer enters, settling by 800ms within the existing 1500ms cue. The multiball-start card uses larger characters with staggered hops and confetti, keeping its title fixed. Static reduced-motion sprites show the correct assembled group immediately.

Additional game moments use distinct pixel actions: flying invitations, a swaying pinata, mystery reveal rays, a rolling saved ball, selection chevrons, parcel deliveries, ribbon flutter, timer hands, record rotation, snack steam and friendship hearts. Live jackpot/skill-shot awards, bonuses, super combos and qualification notices use animated edge accents confined outside both complete native text rows. These effects follow the original event timings and rewards, without representing invented progress.

DMD scene motion preserves the approved full-color pixel art. Animate only the illustration region: party lights and sparkles for ambient scenes, rising balloons, candle glints, and confetti with a one-pixel cheer for rewards. Native twelve-frame loops run at 160ms per frame on a separate display timer, shared by native flashers, FlexDMD and the browser mirror. Keep all lettering, live instructions and progress meters fixed. Tilt, game over and table credits remain still. Browser reduced motion renders the static scene sprite and responds immediately when the OS preference changes. No screen flashes, dot masks, blur or whole-display movement.

The game is the visual authority. The surrounding interface recedes into deep green-black to reduce glare beside the illuminated table. Cream type, restrained peach action accents, and Chewy only for the Finni title connect it to the existing playfield.

The user selected a game-first layout: one compact toolbar, a viewport-filling stage, and a small bottom input strip. Controls and high scores open in dismissible popovers; neither occupies a permanent sidebar. The loading screen is an intentional game start state, not a marketing hero. Settings use semantic controls, clear labels, visible focus, and no decorative cards.

The default viewport has no document scroll on desktop. The canvas fits inside its available region without stretching. Compact widths shorten navigation labels and wrap essential touch actions. Touch targets remain at least 44 pixels. Reduced motion disables panel animation. Scores use tabular numerals; ordinary interface text uses a readable sans serif.

Phone adaptation draws on the table-first hierarchy in Williams Pinball and Pinball Deluxe: Reloaded: a persistent upper DMD, a portrait table, large lower-left/right flipper touch areas, and a launch action within thumb reach. It does not borrow their artwork. Phone settings are a bottom sheet; the duplicate toolbar scoreboard is removed to preserve table height. Balanced is the phone default; all three camera choices remain available without restarting play. The DMD mirrors the original native sprite assignments into its own canvas, so it does not disappear outside a camera crop.

Top-down now means a true zero-inclination overhead projection with a narrow field of view, and remains available as an alternate camera. Balanced is the default on all devices. Camera changes invalidate the engine's cached static projection and re-enable static rendering after two frames. On phones, the title row is removed, navigation sits beside the DMD, and the camera picker lives in Controls. Only a short input strip remains below the table. DMD artwork is composited first, sampled to a 128×32 matrix, and rendered through a generated dot mask; the original dense texture grid must not be scaled independently because it produces moiré at phone pixel ratios.

The user rejected fuzzy/dotted rendering. The final display therefore composites the original full-colour bitmap sprites directly at 1024×256, with source-over alpha and one final browser scale. Do not add dot grids, sampling passes, or synthetic display masks. On mobile, a question-mark button toggles a touch guide: lower left/right hold the flippers and the middle taps a forward nudge. Start is centered before play; Launch appears at lower right only while a ball is in the plunger lane. The input strip disappears during normal play to maximize table space. The initial Start game button also starts the actual free-play game after loading the engine.


On wide desktop windows (at least 1000px wide and a 6:5 aspect ratio), keep the
playfield centered in a portrait region spanning the full height below a 56px
toolbar. Move the live DMD into the unused space immediately to its right.
Its 408px column stays grouped near the table on larger monitors. Hide the
desktop footer and on-screen button strip; desktop play uses keyboard controls.
This reclaims the former DMD/header-control rows
without cropping any part of the table or changing camera presets. Narrow and
portrait layouts retain the upper DMD and existing phone touch behavior.


The Playfield camera is a closer overhead preset: uniform X/Y scale 1.08 with
vertical offset 75, preserving ball proportions and leaving all shots, flippers
and the drain visible while showing less of the unused lower apron. The other
presets explicitly restore scale 1. Camera choice remains saved locally.

During desktop fullscreen play, the toolbar overlays rather than occupies
playfield space. It hides after 1.6 seconds away from the tools; moving to the
top edge, hovering the bar, keyboard focus or an open popover reveals it.
Escape exits fullscreen. The toolbar does not move the table when revealed.

The portrait toolbar button rotates the complete table/DMD layout 90 degrees
clockwise for physically rotating a laptop or monitor. It saves its state and
returns to landscape with the same button. The DMD sits above the table in
that logical portrait layout. Canvas presentation preserves the engine render's
aspect ratio when switching during play; keyboard bindings remain unchanged.
In rotated fullscreen, the controls reveal edge is the physical right edge.
Settings and score dialogs rotate with the game. Small phone widths retain the
existing unrotated touch interface.


Mobile player refinement (Android Chrome): follow the table-first framing and compact upper display seen in [Pinball Deluxe: Reloaded](https://www.pinballdeluxereloaded.com/) and [Williams Pinball](https://zenstudios.com/games/williams-pinball/). Preserve Finni art and gameplay. The top-right fullscreen button stays reachable on phones; a touch guide opens settings and settings also expose high scores. Launch and Action float within thumb reach instead of reserving a footer row. Touch zones suppress browser tap highlights and callouts while keeping small peach pressed labels and keyboard focus. Coarse-pointer devices up to 1024px retain touch controls in landscape, with the DMD beside the table. Portrait canvas buffers must fill the stage rather than using the wide-buffer cropping limit. Balanced is the default; saved camera choices remain intact. Mobile DMD polling runs at 100ms rather than 50ms; native animation timing remains unchanged.
