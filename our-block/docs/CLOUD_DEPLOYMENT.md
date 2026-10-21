# Free cloud deployment runbook

Budget: $0. Oracle and paid fallback machines are excluded. The browser game and Unity builds have independent release gates.

## Prepared code

- Render blueprint: Free, one replica, manual deploys, no disk, secret DATABASE_URL required. The server refuses to run on Render with local SQLite.
- Storage: local SQLite or remote Postgres via the same async interface. pg requires verified TLS on remote connections. Only explicit localhost tests can disable TLS. Per-town queues serialize actions, lifecycle events, movement and saves. Acknowledged actions are committed before publishing state.
- Reconnection: health request wakes the service; bounded exponential backoff recovers a known seat. No purchases are replayed automatically. Unconfirmed first-time town creation requires a fresh user decision to avoid creating duplicates.
- No periodic database writes for clean empty towns; pool connections close after 10 idle seconds. No artificial traffic keeps Render awake. Automatic WebSocket ping/pong detects lost players during active sessions.
- Protocol version remains 1. Scene/world data has its own version 1.

## Accounts and provisioning

1. Sign into GitHub, Render and Neon. Accept provider terms yourself. Keep free plans selected and do not enable paid overages. Check whether other projects already consume the account's free quota.
2. Create a Neon Free project named OUR BLOCK. Choose a region close to the Render service and copy its pooled Postgres connection URI into Render's secret DATABASE_URL field. Never place it in source, browser code, invitation links or chat output.
3. Connect the private GitHub repository to Render. Use the repository blueprint at our-block/render.yaml. Verify Free compute and no persistent disk before creating the service. Keep one replica, including during deployments; avoid rolling overlap with two writers. Redeploy during a playtest maintenance window if the platform cannot guarantee that.
4. Render builds the existing Node 24 Dockerfile and serves the frontend and /ws from one HTTPS origin. No DNS purchase is required. Use its generated onrender.com hostname.
5. Set DATABASE_URL before first startup. A missing value is a deployment failure, not permission to create an ephemeral SQLite database.
6. Verify /health, a new invitation room, four seats, a full garden commission, refresh recovery and a manual redeploy. Then test from two genuinely different networks. Keep public-release acceptance incomplete until that happens.

The repo includes both games in separate directories. Only OUR BLOCK is deployed by this blueprint. LAST LIGHT has independent storage and remains preserved.

## Import existing towns

Before import, stop changes to the source town or take a consistent SQLite backup. A verified pre-cloud copy is in the ignored root backups directory. Imports are explicit and transactional; any conflicting code aborts the entire import. No overwrite switch is provided.

From our-block/, set DATABASE_URL in your private terminal environment, then run:

```sh
npm run migrate:cloud -- ../backups/your-backup.sqlite
```

The importer preserves town codes, inventories, balances, contracts and seat secrets. It validates the save schema and does not modify the source database. Server recovery clears online state and unfinished approvals. Do not paste secrets into the command arguments or commit environment files.

A localhost browser's sessionStorage does not follow it to onrender.com. Imported resident slots remain reserved, so test with a new cloud town unless an owner transfers their recovery token using private local tooling. Never add a token to a public invitation URL. A dedicated secure seat-transfer UI is not included in this change.

## Backup and restore

```sh
npm run backup -- ../backups
npm run restore -- ../backups/our-block-TIMESTAMP.json
```

Backups contain recovery secrets, are created mode 0600, and remain ignored. Both local and cloud stores use the same backup format. Restore inserts all towns in one transaction and refuses conflicting codes. To restore into a clean local database, set DATA_DIR to a fresh directory and leave DATABASE_URL unset. Back up before releases and retain a private local copy; free provider retention is not your only backup.

## Validation and usage

```sh
NETWORK_TEST=1 npm test
ALLOW_LOCAL_PG_TEST=1 TEST_DATABASE_URL=postgresql://postgres:local-test-only@localhost:55439/ourblock NETWORK_TEST=1 npm test
npm run build
```

The second command assumes a disposable local Postgres instance, not the live Neon database. Tests insert uniquely named records. TLS failure, rejected commits and queue ordering are covered separately from game rule tests. Network tests run process restart recovery against the selected backend.

Check Render instance hours/build bandwidth and Neon storage/compute dashboards before and after playtests. Stop or reduce usage when nearing free limits; do not upgrade automatically. Free services may sleep or suspend. A roughly one-minute wake-up is acceptable for this prototype, not a production uptime promise.

## Deployed prototype and remaining gates

Public browser: https://our-block-1ooe.onrender.com

Private source: https://github.com/dev4-gpt/our-block, default branch codex/cloud-hosting.

