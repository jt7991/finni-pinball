# Finni’s Big Day

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users and Purpose
Players play the existing Finni pinball table directly in a browser. They identify scores by initials, without player accounts. The owner uses PocketBase’s admin dashboard to inspect and manage leaderboard records.

iPhone and Android players are priority users. The browser game must be comfortable to play on a phone with two thumbs, in portrait or landscape. Desktop keyboard play remains supported. A teammate recording callouts uses the voice studio; an administrator provisions team accounts and reviews submitted takes.

## Operating Context

The game is hosted on the owner's Coolify instance using the repository's standard `compose.yaml`. PocketBase provides shared scores, moderation, team accounts, and the voice-take library. Its persistent data volume must retain the database and both original and processed WAV uploads across redeploys.

Deployment must include the playable game without a separate asset upload. The built table and DMD atlas are versioned in `runtime/`, with Git LFS for the large table file, and copied into the Docker image. Source-table files, local tools, and intermediate builds remain local.

## Capabilities and Constraints
Use the actual VPX WebAssembly engine, original rules and physics, accepted Finni art and embedded audio. Preserve configurable keyboard bindings, touch buttons, toggle flippers, and automatic release on focus loss. Keep the established table-first layout with a small help button on both mobile and desktop, and settings/high scores in dismissible panels. The user explicitly rejected replacing this with a permanent eight-button grid or adding compact controls all around the edges; restore the previous controls.

The leaderboard is shared through PocketBase on the owner's Coolify instance. Browser-submitted scores are not authoritative; replay verification has not been established. Do not label them verified.

Browser play is free, with credits removed. Both DMD and full table must stay visible in every preset, including a more top-down camera. Balanced is the default camera; explicitly saved camera choices remain available.

Mobile controls must support simultaneous left and right flippers, hold-and-release launching, Action, and nudge. Browser tap highlights, text selection, and long-press callouts must not obscure or interrupt the playing surface. Controls must release on cancellation, focus loss, and orientation changes. Provide a reachable fullscreen control where the browser supports it and an honest explanation where it does not. Browser fullscreen support varies; do not promise identical behavior on iPhone and Android.

Start game and Play again request fullscreen from the player's click where supported, continuing normally if fullscreen is unavailable or denied. The fullscreen button remains available to exit or re-enter. Flipper holds must not show floating Flip tabs; the small help button reveals the labeled touch guide when needed.

Mobile usability and rendering take priority over ornamental interface work. Take inspiration from established mobile pinball games such as Williams Pinball and Pinball Deluxe: Reloaded without copying their artwork. Desktop viewport emulation is useful for layout and input checks but does not establish physical iPhone or Android rendering quality, frame rate, or fullscreen behavior.

The voice studio supports recording or uploading takes, previewing sound processing, downloading game-format WAVs, and submitting original and processed recordings for review. Team library access requires an administrator-provisioned account. Approved takes enter the game through a later build; submissions do not automatically replace live audio.

## Brand Commitments
Finni’s Big Day uses a bright comic party-preparation world with the existing fox, detailed illustrated chores, navy hardware panels, a bright pink cake, saturated pink/blue/yellow balloon bumpers, and Chewy lettering. Keep its added playful energy. The seven task lamps and shared shot arrows must match the actual gameplay. The four bonus supplies are Kitchen Timer, Party Lights, The Checklist and Party Favors.

The player interface should feel like a 1980s arcade. The user explicitly moved away from Asteroids-style vector lettering toward a later arcade era. Keep the compact player layout and small help button; the rejected permanent button grid remains outside scope. Preserve the accepted Finni table and full-color DMD artwork, and keep mobile rendering performance a priority.

Phone graphics default to a lighter Performance profile through Automatic. Offer Detailed as an explicit choice, explaining that applying graphics settings restarts the game. Rendering changes must preserve the actual engine, physics and rules.

## Voice and Copy

Use direct, functional language. No AI-generated sayings, slogans, motivational filler, whimsical onboarding lines, or decorative quips around the game. Labels and messages should explain actions, controls, game state, loading, errors, and recovery. The game artwork and authored in-game callouts can carry the character; interface copy must stay useful.

## Evidence on Hand

The repository contains the accepted revision-13 playfield artwork, hardware, DMD sprites, and packaged playable table. The user supplied an Android Chrome recording showing touch highlights and graphical artifacts. Real-engine desktop Chromium and emulated mobile checks exist, but they do not confirm that every artifact is fixed on physical phones. iPhone and Android device verification remains required before claiming reliable mobile rendering or performance.

## Principles

- Make iPhone and Android play responsive, readable, and reliable.
- Keep play uninterrupted and settings discoverable without occupying permanent playfield space.
- Let the retro interface and accepted game artwork provide character; keep interface copy functional.
- Use actual game state for scores. No player login or fabricated leaderboard entries.
- Ship a complete playable deployment and preserve team recordings across redeploys.
