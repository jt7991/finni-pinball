# Finni contact sound direction

The previous party generator assigned C5-and-up mallet notes to ordinary contacts. `aTriggers_Hit` calls `PlaySfx`, which randomly selects one of 39 cues; many lasted 900 ms and played a three-note chime. Separately, the shipped spinner recording had about 79% of its spectral energy above 2 kHz. These are two distinct contributors to bright, repetitive contact audio. The source switch recording itself was predominantly low-frequency, but its 263 ms tail also overlapped the added effects.

## References

- [VPW: Adding Fleep, part 1](https://www.youtube.com/watch?v=rG35JVHxtx4): the tutorial identifies its mechanical recordings as coming from Theatre of Magic. The useful reference is physical contact character, rather than musical decoration on every switch.
- [VPW Fleep recording/integration guide](https://vpw-wiki.skirmishofwit.com/reference/fleep-sounds/): separates rollovers, rubber, metal, wood and gate contacts. Its cartridge examples include Bride of Pinbot using Pinbot sounds, Bad Cats using Bride of Pinbot sounds, and newer TNA/Whirlwind flipper variants. Sounds should fit the mechanism and cabinet; this does not imply every table should use the same sample pack.
- [PinGame Journal: Pinball Sound with David Thiel](https://www.youtube.com/watch?v=LYjKzryUTLw): a design reference covering The Hobbit, Lexy Lightspeed and Alien. The publication description establishes the scope; it was not used as a source of extracted audio.
- [Nudge: the sound-designed worlds of David Thiel](https://www.nudgepinball.com/articles/q-bert-super-spinners-and-monday-night-football-the-sound-designed-worlds-of-david-thiel): describes Monday Night Football repeating ramp shots with rising pitch and Secret Service's themed cues. This suggests reserving musical escalation for meaningful progress rather than random everyday contacts.

These are documented references, not a claim of a listening comparison between all those tables. No other table's samples were downloaded or copied.

## Implemented pass

Routine `sfx1–39` are now three related families of dry, filtered-noise taps, knocks and brief rattles, with deterministic variations. They last 85–130 ms at lower levels, with no sustained musical pitch. The target's fourth task-hit cue also uses a knock, matching the short contact vocabulary.

`fx_sensor` is a 65 ms subdued closure click; `fx_spinner` is a 45 ms tick with a small second contact. Both are synthesized originals, not real mechanical recordings or an installed Fleep package. Their existing table-speaker routing and positional playback remain intact. Balloon bops and all other mechanical recordings stay as shipped.

Multiplier, power and fanfare cues retain ascending musical movement but move into a lower register. No switch events, scoring, flasher timing, voice triggers, soundtrack, speech or rule statements change. Replacing samples also leaves the script's existing random pitch and velocity handling intact.

The generator builds a family sampler at `output/party-audio/finni-audio-sampler.wav`. A local before/after audition uses identical sequences of switch contacts, layered random accents, a rapid spinner burst, balloon hits and progress cues. This is an effects audition, not a recording of gameplay or a full-mix listening certification.

## Validation of the packaged table

Reassembled and extracted `runtime/Finni-Big-Day.vpx`: all 54 generated WAVs match decoded PCM, use 32 kHz 16-bit PCM, and meet the existing effect RMS/peak limits. Switch/spinner files are mono for VPX positional playback; backglass effects are stereo. Sound IDs, volume/balance/fade/output routing match the previous package. All 322 other sound files and all non-audio extracted files, including the complete script, are byte-identical. The matched audition includes a 16-contact spinner burst at 75 ms intervals and does not clip.

`vpxtool audit` reports zero errors and the same 13 warnings as the previous package. The complete source-based speech/music validator was not run: this checkout lacks the original Deadpool extraction and generated voice/music reports. Instead, the package-to-package comparison above verifies those assets were preserved. Live engine playback and the final subjective full mix remain to be auditioned.
