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

The `slot-back` fixture records a target/wire pocket that also holds the ball in
native VPX. Keep this separate from port regressions. The randomized gameplay
probe still reports it as a stall; it has no blanket exception or automatic rescue.
