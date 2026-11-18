# PocketBase and Coolify

The player runs in the browser. PocketBase stores shared scores and provides the owner dashboard. Players enter initials; they never create accounts. The web container proxies PocketBase on the same origin.

## Docker Compose

1. Build the regular Finni VPX table as described in the root README.
2. Run `.tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/package-browser-assets.py` to create `.work/browser-assets/` with the table and DMD atlas. It uses the existing extraction, or extracts the built table with the local vpxtool. Pillow is required (available in `.tools/pydeps`). Then run `docker compose up --build`.
3. Open `http://localhost:8080` for the game and `http://localhost:8080/_/` for the dashboard. On first startup, the PocketBase container log prints a one-use installer link. Open its `/_/#/pbinstall/...` path on your game domain to create **your admin account**. This does not add player authentication. Keep that link private.

For Coolify, use this repository as a Docker Compose resource with `compose.yaml`. Set the game service domain to your intended HTTPS address, with container port **80**. Do not expose the PocketBase service separately. Upload the packaged `browser-assets` directory to persistent storage on the Coolify host and set `ASSET_PATH` to its absolute host directory, for example `/opt/fin-ball/browser-assets`. Keep all three files: `Finni-Big-Day.vpx`, `dmd-atlas.png`, and `dmd-atlas.json`. These generated, original-derived assets are intentionally not committed. A missing directory fails the bind mount rather than silently creating an empty directory.

The Docker build downloads the pinned WASM engine, checking its SHA-512 checksum, and PocketBase **0.42.3**, checking SHA-256 for amd64 or arm64. The database and uploaded files live in the named `pocketbase_data` volume. Use PocketBase Settings → Backups and copy backups off-host. Preserve that volume across redeploys; `docker compose down -v` destroys it. Migrations apply automatically on startup.

No Coolify resource, DNS, or public deployment is created by these files. Docker is not installed in the development environment, so container builds must be checked on a Docker host.

## Dashboard

- `scores`: initials, score, player number, duration, version, run, submission date, `flagged`, `hidden`, and `review_note`.
- `game_sessions`: anonymous session start, one-use token hash, hashed request address, version, and consumption status. Never make this collection public.
- To remove a score from the public leaderboard, set `hidden = true`.
- To approve a flagged score, set `flagged = false`; leave a review note if useful.
- Manual admin edits are reflected on the next leaderboard refresh. Public players cannot create, edit, or delete collection records directly.

## Submission checks and limits

Custom routes issue unpredictable one-use tokens, reject duplicate runs, validate up to four player results in one transaction, enforce score/initial formats, expire sessions after 24 hours, and flag very short runs or an unusually high scoring rate. Flagged/hidden records are excluded by both the custom leaderboard endpoint and collection read rules. The web proxy rate-limits game routes; PocketBase additionally limits session creation per observed address. Behind Coolify, the immediate proxy address may group visitors, so tune forwarding and limits for the deployment rather than blindly trusting client-provided headers.

These are casual leaderboard checks, **not replay verification**. A modified browser can fabricate plausible scores. Tokens prevent duplicate submissions, not forged gameplay. Never label these records verified or use them for prizes. The original VPX script and physics remain unchanged; the browser reads final state and uses the original initials-entry handler.

Sessions remain available for audit. Periodically archive old sessions and results according to your retention needs; avoid deleting sessions that still have score references. Set up backups before editing production data.

## Local development without Docker

Install PocketBase 0.42.3, then run from the repository root:

```powershell
.tools/pocketbase/pocketbase.exe serve --http=127.0.0.1:8090 --dir=.work/pocketbase-data --hooksDir=pocketbase/pb_hooks --migrationsDir=pocketbase/pb_migrations
powershell -ExecutionPolicy Bypass -File scripts/launch-browser.ps1
```

The Python player server proxies its three leaderboard routes to `http://127.0.0.1:8090`. Set `POCKETBASE_URL` in its environment to use a different backend. The dashboard is at `http://127.0.0.1:8090/_/` during local development.

