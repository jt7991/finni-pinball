---
name: "Finni's Big Day - Pixel Cabinet"
description: "A filled-pixel arcade player around the original illustrated pinball table."
colors:
  navy: "#0c102a"
  surface: "#171f3b"
  line: "#465778"
  ivory: "#faf2da"
  muted: "#c6d8e8"
  yellow: "#ffdb4c"
  pink: "#ff4b98"
  cyan: "#55d8ed"
  hover: "#283456"
typography:
  display:
    fontFamily: "Pixel, monospace"
    fontSize: "clamp(22px, 8.97vw, 35px)"
    fontWeight: 400
    lineHeight: 1.38
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Pixel, monospace"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.7
  title:
    fontFamily: "Pixel, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  touch-zone: "0px"
  control: "3px"
  surface: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.ivory}"
  button-primary-active:
    backgroundColor: "{colors.cyan}"
  button-start:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
  button-secondary:
    textColor: "{colors.ivory}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  field-initials:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.yellow}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    width: "100%"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.surface}"
    padding: "24px"
    width: "400px"
  progress:
    backgroundColor: "{colors.line}"
    height: "4px"
    width: "100%"
---

# Design System: Finni's Big Day

## Overview

**Creative North Star: "Pixel Cabinet"**

The browser player uses filled 1980s raster lettering, midnight navy, saturated arcade accents and crisp framing. Its controls stay compact and functional so the illuminated table and full-color DMD remain the visual focus. The user selected Pixel Cabinet (pixel80), replacing the earlier Asteroids lettering exploration.

The accepted revision-13 comic party-preparation world remains authoritative inside the game: Finni and friends, detailed illustrated chores, navy hardware, a bright pink cake and saturated balloon bumpers. Browser chrome uses the newer pixel display face; Chewy remains part of the native table artwork. This system documents the browser shell. The voice studio adopts the same Pixel Cabinet palette, fonts, and control styles while keeping its recording workflow; its route-specific decisions live in `.impeccable/surfaces/browser-voice-html.md`. It does not restyle the native table.

**Key Characteristics:**

- Filled pixel titles with readable sans-serif controls.
- Navy ground, yellow actions, pink headings and cyan focus or framing.
- A table-first viewport with small help and fullscreen utilities.
- Original game artwork, fixed DMD text and restrained scene-specific motion.
- Direct action, loading, error and recovery copy.

## Colors

The shell pairs a dark navy ground with bright arcade signals and warm ivory text; the frontmatter owns their exact values.

### Primary

- **Arcade Yellow** (yellow): Start, Launch, primary actions, scores and the first title line.

### Secondary

- **Cabinet Pink** (pink): The second title line and panel headings.
- **Electric Cyan** (cyan): Focus, preview brackets, progress fill, links and pressed explicit controls.

### Neutral

- **Midnight Navy** (navy): Page ground, dark field interiors and primary-action text.
- **Raised Navy** (surface): Tools, help, dialogs and settings.
- **Cabinet Line** (line): Borders, dividers and progress tracks.
- **Warm Ivory** (ivory): Main text and primary hover.
- **Cool Mist** (muted): Supporting instructions and status copy.
- **Hover Navy** (hover): Secondary-control hover fill.

**The Game Art Rule.** Shell accents frame the accepted table and DMD; they do not recolor or simplify those assets.

## Typography

**Display Font:** Press Start 2P, self-hosted as Pixel, with monospace fallback.
**Body Font:** DM Sans, self-hosted, with sans-serif fallback.

The display face supplies filled raster character at short titles and initials. DM Sans carries longer instructions, labels, settings and recovery messages. Both font files and their OFL licenses ship in browser/fonts. Chewy is retained in native game art, including registered task labels; it is no longer the browser title face.

### Hierarchy

- **Display:** The two-line title uses the frontmatter's portrait scale; wide screens use clamp(24px, 3vw, 40px). Short portrait screens use 24px and short landscape screens use 22px. Preserve the filled yellow/pink treatment.
- **Headline:** Panel headings use the pixel headline role. Dialog headings use 20px; general secondary headings use 22px with 1.6 line height.
- **Title:** The desktop toolbar uses the compact pixel title role. Touch layouts hide that title to preserve playfield space.
- **Body:** The inherited body role remains readable at compact density. Loading/help/tool labels use 12-14px as their existing component requires.
- **Label:** Tool labels use the label role. Start uses 18px at weight 700. Scores use tabular numerals; final score is 28px. Initials use Pixel at 24px, 1.6 line height and 0.25em tracking.

**The Functional Copy Rule.** Interface text explains an action or state; personality belongs in the art and authored game callouts, without slogans or decorative quips.

## Layout

The game fills the viewport without document scroll. Fit the canvas into its available region without stretching its rendered aspect ratio. Keep help, settings and high scores dismissible instead of reserving permanent sidebars or a button grid. Repeated spacing comes from the compact frontmatter scale; controls retain at least 44px touch targets and safe-area clearance.