Provisioned October 20, 2026:
- Render service our-block (srv-dbc2vsrrjlhs73al2vvg): Free Docker instance, Oregon, manual deployments, no disk. Workspace had 750 unused free instance hours and no card on file at provisioning. Existing jobvis service was not changed.
- Neon project OUR BLOCK (falling-brook-19459565): Free plan, AWS Oregon, Postgres 18. Existing Stratos project was not changed. Pooled connection is stored only in Render's secret DATABASE_URL.
- Public health check, 3D browser entry, and four simultaneous WebSocket residents passed. A full garden commission included inspection, diagnosis, price comparison, teammate-approved connector purchase and repair; final shared balance was 337 credits.
- Manual Render redeploy passed: the same private player token recovered its seat, completed garden and 337-credit balance from Neon.
- The four clients used one development machine/network. Separate physical devices, separate networks, actual phone performance, learning-transfer testing, and idle-sleep recovery remain release gates.
- Local localhost towns have not been imported. Their backups and recovery secrets remain private and excluded from GitHub.

Repeat the public smoke check deliberately (it creates a test town):

```sh
node --import tsx scripts/cloud-smoke.ts https://our-block-1ooe.onrender.com
# After a manual redeploy, verify the same private saved seat:
node --import tsx scripts/cloud-smoke.ts https://our-block-1ooe.onrender.com --recover
```

Private recovery data is saved mode 0600 under ignored root backups/. Do not publish it.

Unity account verified October 20, 2026: DevOps Free tier; usage 0/100 Mac minutes, 0/200 Windows minutes, 0/100 Linux minutes, 0/25 GB storage, and 0/100 GB egress. Unity's official free-plan documentation states that excess usage locks access rather than upgrading automatically. Created OUR BLOCK project 78500391-7ea3-4fcf-9e81-1f2b64a89404 with child audience selected for the intended ages 9–15. Repository access was verified after the user installed an Ed25519 read-only deploy key limited to dev4-gpt/our-block. Target our-block-mac-arm-manual uses pinned Unity 6000.3.25f1 (confirmed available), macOS Sequoia, Apple-Silicon editor, and Mac Standard free-tier-eligible compute. Automatic builds and schedules are off. Build #1 ran October 21: package resolution and scripts compiled, then player export failed because the skipped pre-build hook left editor/player input layouts mismatched. Its billed duration was 3m01s. Corrected the hook to ../scripts/unity-prebuild.sh, committed activeInputHandler=2 before compilation, and submitted clean build #2 at c41b1c1. No paid upgrade was enabled. Clean build #2 succeeded; the downloaded 46.04 MB artifact contains a universal x86_64/arm64 player. Total reported billable Mac time across two attempts was 6m28s. Local gameplay testing is paused at the user-reported macOS Gatekeeper warning: the prototype is ad-hoc signed and unnotarized. No security protections were bypassed. Windows and mixed-client play remain unverified. Free-plan concurrency is fixed at two; only one build is submitted at a time rather than upgrading to change that limit. The private Student-plan PDF and its coupon remain excluded from GitHub.

Postgres records carry an internal storage_version separate from the public protocol revision. Version-checked writes reject stale overlapping servers instead of overwriting newer saves. This guards accidental deploy overlap; it does not implement multi-replica simulation.

Local verification: 33 tests passed with real Postgres, including four WebSocket clients and process restart. SQLite-specific checks also passed. Browser refresh and automatic seat recovery after a controlled restart were observed.

## Schema-2 release candidate (October 21)

Use the release checklist in `RELEASE_PLAN.md`. Public admission defaults to four total residents; do not raise `MAX_PLAYERS` from local load results. Optional `STORAGE_BUDGET_BYTES` is an application safety budget (default 100 MiB), not an automatic reading of provider quota. Inspect Neon and Render dashboards first. Full protocol-v1 states remain the transport; idle broadcasts were removed after profiling, with movement updates at 10 Hz and visible clock/crop updates at 1 Hz.

Create private consistent exports using `npm run backup -- /private/backup-directory --daily` (one per UTC day, seven retained) or omit `--daily` for release backups (three retained). Rotation only touches this command's dated `.backup.json` namespace. Scheduling/off-Mac private storage remains an operational setup gate; a folder on ephemeral Render storage is **not** durable backup storage. Format 2 includes economic receipts alongside towns. Restore into an empty disposable database first with `npm run restore -- /private/backup.backup.json`; conflicts refuse the entire import. Keep the pre-upgrade database snapshot and matching old code together for rollback. Never roll back only code after accepting new-schema transactions.

October 21 local candidate checks: both storage backends and real socket restart recovery passed; the local private backup was restored into an isolated database and its town/receipt counts matched. The candidate is not deployed until a corresponding private Neon backup has succeeded and provider readiness has been checked. An existing successful Unity binary predates this candidate's explicit fit/test actions; keep it experimental and rebuild only within the verified free allowance after browser gates pass.

The opt-in phone rendering check is at `/?deviceCheck=1`. Start it after joining a town; keep the 3D game visible for ten minutes. Switching to map, hiding the page or reconnecting invalidates that run. It reports local frame cadence only and uploads nothing. Phone-control feedback led to visible touch instructions and a wrapping navigation fix; the user's device model and sustained frame result remain unknown.
