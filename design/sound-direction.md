# Finni contact sounds

The switch pass covers the positional rollover and spinner sounds, the random backglass contact bank, and the bumper and task-hit accents. The existing positional sounds for targets, pop bumpers, slingshots, gates, scoops and ball handling remain in use. The contact accents sit below the voice and progress cues, and each spinner tick is short enough for rapid repeated playback.

The source for every new clip is Joseph Sardin’s [Theater of Magic pinball, without glass, gameplay sounds #1](https://bigsoundbank.com/theater-of-magic-pinball-without-glass-gameplay-sounds-1-s3614.html), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). BigSoundBank recorded a real Bally Theater of Magic close up with the glass removed. The cuts below are labeled by their use in Finni. The gameplay recording captures several mechanisms, so the names describe how each excerpt is used in the mix.

| Clips | VPX use | Start / duration in source (seconds) |
| --- | --- | --- |
| Switch | `fx_sensor`, rollovers and lane/ramp sensors | 5.012 / 0.071 |
| Spinner | `fx_spinner`, short metallic tick for both spinners | 9.520 / 0.056 |
| Taps | `sfx1–39`, light switch accents | 7.446 / 0.085, 10.435 / 0.086 |
| Knocks | `sfx1–39` and `sfx_hit4`, firmer switch accents | 0.532 / 0.125, 3.386 / 0.108 |
| Rattles | `sfx1–39`, short switch accents with a tail | 10.587 / 0.132, 9.631 / 0.131 |
| Bumper accents | `sfx_hit1–3`, `sfx_sword1–3`, backglass accents for bumpers and task hits | 3.986 / 0.174, 12.426 / 0.164 |

The clips in `assets/finni/audio/switches` were trimmed, band-limited to 85 Hz–8.5 kHz, faded at both ends and converted to 32 kHz, 16-bit PCM. The effect builder applies per-family RMS targets and peak caps. The switch and spinner clips are mono for VPX positional playback. Backglass accents are stereo and retain the original sound IDs, balance, volume and fade settings.