The initial screen uses the selected title-screen composition: corner help/fullscreen utilities, a two-line title, original DMD title artwork, a cyan-bracketed table preview, loading state and one Start action. Portrait uses one column capped at 430px. At 700px and wider, or short landscape, the preview sits beside the title/action column within a 900px maximum. Short-height rules reduce gaps and Start height rather than losing the action. Loading failure hides the preview, keeps the error readable and preserves recovery. This composition belongs to this player entry state, not every future screen.

During play, desktop windows at least 1000px wide and 6:5 in aspect ratio center a portrait playfield below a 56px toolbar, with the live DMD in the spare space to its right. The DMD column stays near the table and caps at 408px. Desktop keyboard play hides the footer/button strip. Narrow portrait layouts retain the DMD above the table. Coarse-pointer devices up to 1024px keep touch controls in landscape; short landscape places the DMD and utilities beside the table. Settings become a bottom sheet on touch layouts. The help button and fullscreen utility remain reachable. On touch layouts the toolbar background is transparent; only the help and fullscreen buttons receive the surface fill. This keeps the complete DMD visible between them.

Balanced is the default camera; preserve saved choices. Top-down is a true zero-inclination overhead projection with a narrow field of view. Playfield uses uniform X/Y scale 1.08 and vertical offset 75; other presets restore scale 1. All shots, flippers, drain and DMD remain visible. Camera changes refresh the cached static projection without restarting play. Portrait canvas buffers fill their stage rather than applying the wide-buffer cropping limit.

Desktop fullscreen overlays the toolbar without resizing the table. It hides after 1.6 seconds away from the tools and returns at the reveal edge, hover, keyboard focus or an open panel. Escape exits fullscreen. The saved portrait rotation turns the complete desktop table/DMD/tools layout clockwise; settings and score dialogs rotate with it. Its reveal edge is the physical right edge. Small phones retain the ordinary unrotated touch layout. Start game and Play again request fullscreen from the click when supported and continue normally if unavailable or denied.

## Elevation & Depth

