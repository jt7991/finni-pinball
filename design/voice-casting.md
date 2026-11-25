# Team voice recording

Any teammate can choose any callout from the list ordered by how difficult the callouts are to trigger at `/voice`. Use your natural voice. Keep instructions clear, reactions quick, and celebrations upbeat. Record one line per take in a quiet room, with a brief pause before and after. Keep each take under 30 seconds, listen to the preview, and download the WAV.

The studio lists only callouts the current table can play.

Mini Finni has three toy reactions. `design/finni-callouts.json` maps 41 additional toy sound IDs to those same recordings.

The default “Ouch!” clip comes from [Legnalegna55’s Freesound recording](https://freesound.org/people/Legnalegna55/sounds/547344/) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). “Oh!” and “That tickles.” are trimmed from the existing Finni table’s `vo_lildp2` and `vo_lildp25` recordings at commit `6f8116d`.

## Automatic insertion into the game

For previously submitted recordings, reviewers approve one take per recording task in the PocketBase dashboard. Then use `scripts/import-team-voices.py` with a team-member session token in the `VOICE_TEAM_TOKEN` environment variable. Keep the token out of source files and command arguments.

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

Run with `--voice-only --voice-ai` and use Clean up with ElevenLabs explicitly after recording or uploading. The UI shows a cost estimate before the paid request. Compare original and processed takes, undo or reapply the cached cleanup without another request, then download the WAV. Use a quiet setup for the clearest source recording. See the README for Secrets Manager access and local startup.
