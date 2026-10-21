# OUR BLOCK

A playable browser prototype of a persistent 3D cooperative neighborhood for one to four friends. Explore six districts, earn fictional credits, inspect claims, grow supplies, complete projects and make shared spending decisions.

Public prototype: https://our-block-1ooe.onrender.com. Runs on Render Free with Neon persistence; see [deployment verification and remaining gates](docs/CLOUD_DEPLOYMENT.md).

## Run

Requires Node.js 24+.

```sh
npm ci
npm run dev
# production
npm run build
npm start
```

Default port 3001. `PORT` overrides it. `DATA_DIR` selects the SQLite folder (default `data/`). Run one server instance. LAST LIGHT remains a separate application on port 3000.

Create a town, copy the invitation link, and invite up to three friends. On a phone on the same network use the Mac's LAN address instead of localhost. Each tab stores its recovery token in sessionStorage; opt-in Remember this device also uses localStorage. Forget this device clears both. Unity stores its token in local PlayerPrefs. Tokens authorize a seat and must not be published.

## Play

Use WASD/arrows or click the ground to walk. Drag the scene to orbit and scroll to zoom. District buttons walk to a landmark. Open-front buildings have server-routed entrances. Accessible map mode and HTML controls provide the same interactions without WebGL.

Start with **Open the garden** in Projects. Inspect the garden, measure at Workshop, compare at Market, and buy a compatible connector or whole hose. Return unused incompatible parts. Carry the chosen part back, fit it and explicitly test the water connection before completing the contract.

Grow crops by planting a seed and watering a bed, wait 30 active seconds, then harvest. Buy paper packaging or a reusable crate, pack at Depot, inspect the original delivery receipt, and complete a market commission. The community evening needs a repaired stool, prepared food or packed produce, lighting, and verification of the changed payment request.

The first commission uses basic supplies; repeat commissions alternate additional requirements. Project cards show current requirements, deadlines and cancellation terms. Complete or cancel before accepting again. Canceling keeps supplies. Expired contracts can be renegotiated.

Shared spending asks another online resident to approve. Personal earnings can be spent directly or contributed at Home. Each resident has a backpack; Home has shared storage. Meet another resident to give supplies. A labeled EMBER storage helper is available at Home while solo; it does not solve projects or spend money.

Life mode has 20 active minutes per day and a ledger review before the next day. All time pauses when nobody is online. Explore mode is untimed but crops still grow during active play. Kitchen rent is optional: 10 credits to start, 8/day beginning tomorrow, reduced to 5 by insulation. Unpaid bills pause the kitchen. Pay, return the rental, or do caretaker work for partial relief. Starting housing is never lost.

## Checks

```sh
npm test
NETWORK_TEST=1 npm test
npm run build
npm run export:unity
```

The network suite binds port 3012 and uses a temporary database. It tests four real sockets, fifth-seat refusal, room isolation, refresh recovery and process restart. Rules tests cover alternative project solutions, repeat requirements, growing time, approval, stale/duplicate commands, rollback, deadlines, refunds, bills and offline pause.

## State and deployment

The Node server owns movement paths, inventory, economy, deadlines and approvals. Commands use protocol version 1, unique action IDs and expected revisions. Economic actions are committed transactionally before acknowledgment, including durable receipts. Movement and pings are accepted in memory and saved periodically. Movement/crop clock snapshots are saved every two seconds. A crash can lose up to two seconds of movement or growth, not an acknowledged purchase. Restarts disconnect all seats until recovered and cancel unfinished purchase requests.

Saves use schema 2. Older schema-1 saves migrate on load and retain their balances and belongings; incomplete historical totals are labeled. Unknown schemas reject loading that town rather than overwrite it. Snapshot projection excludes seat tokens and duplicate-action history.

Dockerfile and render.yaml are included. The updated Render blueprint uses Free compute and requires a server-only DATABASE_URL for Neon Postgres; the existing public prototype is deployed, but this release candidate requires its own backup and manual redeploy. Local development still uses SQLite. Keep one replica. See [cloud deployment runbook](docs/CLOUD_DEPLOYMENT.md). /health reports process status. Back up SQLite before upgrades. Modest local rate limits and a 500-town ceiling are for prototype evaluation, not large public matchmaking.

## Honest release status

Implemented: local browser prototype with six connected districts, 19 activities, 12 upgrades, three projects with two supply variants, four-seat server, persistent economy, browser 3D and map UI, and Unity client source.

Release readiness is tracked in [the release plan and evidence](docs/RELEASE_PLAN.md). Physical-device testing, unfamiliar pairs, learning-transfer observations, current-candidate public load/redeploy tests, the one-hour soak and real gameplay capture remain gates. A previous macOS Unity cloud build succeeded; the downloaded player is experimental and local gameplay stopped at the user-reported Gatekeeper warning. Windows and mixed-client projects remain unverified.

No learning-effectiveness or prize guarantee is claimed. See GAME_DESIGN.md and PROTOCOL.md for content and integration details.

World generation research and concrete shared-world changes: [WorldClaw review](docs/WORLDCLAW_REVIEW.md). No Tencent scene, model weight or code was imported.