Dark tonal layers and thin borders establish the cabinet hierarchy. The game art supplies most depth; preview brackets are flat cyan strokes. Existing panels retain an ambient shadow (0 16px 48px #0008), and help retains a smaller shadow (0 8px 24px #0008). The initials dialog uses a dark translucent backdrop (#060a20df). These are floating tools over a live game, without ornamental cards or hard offset shadows.

Shell panels open without animation. Progress width changes use 0.18s steps(5, end) only when motion is permitted; fullscreen toolbar reveal uses 0.18s ease-out under the same preference. The reduced-motion path stays static. Native DMD scene timing is documented with its component below and is not a shell animation pattern.

## Shapes

Controls use the small control radius; panels, dialogs, help and messages use the surface radius. Invisible touch zones are square. Keep the crisp cyan bracket geometry and stepped CSS arrow on Start; utility icons are inline SVG. Avoid turning the shell into soft decorative cards. The native table's comic illustration and hardware shapes remain intact.

## Components

### Buttons and navigation

Primary actions are yellow with navy text, ivory on hover and cyan on active. Secondary controls use ivory text, a line-colored stroke, and the hover fill with cyan border. Disabled buttons retain half opacity. Keyboard focus is a cyan outline: 3px for buttons, fields, selects and summaries, with a 3px offset; the game canvas retains its 2px focus treatment. Utility buttons are 44px targets. Tools collapse to icons at compact widths; mobile settings and scores remain available through help/settings.

Start is a full-width entry action with a stepped arrow. Once the engine is loaded, it starts a real free-play game. The completed-game overlay offers Play again on the loaded engine, after native initials entry finishes. Closing a dialog returns focus to the canvas, and score dialogs can be skipped when the shared leaderboard is unavailable.

### Settings, fields and scores

Settings and high scores use navy floating panels with pink pixel headings, line dividers and readable supporting text. Panels are 400px wide on desktop, fluid with 8px side margins on touch layouts, and scroll within their viewport. Inputs and selects use dark interiors and visible cyan focus; initials are uppercase yellow pixel lettering. Tables use tabular numerals and right-aligned scores; the top score row is yellow. Empty/loading/failure states describe the actual state and never fabricate scores.

Automatic graphics selects Performance on phones, with half-resolution rendering, a 2048px texture cap and fewer lighting passes established before engine initialization. Detailed is an explicit choice, and applying graphics changes restarts the game. The packed table download is released after loading. These settings preserve the original engine, rules and physics; they do not establish measured physical-phone frame rates.

### Help and touch play

The small question-mark button opens keyboard help on desktop and the labeled touch guide on phones. Left and right flippers support simultaneous holds; Launch supports hold and release. Space is Action, X is forward nudge, and saved bindings migrate without discarding preferences. Keep toggle flippers and release-all behavior. Pointer cancellation, focus loss and orientation changes release controls.

Normal flipper holds stay invisible: do not show floating Flip tabs while pressed. The explicit guide may reveal cyan-tinted labeled regions. Launch appears within thumb reach only when a ball is in the plunger lane; Action stays available without a permanent footer row. Suppress browser tap highlights, selection and long-press callouts on the play surface. The shell's visual update does not alter multitouch behavior or saved cameras.

### Accepted table artwork and inserts

Preserve revision 13's detailed party-preparation illustrations: Finni and friends wrap presents, send invitations, pump balloons, hang decorations, bake cookies and prepare for Party Time. Keep navy plastics, the pink cake, saturated pink/blue/yellow balloon bumpers, stainless four-wire ramp and fox sculpture. Neutral ambient fill keeps the navy playfield readable. Registered coordinates, all seven task lamps and shared shot-arrow meanings remain authoritative; artwork must not invent gameplay progress.

The fifth chore is **Bake the Cookies**. Its registered insert keeps the existing fitted two-line Chewy label, **BAKE THE / COOKIES**, over the silver cookie tray. Its DMD shows Finni with chocolate-chip cookies and gentle steam. **Cake Time Multiball** retains its separate cake frosting/decorating presentation. The four bonus supplies remain **Kitchen Timer**, **Party Lights**, **The Checklist** and **Party Favors**.

### DMD artwork and scene motion

The browser composites original full-color bitmap sprites directly at 1024x256 with source-over alpha and one final scale. It mirrors the original native sprite assignments in a separate canvas so messages survive camera crops. Preserve complete native text rows, live instructions, progress meters, original event durations and rewards. Do not add dot grids, sampling passes or synthetic display masks; the earlier dotted treatment was rejected.

Native twelve-frame scene loops run at 160ms per frame on a separate display timer shared by native flashers, FlexDMD and the browser mirror. Browser DMD polling is 100ms on mobile rather than 50ms; native animation timing stays unchanged. Animate the illustration region only: party lights and sparkles for ambient scenes, rising balloons, candle glints, and confetti with a one-pixel cheer for rewards. Tilt, game over and table credits remain still. Browser reduced motion renders static scene sprites and responds immediately to OS preference changes. Keep lettering fixed; no flashes, blur or whole-display movement.

**Friendship Multiball** preserves the approved fox, rabbit and bear lock-to-celebration sequence. Real lock announcements show exactly one, two and three friends; only the newcomer enters, settling by 800ms within the existing 1500ms cue. The multiball-start card uses larger characters with staggered hops and confetti while its title remains fixed. Static reduced-motion sprites immediately show the correct assembled group.

Other authored moments retain flying invitations, swaying pinata, mystery rays, rolling saved ball, selection chevrons, parcel deliveries, ribbon flutter, timer hands, record rotation, snack steam and friendship hearts. Jackpot/skill-shot awards, bonuses, super combos and qualification notices use animated edge accents outside both complete native text rows. These are event-specific authored effects, without invented progress.

### Title-screen rasters and provenance

browser/start-dmd.png is the original Finni Big Day DMD title sprite, unchanged from the selected Pixel Cabinet decision sketch. browser/player-preview.png is an unchanged screenshot of the actual Finni VPX browser player, framed and cropped in CSS. Both carry their origin in the PNG's embedded impeccable:prompt text chunk; neither is a replacement for native game art. Keep provenance attached when repackaging them.

The finish review inspected fourteen desktop, phone portrait/landscape, small-phone, tablet and state captures, including real-engine play/replay. Its remaining fix was this documentation merge. Fixture screenshots demonstrate their disclosed layout/state only. Physical iPhone rendering, fullscreen and performance remain unverified; desktop emulation does not establish physical-phone results.

## Do's and Don'ts

### Do:

- **Do** keep the Pixel Cabinet shell palette, self-hosted pixel titles and DM Sans controls consistent.
- **Do** preserve accepted revision-13 table artwork, registered inserts, original DMD sprites and event timing.
- **Do** keep the table prominent, utilities compact, help discoverable and controls at least 44px.
- **Do** retain invisible flipper holds, simultaneous touch input, release cleanup, Balanced default and saved camera choices.
- **Do** keep fixed DMD text, static reduced-motion scenes and honest loading, error, score and fullscreen messages.
- **Do** preserve embedded raster provenance and bundled font licenses.

### Don't:

- **Don't** restore Asteroids-style vector titles or the superseded green/peach browser shell and Chewy shell headings.
- **Don't** add a permanent eight-button grid, surround the table with tools, or show pressed Flip tabs during normal play.
- **Don't** add DMD dot masks, extra sampling, blur, screen flashes, moving text or invented progress.
- **Don't** replace functional interface copy with slogans, decorative quips or fabricated scores.
- **Don't** treat emulated captures as proof of physical iPhone or Android performance or fullscreen behavior.
