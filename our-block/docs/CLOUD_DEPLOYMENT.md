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

## Current external gates

Render, Neon and Unity showed login screens at inspection. The private source repository is https://github.com/dev4-gpt/our-block (default branch codex/cloud-hosting). No Render service, Neon project or Unity build was provisioned during local preparation. Public URL, cloud redeploy survival and external-network gameplay remain unverified until accounts are connected.

Postgres records carry an internal storage_version separate from the public protocol revision. Version-checked writes reject stale overlapping servers instead of overwriting newer saves. This guards accidental deploy overlap; it does not implement multi-replica simulation.

Local verification: 33 tests passed with real Postgres, including four WebSocket clients and process restart. SQLite-specific checks also passed. Browser refresh and automatic seat recovery after a controlled restart were observed. These are local checks, not evidence of a Render/Neon deployment.
