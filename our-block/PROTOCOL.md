# OUR BLOCK protocol v1

Transport: same-origin `ws(s)://host/ws`; desktop clients may connect without an Origin header. All messages are JSON text. Maximum incoming frame: 8192 bytes. The server accepts at most 30 messages per socket per second.

Join/create: `{ "type": "join", "name": "Rowan", "code": "", "mode": "life" }`. Empty code creates a town. A code joins an available seat. `mode: "explore"` creates untimed exploration. Recovery uses `{ "type":"join", "code":"ABC123", "token":"opaque-seat-secret" }`. Reopening a recovered seat closes its previous connection.

Responses:
- `joined`: code, token, id. Store token locally; never share it with other residents.
- `state`: role-neutral town projection plus `you` player ID. Excludes all tokens, processed-action history and other residents' private seen lists. Shared evidence, inventories, money, contracts and ledger are intentionally visible to the cooperative.
- `result`: action id, readable message, `code: ACCEPTED`, economic revision, movementSequence and duplicate flag.
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

Each town uses one asynchronous mutation queue. Movement and pings update memory and flush periodically (up to two seconds of crash loss); economic actions still persist before acknowledgment. Movement commands are coalesced into the next full snapshot at up to 10 Hz, while idle redundant snapshots are skipped. Validate against a cloned state, commit one whole-town snapshot, then publish and acknowledge. SQLite uses BEGIN IMMEDIATE/COMMIT; Postgres uses atomic version-checked writes to refuse stale overlapping server writes. Validation or persistence failure cannot publish a partially applied purchase. Periodic movement/growth saves can lose up to two seconds on crash.

Supported save schema: 3, with schema-1/schema-2 migration on town load. Cumulative totals are separate from recent entries; legacy partial totals are explicitly marked. Unknown schemas reject that town without overwriting it. Economic receipts persist separately from bounded snapshot history and are included in format-2 backups. Before future migrations, make a consistent backup and add fixture tests; never downgrade or overwrite an unreadable save.


Polish candidate: Explore has Town / Activities / Shop navigation. Purchases open a review sheet before sending; shared requests appear in the Decisions inbox on every tab. Rule errors do not suggest reconnecting. Rendering errors switch to the accessible map; a slow module offers it after 15 seconds.

Schema 3 adds server-owned refundable purchase lots, project contributions and outcome summaries. Purchase lots retain paid price, original payer and inventory location through gifts/storage. Free/legacy units are consumed first, then oldest purchased units. Only a complete unused purchased offer quantity can be refunded, to its original payer. Legacy inventory remains usable but has no invented refundable history. Snapshot fields `refundable`, `refundAmounts`, `evidenceDocuments`, `projectWork` and `outcomes` are additive protocol-v1 fields. Internal `lots`, seat tokens and duplicate history are omitted. `ping.item` optionally references already-discovered evidence. Stable rule codes include `PENDING_APPROVAL`, `DISTANCE`, `INSUFFICIENT_FUNDS`, `INVENTORY_FULL` and `NOT_REFUNDABLE`. Existing command shapes and full-state fallback remain available.

Repeat garden commissions change the service-part prices and evidence; the browser uses the shared authored catalog. Existing Unity source/binaries have not been validated against replay-price presentation; Unity remains experimental. Exporting a base catalog alone is not a claim of replay UI support.
