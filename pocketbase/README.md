# PocketBase and Coolify

The player runs in the browser. PocketBase stores shared scores and voice recordings and provides the owner dashboard. The web container proxies PocketBase on the same origin.

## Docker Compose

`compose.yaml` builds the game web server and PocketBase. The game image includes the versioned table and DMD atlas from `runtime/`. The PocketBase volume persists the database and uploaded WAV files independently of the image.

For local Docker use:

```sh
git lfs install
git lfs pull
docker compose build
docker compose run --rm --publish 8080:80 game
```

Open `http://localhost:8080` for the game and `http://localhost:8080/_/` for the dashboard. No asset upload is needed.

## Coolify deployment

1. Add `jt7991/finni-pinball` as a **Git-based Docker Compose application**, using branch `master`, base directory `/`, and Compose file `/compose.yaml`.
2. Enable **Git LFS** in the application's Advanced settings before deploying. The table exceeds GitHub's regular file size limit and is tracked with LFS. The Docker build fails with a clear message if it receives a pointer instead of the table.
3. Assign an HTTPS domain to **game**, targeting internal container port **80**. Leave **pocketbase** without a domain. No environment variables or host port mappings are required.
4. Deploy. Under Persistent Storage, confirm `pocketbase_data` mounted at `/pb/pb_data`. Coolify prefixes its actual name with the resource identifier. The game assets are already in the image; do not mount a volume over `/usr/share/nginx/html/runtime`.
5. Use the PocketBase container log's one-use installer link on the game domain to create your admin account at `/_/#/pbinstall/...`. Open `/_/` for the dashboard and `/voice` for the recording studio. Create a `voice_team` account for each teammate in the dashboard. HTTPS enables browser microphone access.

If updating an earlier deployment, remove the old `browser_assets` mount from the game service so it cannot hide the bundled assets. Preserve the existing PocketBase volume and resource. A new Coolify resource creates a new empty database unless you restore its backup.

## Updating the bundled game

After rebuilding the table locally, regenerate all three deployment files together:

```powershell
& .tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/package-browser-assets.py
```

The default output is `runtime/`: `Finni-Big-Day.vpx`, `dmd-atlas.png`, and `dmd-atlas.json`. Commit these files together and push with Git LFS installed. Docker copies them into the image on the next deployment. The packaging script requires the local table extraction (or vpxtool) and Pillow; Coolify only needs the committed bundle. Original source tables, tools, and intermediate build files remain local.

## Persistent database and WAV files

The `pocketbase_data` volume contains the entire `/pb/pb_data` directory: database, settings, local backups, and `storage/`. Both `original` and `processed` WAVs are protected `voice_takes` file fields stored there. No separate WAV volume is required. Configuring PocketBase S3 storage moves uploads to that bucket instead.

Set up PocketBase Settings ? Backups with uploaded files included, and copy backups off-host. Submit a test recording, redeploy the same resource, and confirm its record and both WAVs remain. Keep the same resource and volume name; `docker compose down -v` deletes persistent data.

The Docker build downloads the pinned WASM engine with SHA-512 verification and PocketBase **0.42.3** with SHA-256 verification for amd64 or arm64. Migrations apply automatically on startup. Docker is not installed in the development environment, so container builds must be checked on a Docker host.

See Coolify's [Compose configuration](https://coolify.io/docs/applications/builds/docker-compose) and [Git LFS settings](https://coolify.io/docs/applications/configuration/advanced).

## Dashboard

- `scores`: player name (stored in the legacy `initials` field, 1–12 uppercase letters or numbers), score, player number, duration, version, run, submission date, `flagged`, `hidden`, and `review_note`.
- `game_sessions`: anonymous session start, one-use token hash, hashed request address, version, and consumption status. Never make this collection public.
- To remove a score from the public leaderboard, set `hidden = true`.
- Scores publish immediately. Legacy `flagged` and `review_note` fields no longer affect visibility.
- Manual admin edits are reflected on the next leaderboard refresh. Public players cannot create, edit, or delete collection records directly.

## Submission checks and limits

Custom routes issue unpredictable one-use tokens, reject duplicate runs, validate up to four player results in one transaction, enforce score/initial formats, and expire sessions after 24 hours. Scores publish immediately regardless of game duration or scoring rate, including previously flagged scores. Only records explicitly marked `hidden` are excluded by the custom leaderboard endpoint and collection read rules. The leaderboard groups visible results by name and returns the best 25 distinct names; ties use earliest submission, then record ID. Hiding a name’s best result reveals its next-best visible result. Raw collection reads still expose individual game results. The player-name migration expands the existing field without deleting scores; its rollback intentionally preserves longer saved names. The web proxy rate-limits game routes; PocketBase additionally limits session creation per observed address. Behind Coolify, the immediate proxy address may group visitors, so tune forwarding and limits for the deployment rather than blindly trusting client-provided headers.

These are casual leaderboard checks, **not replay verification**. A modified browser can fabricate plausible scores. Tokens prevent duplicate submissions, not forged gameplay. Never label these records verified or use them for prizes. The original VPX script and physics remain unchanged; the browser reads final state and uses the original initials-entry handler.

Sessions remain available for audit. Periodically archive old sessions and results according to your retention needs; avoid deleting sessions that still have score references. Set up backups before editing production data.

## Local development without Docker

Install PocketBase 0.42.3, then run from the repository root:

```powershell
.tools/pocketbase/pocketbase.exe serve --http=127.0.0.1:8090 --dir=.work/pocketbase-data --hooksDir=pocketbase/pb_hooks --migrationsDir=pocketbase/pb_migrations
powershell -ExecutionPolicy Bypass -File scripts/launch-browser.ps1
```

The Python player server proxies its three leaderboard routes to `http://127.0.0.1:8090`. Set `POCKETBASE_URL` in its environment to use a different backend. The dashboard is at `http://127.0.0.1:8090/_/` during local development.

