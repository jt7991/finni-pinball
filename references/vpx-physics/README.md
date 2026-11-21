# VPX physics reference

The collision response and target geometry in the Three.js experiment derive
from Visual Pinball contributors' GPLv3-or-later sources at commit
`195f214dd4849b8ef6113fd377258b78d0dec3bf`, the revision pinned by
`@valknar/vpinball-wasm` 0.3.4.

The unmodified target mesh headers are retained here so the generated collision
geometry can be reproduced without fetching upstream files. See
`three/public/licenses/VPX-Physics-NOTICE.txt` and `GPL-3.0.txt`.

Native measurement fixtures include their source-table hash, controlled-table
hash and the exact comparison overrides. `scripts/prepare-vpx-contact-reference.py`
builds a separate zero-scatter table under this worktree's ignored `.work/`;
`scripts/serve-vpx-reference.py --metadata ... --port 0` serves that copy with
matching metadata. The original table is never changed.

The corrected contact probe waits for the real plunger switch and verifies four
balls at selection time: three animation balls followed by the playable ball.
Earlier contact measurements selected an animation ball during startup. They
remain explicitly scoped as a raw-engine baseline; the authored ball controller
does not apply to that ball. The separate playable-ball fixture includes the
authored 10ms spin/speed controller and records unresolved contact divergences.

The separate `vpx-heel-milliseconds.json` fixture also records native timer
callbacks and ball state every millisecond. Build its diagnostic table with
`prepare-vpx-contact-reference.py --source-root PATH --instrument-timers`, serve
`.work/vpx-timing-reference/zero-scatter.vpx` with its matching metadata, then run
`check-three.py URL --native-contact --case=right-35-40 --exact-input-delay=23`.
The normal source and regular zero-scatter reference are untouched. The source
diff and table hash record the added observation/input code. STATE rows observe
the ball after the preceding millisecond's physics, before the current update;
linear/angular velocity fields are encoded as integers at 1e6 scale.

The trace identified skipped contact handling at zero-time impacts. Native
contacts still cancel their recorded incoming normal velocity at dtime=0. The
port now preserves this behavior through the coupled floor/flipper heel shot.

`vpx-nudge.json` combines three directions, each captured with `--nudge --case=...`
after a fresh native engine start. The default native cabinet model uses a 25ms
force envelope, separate side/front oscillators and acceleration projected onto
the playfield slope. The pocket fixture adds `--pocket --no-timer-trace`, waits
about one second through the native delayed callback, and retains the observed
input time. Both native and port remain trapped after the same side nudge.

The `slot-back` fixture records a target/wire pocket that also holds the ball in
native VPX. Keep this separate from port regressions. The randomized gameplay
probe still reports it as a stall; it has no blanket exception or automatic rescue.
