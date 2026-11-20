# PocketBase and Coolify

The player runs in the browser. PocketBase stores shared scores and provides the owner dashboard. Players enter initials; they never create accounts. The web container proxies PocketBase on the same origin.

## Docker Compose

The standard `compose.yaml` builds the game web server and PocketBase, with persistent volumes for the database, uploaded WAV files, and packaged game assets. Only the web service exposes internal port **80**; the deployment proxy publishes it on your domain.

Build the regular Finni VPX table as described in the root README, then run `.tools/blender/blender-4.5.16-windows-x64/4.5/python/bin/python.exe scripts/package-browser-assets.py` to create `.work/browser-assets/` with the table and DMD atlas. It uses the existing extraction, or extracts the built table with the local vpxtool. Pillow is required (available in `.tools/pydeps`). Upload that bundle as described below.

For local Docker use, run `docker compose build`, then `docker compose run --rm --publish 8080:80 game` to start the web service with its PocketBase dependency and a localhost-accessible port. Populate the asset volume using the copy procedure below, selecting the running game container. Open `http://localhost:8080` for the game and `http://localhost:8080/_/` for the dashboard.

## Coolify deployment

1. Add `jt7991/finni-pinball` as a **Git-based Docker Compose application**, using branch `master`, base directory `/`, and Compose file `/compose.yaml`. This builds both images from the repository; pasting the YAML into an empty service does not supply the Docker build context.
2. Assign an HTTPS domain to **game**, targeting internal container port **80**. Leave **pocketbase** without a domain. The Compose file publishes no host ports; Coolify's proxy handles HTTPS.
3. Deploy. Under Persistent Storage, confirm `pocketbase_data` mounted at `/pb/pb_data` and `browser_assets` mounted at `/usr/share/nginx/html/runtime`. Coolify prefixes the actual volume names with the resource identifier. No environment variables are required.
4. Package the current game locally with `scripts/package-browser-assets.py`, as above, and upload the contents of `.work/browser-assets/` to `/opt/fin-ball/browser-assets/` on the Coolify server using SCP/SFTP. Keep all three files together: `Finni-Big-Day.vpx`, `dmd-atlas.png`, and `dmd-atlas.json`. These generated, original-derived assets are intentionally not committed or built in Docker.
5. Copy that bundle into the persistent asset volume using the server commands below. The web service can start before this upload, but playing the game requires these files. `/health` checks the web server, not whether the game assets have been uploaded.
6. Open the game domain. Use the PocketBase container log's one-use installer link on that same domain to create your admin account at `/_/#/pbinstall/...`. Open `/voice` for the recording studio; in `/_/`, create a `voice_team` account for each teammate. HTTPS enables browser microphone access.

Run these commands in a shell **on the Coolify server** after uploading the bundle. Replace the container name with the current **game** container name shown in Coolify. The helper mounts the asset volume writable; the game itself keeps a read-only mount.

```sh
GAME_CONTAINER='replace-with-game-container-name'
ASSET_VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/usr/share/nginx/html/runtime"}}{{.Name}}{{end}}{{end}}' "$GAME_CONTAINER")
test -n "$ASSET_VOLUME" || { echo 'Game asset volume not found'; exit 1; }
docker run --rm \
  --mount "type=volume,src=$ASSET_VOLUME,dst=/assets" \
  --mount type=bind,src=/opt/fin-ball/browser-assets,dst=/incoming,readonly \
  alpine:3.22 sh -ec '
    for file in Finni-Big-Day.vpx dmd-atlas.png dmd-atlas.json; do
      test -s "/incoming/$file"
    done
    cp /incoming/Finni-Big-Day.vpx /incoming/dmd-atlas.png /incoming/dmd-atlas.json /assets/
    chmod 644 /assets/Finni-Big-Day.vpx /assets/dmd-atlas.png /assets/dmd-atlas.json
  '
```

For later game updates, replace all three files during a maintenance window and repeat the copy. Redeploying application code reuses both volumes without an upload. Keep the same Coolify resource and volume names; a new resource creates new empty volumes. If migrating an existing deployment, back up and restore its PocketBase data into the new resource before accepting recordings.

### Persistent database and WAV files

The `pocketbase_data` volume contains the **entire** `/pb/pb_data` directory: database, settings, local backups, and `storage/`. The voice studio stores both uploaded `original` WAVs and `processed` WAVs as protected `voice_takes` file fields under that storage directory. They survive container replacement and redeployment with the database; a separate WAV volume is unnecessary. This describes the default local file storage; configuring PocketBase S3 storage moves uploads to that bucket instead.

Back up PocketBase through Settings → Backups with uploaded files included, and copy the backups off-host. Also retain an off-host copy of the three-file game bundle. Before relying on the deployment, submit a test recording, redeploy the same resource, and confirm its record and both playable WAVs remain. Never use `docker compose down -v` on data you intend to keep.

See Coolify's [Git-based Compose configuration](https://coolify.io/docs/applications/builds/docker-compose) and [persistent storage documentation](https://coolify.io/docs/applications/configuration/persistent-storage).

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

