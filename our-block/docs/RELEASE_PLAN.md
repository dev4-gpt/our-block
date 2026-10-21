# OUR BLOCK release plan and evidence

Updated October 21, 2026. Competition candidate first; broader production acceptance afterward. This document records gates, not a readiness certification.

Target submission: October 29. Official closing time: October 30, 2026, 11:59 PM Pacific. Execution, creativity, usefulness and polish carry equal weight. The entrant verifies eligibility and personally accepts terms and submits. [Official rules](https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0).

## Implemented in this working candidate

- Personal Guided / Light / Off instructions with identical evidence, prices and actions. No age segmentation or birthday collection. Default browser/server town creation is untimed exploration; simulated days are explicit.
- Garden contract requires investigation, a carried compatible part, fitting and an explicit water test before reward. Both repair approaches remain legal. Failed incompatible purchases can be returned unused. Dry plants, an open pipe gap, fitted connection and flowing water show progress; text provides the same information.
- Contribution summaries recognize inspection, measurement, comparison, supplies, fitting and testing. Approving alone does not populate a useful-work contribution. Successful gardens lead to the market and evening project cards.
- Approval cards show requester, product, quantity, total cost, terms and remaining shared funds. Requester cancellation and teammate decline are separate. Disconnecting requesters cancel uncommitted requests; completed decisions remain visible to everyone.
- Economic IDs, fingerprints and results persist in a receipts table in the same transaction as their town save. Duplicate protection no longer depends on the last 1,000 IDs. Reusing an ID for a different action fails. Historical actions before this upgrade only retain the protection that was previously saved; deleted history cannot be reconstructed.
- Cumulative account totals are independent of the latest 200 ledger rows. Older saves explicitly label their incomplete historical totals. Movement and contextual pings use a separate sequence and cannot invalidate an economic revision.
- Schema 2 migration, schema-1 fixture, transactional format-2 backups containing towns **and receipts**, atomic conflict-refusing restoration and migration import. Unknown schemas fail when that town is loaded, preserving the original record.
- On-demand loads; 25 idle towns cached, at most 50 total cached with admission capped at 25 active towns. Eviction preserves durable saves. Public player admission defaults to **four total**, separate from four seats per town. A valid seat may wait for service capacity; invalid tokens have a different error.
- Command field allowlists, numeric validation, bounded handshake/creation/action/payload budgets, slow-client disconnection and redacted errors. Forwarded addresses are not trusted. The transport-peer budget is conservative behind a shared hosting proxy; an explicitly verified proxy configuration is needed before using forwarded addresses.
- Storage thresholds: warning 70%, pause new towns/contracts 80%, pause play 90%. The initial **100 MiB application budget** is deliberately conservative; it is not a claim about current Neon account quota. Set `STORAGE_BUDGET_BYTES` only after inspecting the provider allowance and accounting for other usage.
- Wake/reconnect has a 90-second budget and manual retry; economic actions are never automatically replayed. Optional persistent device recovery and explicit Forget controls; invitation links contain only town codes.
- Unity protocol-v1 full snapshots remain compatible. Source includes fit/test/decline controls, but the older downloaded binary has not been rebuilt or validated for this candidate.

## Recorded automated evidence

`npm test` covers project approaches, garden fit/test, variant requirements, refunds, deadlines, bills, offline pauses, ownership, approvals, migration, truncated-ledger totals, bounded cache behavior and storage safe mode. `NETWORK_TEST=1 npm test` additionally opens real sockets and restarts the server. Set `TEST_DATABASE_URL` to a disposable database and `ALLOW_LOCAL_PG_TEST=1` only for localhost test TLS exceptions. Production TLS is always verified.

October 21: 49 checks passed with both SQLite and disposable local Postgres, including real sockets, restart/restore idempotence and overlapping-server save conflicts. These include the 90-second retry boundary, declined spending, fitting rollback and all three deadline recovery paths. An ambiguous COMMIT-response check also confirms durable reconciliation before a later decision. Final candidate changes must still pass before release. The production build passed. Raw local load runs are under `evidence/`; failed/aborted harness runs are retained as such.

