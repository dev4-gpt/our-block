# Competition polish — implementation and acceptance record

## Candidate behavior

- Direct Town / Activities / Shop navigation, selected destination and movement/arrival status.
- Native keyboard-accessible review dialog; requester cancels, teammates approve/decline, funds remain unchanged while pending. Persistent Decisions count and pending cards precede guidance on all tabs. Duplicate local economic sends are guarded until response/interruption. Rule errors are distinct from connection errors.
- Schema 3 retains purchase provenance through storage/gifts/consumption. Actual paid cost returns to the original payer; free, consumed and unverifiable legacy stock cannot be refunded. Schema-1/schema-2 migration keeps usable inventory and balances. Backup format stays 2 and includes schema-3 towns plus durable receipts.
- Shared project steps, named contributions, evidence documents/reference pings, and outcomes for all three projects. Financial summaries explicitly cover all income/spending during the commitment, not per-product profit. Legacy active commitments without a baseline show unknown historical totals.
- Garden repair/water, carried packed orders, delivered Market stock and furnished Hall visuals have text equivalents. Replay prices and claims are authored and server-controlled; no answer highlighting before inspection.
- Renderer failure/context loss switches to the accessible map; a 15-second slow-module wait offers the map. System fonts remove the external font dependency.

## Automated and browser checks

Existing automated suites plus provenance cases cover original payer after gifts, storage splits, partial consumption, mixed free/purchased units, mixed payers, duplicate and racing returns, restart durability, schema migration and forged free-item returns. Full solutions cover both approaches in both initial and repeat commissions, including owned versus rented lighting. Run both storage backends and real sockets before deployment.

Local browser checks performed through the Codex browser:

- Shop opens without scrolling through the introduction; out-of-range view offers Walk here to shop.
- Purchase review shows quantity, terms, payer, cost and remaining balance without spending.
- Escape closes the native review dialog and returns focus to the invoking button.
- Two local browser seats: shared request visible independently; further shared purchase opens existing request; decline and requester cancellation leave 300 credits unchanged; independent approval gives 282 credits.
- Local failure fixture injects clipboard rejection: manual-copy/town-code guidance remains usable.
- Slow React module fixture: accessible-map option appears after 15 seconds. Throwing render fixture switches immediately to the map fallback.
- Error-feedback regression tests ensure rule/stale/storage failures never offer Reconnect; connection failures do.

The fixtures are local Vite-only test entrypoints under tests/, not bundled as production pages. Failure fixtures exercise the real production components with controlled failures; they are not physical-device or genuine hosting outage evidence.

## Resource and operational limits

Load-report bytes before this campaign: 953,670,628 of the original 1,000,000,000-byte cap. Approximately 46 MB remains before allowing a reserve for small health/assets/browser checks. One-hour local sparse soak forecast 20 MB, hard cap 25 MB, four residents with five-minute action bursts and five-second health/memory sampling. No new public capacity stages; public admission remains four. Retain the previous aborted 600 MB baseline report. The current sparse soak must be reported with its exact source and must not be called a saturated load test.

Render cron jobs require a $1/month minimum, so none is provisioned: https://render.com/docs/cronjobs . Neon recovery history is not a separate seven-day export backup: https://neon.com/docs/introduction/branching . Keep manual private exports; unattended off-Mac backups remain open under $0.

## Open acceptance gates

Unfamiliar pairs, independent useful contributions, transfer learning, phone 30 FPS/10 minutes, final 375px/reduced-motion/device checks, two devices on confirmed different networks, genuine Render sleep/wake, end-to-end 10 Mbps interactive load, and final one-hour soak remain to be recorded. Prior assisted phone/Mac garden success is diagnostic, not an unassisted usability pass. Broader child-directed privacy/consent review, support channel, retention/deletion process and sustained backup operations remain open. Unity rendering/reconnect/mixed-client replay and Windows remain unverified.

## Submission checks

Official rules re-read October 21: https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0 . Entrant must verify age of majority/18+, eligible-country residence and presence, active matching Handshake account and exclusions. Deadline October 30, 2026, 11:59 PM Pacific. Execution, creativity, usefulness and polish are equally weighted. Required entry fields include title, cover, description and project URL. Form-specific cover dimensions/description limits must be checked on the submission screen before upload. User personally submits and accepts terms. No prize is guaranteed.

Prepared description and cover draft remain in submission/. Exact-size final cover export and real gameplay recording remain open until acceptance; do not fabricate footage or claim promotional art represents implemented graphics.

Final predeployment suite: 73/73 checks passed with SQLite, disposable Postgres and real sockets; production build passed. The 375px desktop iframe confirms navigation fits, Shop is available above the map, and selecting Shop scrolls directly to supplies while its navigation remains visible. This is not a physical-phone performance measurement. Native review Escape/focus, requests/declines/cancel/approval and controlled failure fixtures were exercised in the browser. The one-hour sparse soak runs server source `1c13033`; subsequent navigation edits are client/CSS only and do not change its server/shared source.
