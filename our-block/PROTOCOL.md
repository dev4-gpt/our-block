# OUR BLOCK protocol v1

Transport: same-origin `ws(s)://host/ws`; desktop clients may connect without an Origin header. All messages are JSON text. Maximum incoming frame: 8192 bytes. The server accepts at most 30 messages per socket per second.

Join/create: `{ "type": "join", "name": "Rowan", "code": "", "mode": "life" }`. Empty code creates a town. A code joins an available seat. `mode: "explore"` creates untimed exploration. Recovery uses `{ "type":"join", "code":"ABC123", "token":"opaque-seat-secret" }`. Reopening a recovered seat closes its previous connection.

Responses:
- `joined`: code, token, id. Store token locally; never share it with other residents.
- `state`: role-neutral town projection plus `you` player ID. Excludes all tokens, processed-action history and other residents' private seen lists. Shared evidence, inventories, money, contracts and ledger are intentionally visible to the cooperative.
- `result`: action id, readable message, `code: ACCEPTED`, economic revision and duplicate flag.
- `error`: readable message and structured code (`STALE`, `CAPACITY`, `READ_ONLY`, `STORAGE`, `RULE`). A `STALE:` prefix means review the current snapshot and resubmit a new decision. Clients must not silently retry purchases.

Each command has `v:1`, unique `id`, expected `revision`, `type` and applicable fields. Movement simulation arrives at 10 Hz but movement/pings use movementSequence rather than economic revision; economic commands and lifecycle transitions increment revision. Navigation is server routed and bounded, with 5 world units/second speed. Input packet rate is not movement speed.

| Type | Additional fields |
|---|---|
| move | x, z |
| activity | target: activity ID |
| buy, upgrade | target: offer/upgrade ID; account: shared or personal |
| bill | account |
| approve, cancel, decline | target: pending request ID |
| transfer | item, positive integer qty, direction: store or take |
| give | item, qty, player: recipient ID |
| deposit | positive integer qty |
| refund | target: unused offer ID; refund goes to shared funds |
| accept, renegotiate, complete, abandon | target: project ID |
| ping | target: district ID; text: contextual request |
| ack | target: radio request ID |
| next | none; day review required |
| return-kitchen, negotiate-bill | none; Hall proximity required |
| fit | item: carried repair part; active garden contract and evidence required |
| test | none; Garden proximity and fitted repair required |
| companion | item; solo and Home proximity required |

The shared TypeScript content catalog is the source of identifiers and descriptions. `npm run export:unity` exports it to Unity Resources/Content.json. Export after content changes. Unity does not run an independent economy.

Each town uses one asynchronous mutation queue. Validate against a cloned state, commit one whole-town snapshot, then publish and acknowledge. SQLite uses BEGIN IMMEDIATE/COMMIT; Postgres uses atomic version-checked writes to refuse stale overlapping server writes. Validation or persistence failure cannot publish a partially applied purchase. Periodic movement/growth saves can lose up to two seconds on crash.

Supported save schema: 2, with schema-1 migration on town load. Cumulative totals are separate from recent entries; legacy partial totals are explicitly marked. Unknown schemas reject that town without overwriting it. Economic receipts persist separately from bounded snapshot history and are included in format-2 backups. Before future migrations, make a consistent backup and add fixture tests; never downgrade or overwrite an unreadable save.
