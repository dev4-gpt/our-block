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

Prepared description and a verified 1200×800 real gameplay cover are in submission/. Real gameplay recording remains open until acceptance; do not fabricate footage or claim promotional art represents implemented graphics.

Final predeployment suite: 73/73 checks passed with SQLite, disposable Postgres and real sockets; production build passed. The 375px desktop iframe confirms navigation fits, Shop is available above the map, and selecting Shop scrolls directly to supplies while its navigation remains visible. This is not a physical-phone performance measurement. Native review Escape/focus, requests/declines/cancel/approval and controlled failure fixtures were exercised in the browser. The one-hour sparse soak runs server source `1c13033`; subsequent navigation edits are client/CSS only and do not change its server/shared source.

Deployment: exact browser candidate `4776d8d8c6acdbc91a913abb1cc97d6907566bd7` is Live on Render Free. Current player town recovered its completed garden and 337 credits; the separate saved public test seat also recovered. A verified immutable seven-town/nineteen-receipt pre-schema-3 backup is paired with source `957f966` and a source archive privately, outside Git. Asset-only transfer at a 10 Mbps decoded-consumption cap: 795,604 bytes in 708 ms, excluding readiness, rendering and physical device networking. This is not the end-to-end interactive-loading gate.

The signed-in submission form confirms a screenshot cover, preferred 3:2 and at least 1200px wide; the supplied `submission/cover-gameplay-1200x800.jpg` is a fresh 1200×800 native viewport capture of the deployed game, not promotional art. Description is 440 characters. Public Showcase sharing is required for competition entry. No submission was made.

Continuation: browser control became disabled in Work settings during the production-build journey. The UI garden was completed and its outcome verified; the Market UI test stopped after purchasing seeds/packaging and collecting water. No completed browser Market/Evening journey is claimed. A separate local two-client protocol regression covers the remaining server path; it does not substitute for browser/device acceptance.

Refund-order audit found that moving an old lot through storage could reorder it behind newer purchases. A follow-up retains original purchase revision across moves and sorts consumption/refunds by that revision, with backward-compatible original lot-ID fallback for earlier schema-3 records. Added regression verifies that the old personal purchase is consumed before the newer shared purchase after a storage round trip. Follow-up suite: 74/74 passed against SQLite, disposable Postgres and real sockets; build passed. This patch is pending deployment while browser control is disabled. The existing one-hour soak measures server `1c13033` before this narrow follow-up; final-source soak acceptance remains open.

Fresh current-production schema-3 backup (seven towns/nineteen receipts) restored privately and paired with live source `4776d8d`. This does not configure unattended backups.

Resource-limited protocol journey: the first local run completed interruption recovery, Garden and Market, then stopped at 8,021,437 bytes before Evening completed. Its aborted report is retained. A separate evening-only fixture starts with completed Garden/Market contracts, 384 credits and one seed/pack; it measures Evening transactions without claiming a continuous or browser playthrough. A failed fixture join used an invalid-length code and is retained as a harness failure.

Evening-only two-client protocol fixture passed in 58 seconds using 1,863,443 bytes: hired lantern, purchased repair pad, repaired stool, irrigation/harvest, independent payment verification, packed meal delivery, completion and saved-seat recovery. The preceding two seeded completions were retained; only Evening was executed in this fixture. The report records that distinction.

Final-source soak started at `0d05f0a` with four local clients, a one-hour target and 20,000,000-byte hard cap. Earlier-source soak stopped deliberately and its partial report was retained. Recalculated load/journey traffic is 966,763,687 bytes; reserving 10,000,000 for asset/browser/health checks plus the final 20,000,000 stays below the original 1 GB cap. Do not claim this soak passed before its completion report. Mac must remain awake for a valid uninterrupted result.

Current deployment distinction: `4776d8d` is live; refund ordering patch `0d05f0a` is pushed privately but not deployed because browser control was disabled. No paid service, account change, competition submission, or private data upload was performed.

## Separate-network movement diagnostic — October 21

User confirmed public town F948C3 opens on iPhone mobile data while the Mac uses Wi-Fi. They initially saw one resident, subsequently saw the other, and reported delayed movement with eventual agreement at the destination. This is a failed smooth-movement check, not a multiplayer acceptance pass; device model/browser and measured latency remain unknown.

Code review found identical new-seat spawn coordinates and a simulation clock that updated its baseline on skipped ticks during pending database saves, discarding that elapsed movement time. The follow-up gives new seats separate walkable positions, retains bounded elapsed time across blocked ticks, broadcasts accepted routes immediately, and adds resident name/you labels (including stacked labels for overlapping legacy positions). Browser-only visual motion follows validated waypoints for at most 250 ms after the latest snapshot, with frame-rate-independent smoothing. It cannot grant interaction distance or modify server state. Reduced motion retains authoritative positions directly.

