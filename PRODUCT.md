# Finni’s Big Day

## Three.js experiment branch

The user explicitly requested a full independent Three.js port to address mobile loading and performance. On `experiment/threejs-pinball`, this supersedes the VPX-only runtime constraints below: use Three.js rendering and independent physics while retaining the complete authored rules, scoring, tasks, multiball, accepted artwork and open wire ramp appearance, DMD, audio, controls and backend integration. Keep the VPX player as a comparison fallback. Do not reduce this branch to a simplified physics demo. See `three/README.md` for implementation and validation status.

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users and Purpose
Players play the existing Finni pinball table directly in a browser. They identify scores by initials, without player accounts. The owner uses PocketBase’s admin dashboard to inspect and manage leaderboard records.

## Capabilities and Constraints
Use the actual VPX WebAssembly engine, original rules and physics, accepted Finni art and embedded audio. Preserve configurable keyboard bindings, touch buttons, toggle flippers, and automatic release on focus loss. The game leads: the user explicitly chose a screen-filling playfield with controls and leaderboard opened only when needed.

The leaderboard is shared through PocketBase, on the user?s Coolify instance. Browser-submitted scores are not authoritative; replay verification has not been established. Do not label them verified.

Hosting is the user’s Coolify instance. Supply Docker configuration and local verification; do not set up Coolify. Browser play is free, with credits removed. Both DMD and full table must stay visible in every preset, including a more top-down camera. Mobile layout should take inspiration from existing phone pinball games.

## Brand Commitments
Finni’s Big Day uses a bright comic party-preparation world with the existing fox, detailed illustrated chores, navy hardware panels, a bright pink cake, saturated pink/blue/yellow balloon bumpers, and Chewy lettering. Keep its added playful energy. The seven task lamps and shared shot arrows must match the actual gameplay. The four bonus supplies are Kitchen Timer, Party Lights, The Checklist and Party Favors.

## Principles
Keep play uninterrupted. Keep settings discoverable without occupying permanent playfield space. Use actual game state for scores. No player login or fabricated leaderboard entries.
