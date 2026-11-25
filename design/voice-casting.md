# Team voice casting

Give each teammate a small recording set to start. These are sets to distribute, not a separate character for every performer. Someone can take another set later, and the gameplay sets can go to different teammates. Team names are not assigned yet; the studio does not reserve sets or enforce performer assignments.

| Character or recording set | First session | Owns |
| --- | ---: | --- |
| Mini Finni | 3 | Complete toy reaction set, reused across all 44 reaction slots. |
| Cake Time host | 12 | Cake Time introductions, instructions, jackpots, and timer cues. |
| Finni the host | 8 | Party welcomes, task prompts, and celebrations. |
| Party crew | 25 | A helpful friend announcing tasks, supplies, and party moments. |
| Shot guide · basics | 21 | Ramps, loops, targets, and skill shots. |
| Shot guide · party modes | 24 | Context-specific instructions for tasks and party modes. |
| Scorekeeper · combos & multipliers | 19 | Combo levels, bonus levels, and playfield multipliers. |
| Celebrations · rewards | 16 | Jackpots, extra balls, multiball, and reward readiness. |
| Welcome & timers | 22 | Player numbers, start-of-game cues, timers, and remaining game guidance. |

## Character continuity

Keep Mini Finni’s toy reactions with one person. There are three recordings total. `design/finni-callouts.json` maps the other 41 toy sound IDs to these recordings. The importer copies the chosen WAV bytes to every corresponding game slot, preserving the existing triggers and game rules. Each slot is still available, but the performer only records the three lines.

The default “Ouch!” clip comes from [Legnalegna55’s Freesound recording](https://freesound.org/people/Legnalegna55/sounds/547344/) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). “Oh!” and “That tickles.” are trimmed from the existing Finni table’s `vo_lildp2` and `vo_lildp25` recordings at commit `6f8116d`.

The Cake Time host can be a different person: they guide the mode while Mini Finni remains the little toy being hit.

Gameplay instructions do not require a single announcer. Give each context set to a different willing teammate. Keep closely related cues together: player numbers in Welcome & timers, combo levels in Scorekeeper, and Cake Time guidance with the Cake Time host. Match pronunciation and sound settings across all instruction voices. Cast by game ID and context, since identical words can occur in different modes.

## First session

1. Choose a recording set. No one needs to commit to the whole game.
2. Try three lines: a short cue, a longer instruction or remark, and an excited moment. For Mini Finni, try “Oh! Hello there.”, “A little warning next time?”, and “You found me.”
3. Listen together, select a reference performance, and note who owns each set. Agree how to pronounce Finni and the task names.
4. Use the same quiet room, microphone distance, and sound settings within each set. Use the performance to give each character its personality.
5. Use `/voice` to select the character or recording set. Record one line per take, with a brief pause at each end. Submit a second delivery only when useful. Keep takes under 30 seconds, without music or added effects.

Review a sequence across different teammates to check that the voices sound like they belong at the same party. Listen to originals for performance, then processed takes for consistent level. Request pickups from the set’s original performer where possible. Offer extra sets after the first round, rather than assigning someone a large script up front.

New submissions store the selected set in their sound settings. Older submissions without a role appear as “Unassigned role”. Takes require review and a game build before appearing in play. No game audio is changed by organizing these recording sets.

`browser/voice-cast.json` defines the names, direction, ID assignments, and script IDs. Unassigned new game IDs go to Welcome & timers for review. The studio validates overlaps and unknown explicit IDs when loading. Refresh `browser/voice-lines.json` through the existing exporter when the game script changes, then review the casting for new lines.


## Automatic insertion into the game

Reviewers approve one take per recording task in the PocketBase dashboard. Then use `scripts/import-team-voices.py` with a team-member session token in the `VOICE_TEAM_TOKEN` environment variable. Keep the token out of source files and command arguments.

```bash
python3 scripts/import-team-voices.py --url https://your-game.example.com
```

This downloads approved processed WAVs into `.work/team-voices/`, checks 32 kHz stereo 16-bit PCM, expands the Mini Finni aliases byte for byte, and writes `voice-report.json` with take IDs, speakers, hashes, reused sources, and missing recording tasks. Multiple approved takes for a line, outdated transcripts, and invalid WAVs stop the import. The importer skips custom lines and retired random chatter. No audio is generated.

To insert approved audio into an already-built extracted table:

```bash
python3 scripts/import-team-voices.py --url https://your-game.example.com --install .work/finni-live-extracted
```

The importer preserves existing sound IDs and leaves sounds without an approved replacement unchanged. Use `--require-complete` to require all active recording tasks before writing or installing anything. All three Mini Finni takes cover its 44 game slots. Approved takes for retired reactions are skipped. Build the base table before importing so a later base build does not overwrite the team recordings.

After installation, assemble the extraction with the existing vpxtool workflow, validate the packaged audio, and update the deployed `runtime/Finni-Big-Day.vpx` through the usual release process. Approval alone does not publish a new table. The import command can be added to that build process for repeatable updates; it does not poll the live service or deploy on every approval.


## Recording enhancement

Keep each teammate recognizably themselves. The local studio uses ElevenLabs Voice Isolator for AI noise cleanup, followed by local filtering, gentle compression, level matching and optional end trimming. It processes the actual recording without a target voice, clone, remix or blended second performance. Use Clean & natural for a consistent, natural starting point. The more theatrical local effects remain optional.

Run with `--voice-only --voice-ai` and use Clean up with ElevenLabs explicitly after recording or uploading. The UI shows a cost estimate before the paid request. Compare original and processed takes, undo or reapply the cached cleanup without another request, then submit for review. Keep the same setup across a recording set; AI cleanup cannot substitute for a clear source recording. See the README for Secrets Manager access and local startup.