The first four-client, 20-second local rehearsal: 37 actions, acknowledgment p95 15 ms, matching-state delay after acknowledgment p95 0 ms, zero unexpected errors, 77 MiB peak server RSS, approximately 2.62 MB traffic. This is **not** a public capacity certification or a phone rendering measurement. A later one-minute run passed at 4, 20, 50 and 100 clients (1, 5, 13 and 25 towns). Acknowledgment p95: 3 / 7 / 7 / 28 ms; peak RSS: 77 / 67 / 84 / 93 MiB. Approximately 148 MB total stage traffic. Full snapshots remain protocol v1; redundant idle broadcasts were removed after measuring the original five-minute four-client baseline (78 MB). The preceding staged run stopped on an unsynchronized synthetic client's stale revision at the next stage; its report remains marked aborted. The harness now waits for each teammate's latest economic state before another decision. These reports do not raise public capacity.

## Required evidence before competition submission

| Gate | Required observation | Status |
|---|---|---|
| Candidate deployment | private cloud backup; manual deploy exact tested commit; health and independent network project; recover after redeploy | Open for this candidate |
| Two devices | complete a project on physical devices on different networks | Unverified |
| Unfamiliar play | 5 pairs; 4 finish repair within 10 minutes without instruction; both contribute; 3 voluntarily continue | Unverified |
| Transfer | new objects/claims prompt inspection, independent verification and recovery; no recall quiz | Unverified |
| Mobile | actual midrange phone, 375px layout, 30 FPS for 10 minutes; keyboard/focus/reduced-motion/sound-off/map checks | Unverified |
| Warm load | <=10 seconds on a defined 10 Mbps connection, server already ready | Unverified |
| Cold wake | genuine idle sleep and wake, interrupted connections, manual retry after 90 seconds | Current candidate unverified on Render |
| Public capacity | 4,20,50,100 clients, up to 5 minutes/stage; publish only largest passing stage within quota | Four-player default retained; public stages open |
| Soak | one uninterrupted local hour with the final candidate | Open |
| Restore | both backends: receipts and balances survive restored snapshot; repeat release against private production backup | Automated disposable-backend coverage; production rehearsal open |
| Submission assets | 1200×800 original cover; ~90 seconds actual gameplay; <=500-character description; verified public URL | Preparation ongoing; no submission sent |

## Execution order

October 21–23: baseline, recovery/economy fixes, first-project interaction and visible consequences. October 24–26: polish the three connecting projects, physical devices, unfamiliar pairs and measured capacity. October 27: freeze features and address blockers. October 28: final backup/restore, release checks and real gameplay recording. October 29: entrant verifies and submits. The calendar never overrides a failed gate.

Before broader production release, finish a district-by-district depth audit, privacy and consent review appropriate to the intended audience, sustained operations/backup evidence, and all remaining device and multiplayer gates. Mixed-age design is a hypothesis about usability, not proven universal suitability or educational effectiveness.

## Player-test observation sheet

Use anonymous labels P01–P05. Obtain guardian permission where appropriate. Do not record birthdays, contact details, voice or identifiable video without the necessary consent. Track: guidance chosen; first action; who investigated which evidence; first repair start/end; each resident's useful contribution; wrong turn; recovery; each creator intervention with time; voluntary continuation; independent verification in the new scenario. Record failures honestly. Recruit personally; the software does not send invitations to test participants.

## Load rehearsal

```sh
npm run build
LOAD_SECONDS=300 npm run test:load
# One-hour local soak, isolated port and disposable towns:
LOAD_STAGES=4 LOAD_SECONDS=3600 LOAD_PORT=3015 npm run test:load
```

Local mode starts an isolated production server with SQLite, 100-player admission and disposable saves. It exercises movement, work, purchase/approval/refund, declined spending, duplicate deposit, recovery and isolation. It writes redacted reports, never seat tokens. Each public stage additionally requires dashboard quota inspection, a matching private backup, an explicit HTTPS URL, `--public`, and `LOAD_REMAINING_BYTES`. Forecasts can refuse a stage before traffic is sent. The total test cap is 1 GB and at most 10% of supplied remaining allowance. Track cumulative traffic across separate invocations; do not treat resetting the harness as resetting a provider quota.

Do not raise public `MAX_PLAYERS` from four based on local results. Abort on any data disclosure/duplicate effect/lost acknowledged state, >400 MiB sustained for 10 seconds, or latency/error threshold failure sustained for 60 seconds. Reports measure acknowledgment round trips and delay from acknowledgment to a matching snapshot; they do not pretend to measure synchronized one-way delivery time. An actual one-way state-delivery measurement remains a separate gate.
