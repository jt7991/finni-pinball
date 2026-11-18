# Finni’s Big Day

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
Finni’s Big Day is a neighborhood garden party with the existing fox, cake, balloons, mint and peach hardware, and Chewy lettering. The requested redesign concerns the interface around the screen, not the table artwork.

## Principles
Keep play uninterrupted. Keep settings discoverable without occupying permanent playfield space. Use actual game state for scores. No player login or fabricated leaderboard entries.