Follow-up validation: 77/77 tests passed against SQLite, disposable Postgres and real sockets; production build passed. A gated-save test verifies 1.6 elapsed seconds advances eight units despite skipped callbacks. A second socket receives route and intermediate movement states before arrival. Visual tests cover route turns, prediction bounds and equal smoothing at 30/60 FPS. These are local regressions; visual inspection, deployment and repeat physical-device synchronization remain open while Codex browser control reports disabled. The ongoing one-hour soak runs the earlier `0d05f0a` server, so it cannot certify these newer movement changes.

The earlier-source soak subsequently completed: `load-1792623716079.json`, source `0d05f0a`, four local clients/one town, 3,600 seconds, 69 scheduled actions, zero unexpected errors, acknowledgment p95 13 ms, post-ack full-state delivery p95 100 ms, peak server RSS 79 MiB. Total traffic including setup was 1,939,231 bytes; recorded campaign load/journey total is now 968,702,918 bytes, leaving 31,297,082 under the 1 GB cap before the reserved small browser/asset checks. This sparse SQLite rehearsal does not prove physical-device frame synchronization, cloud latency, or an hour on the newer movement source `cf9b258`. Keep public admission at four.

## Movement follow-up deployed

Browser control recovered. Render manual deploy `dep-dbcka5bncjis73cnst4g` succeeded for exact commit `73a9ee4013a6acf46b73237cb3c80fed2c0ea2fd` (executable source `cf9b258`) in 44.7 seconds on October 21, around 7:05 PM EDT. This supersedes earlier pending-deployment statements above. The existing service remains Free, protocol 1, capacity four. A fresh private seven-town/nineteen-receipt backup restored successfully and is paired with previous live source `4776d8d` in the private rollback record.

Readiness returned HTTP 200, ready. Browser refresh recovered F948C3, its completed garden and 337 credits. Both resident labels appeared while two seats were online. The Mac completed a walk to Community Gardens through the live interface. The phone then disconnected during this observation (online count changed from two to one), so stable separate-network synchronization is still pending the user's refreshed-phone retest. Deployment and recovered-town screenshots are retained. No complete phone performance or smooth-movement acceptance pass is claimed.

Refreshed-phone retest: user subsequently confirmed **both residents visible and movement smoother**, with the previously confirmed iPhone-on-mobile-data/Mac-on-Wi-Fi setup in F948C3. Record this as a user-reported pass for resident visibility and improved movement across separate networks. It supersedes the pending immediate retest above. It does not establish frame-perfect synchronization, measured latency, ten-minute phone FPS, full project completion, or unfamiliar-player acceptance; those broader gates remain open.

### Intermittent frozen movement follow-up

User then reported intermittent phone movement absent on the Mac. This reopens sustained synchronization acceptance despite the initial improvement. Live inspection is blocked again by Codex browser control reporting disabled; the precise live cause is unconfirmed. Client audit found no recovery timeout when an apparently open connection stops delivering expected moving snapshots. A follow-up closes and recovers the saved seat after five seconds without an expected movement snapshot, ignores old-socket frames, and reconnects on foreground/network return. It generates no idle keepalive traffic and never retransmits economic commands. Pending purchases retain the existing uncertain-outcome behavior. Idle snapshots cancel the movement watchdog.

79/79 checks passed across SQLite, disposable Postgres and real sockets, including controlled frozen movement recovery, stale-socket frames, no purchase replay and no idle probe traffic. Production build passed. This client recovery follow-up is **not deployed** and does not prove the live glitch resolved. A refreshed two-device test and phone performance run remain required after deployment.

Recovery follow-up deployment subsequently succeeded: exact source `2612de9f479b6f6b34d27334290d2fee414929d8`, Render deploy `dep-dbcl15ui0phs73f6bsp0`, October 21 around 7:54 PM EDT, 28.5 seconds. This supersedes the pending deployment above. A fresh private seven-town/nineteen-receipt backup passed restoration and is paired with prior live `73a9ee4`. The browser reloaded and recovered F948C3, both named residents, garden progress and 337 credits. Mac walking to Market Square produced live walking feedback. The Mac diagnostic remained at 0:00 and was not started by the agent; no phone performance pass is claimed. User was asked to refresh the phone and repeat movement with both game pages visible. The intermittent live freeze remains open until that retest; local controlled recovery tests do not establish its precise cause.
