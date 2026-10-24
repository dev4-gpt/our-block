# OUR BLOCK security review — 23 October 2026

Scope: deployed `https://our-block-1ooe.onrender.com/`, source at `f9ca3c0`, installed dependency lockfile and isolated local production server. This is a targeted review, not a security certification or exhaustive penetration test. No production WebSocket saturation, town enumeration, private-data extraction or load testing was performed. No production settings or game code were changed.

The requested “Cloudflare security test” skill is not installed. The installed Web Security Testing workflow was used. The Cloudflare Workers skill excludes traditional Node servers. Live responses do pass through Cloudflare (`Server: cloudflare`, `CF-Ray` present), but that does not establish which firewall, bot or rate-limit rules Render enables. No Cloudflare account configuration was available to audit.

## Findings

### Medium: unauthenticated connections can exhaust all WebSocket slots

`server/index.ts:108` limits all open sockets to `MAX_PLAYERS + 8` (12 by default). A socket need not join a town to consume a slot. The heartbeat at line 362 checks ping/pong liveness, not whether admission completed; a normal WebSocket client automatically responds. There is no join deadline.

A temporary local server with a fresh SQLite directory accepted 12 unjoined connections. All 12 were still open after 31 seconds, across the first heartbeat. The next connection was rejected with HTTP 401. The probe then terminated its connections and server successfully. No production users or data were involved.

Impact: one client can deny new connections, including recovery attempts, without knowing a town code. The existing handshake budget does not prevent 12 initial connections.

Remediation: enforce a short join deadline, close failed admissions, and bound pending admissions separately from active residents. Add a per-source concurrency policy with correctly configured trusted-proxy handling; do not blindly trust client-supplied forwarding headers. A join timeout alone still permits an attacker to refill slots, so it is only one layer.

### Medium: no framing restriction on live HTML

Root, support and privacy responses contain neither CSP `frame-ancestors` nor `X-Frame-Options`. A hostile page could frame the game and overlay misleading controls. Framing itself was not browser-tested because browser control is disabled.

Remediation: decide whether Handshake needs to embed the game, then set a compatible CSP `frame-ancestors` allowlist and framing policy. Avoid breaking a required legitimate embed.

### Low: browser hardening headers are absent

The same live responses lack Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Strict-Transport-Security. Missing CSP does not prove an XSS vulnerability; no executable injection was demonstrated. Missing HSTS alone does not establish whether the hosting parent domain has an effective preload policy.

Remediation: add a CSP compatible with the bundled app and WebSocket endpoint, `nosniff`, an explicit referrer policy, permissions restrictions for unused capabilities, and an appropriate transport policy coordinated with hosting. Test the resulting app, styles, 3D rendering and connection recovery.

### Low: public health endpoint exposes operational details

`server/index.ts:41` returns town count, online count, outgoing byte count and process RSS without authentication. These are not credentials, but provide unnecessary reconnaissance information.

Remediation: keep public readiness minimal and put detailed metrics behind operational access control.

### Design limitation: town links are invitations, not private-room authentication

Town codes are six hexadecimal characters (24 random bits). Knowing a code lets a new player request an available seat; seat recovery uses a separate 192-bit random token. Do not describe towns as confidential or authenticated private rooms. No live code guessing was attempted. Consider stronger invitation credentials or host approval if private-room guarantees become a product requirement.

## Checks with no issue observed

- `npm audit --json`: zero known advisories across production and development dependencies at the time of the check. This does not assess unknown vulnerabilities or container/OS packages.
- `NETWORK_TEST=1 npm test`: 96 tests, 95 passed, zero failed, one Postgres-specific test skipped. Includes real sockets, room isolation, token filtering, seat recovery, restart persistence, forged-command rejection and duplicate financial-action handling. Network integration used temporary SQLite, not the live Neon database.
- An isolated cross-origin WebSocket request with `Origin: https://unrelated.example` was rejected with HTTP 401. Missing Origin is allowed for nonbrowser clients; Origin is not an authentication mechanism.
- Public requests for `/.env`, `/.git/config`, `/server/index.ts` and `/backups/` returned HTML fallback content, with no tested secret/source markers observed in the first 4 KiB. HTTP 200 here is the SPA fallback, not proof that those files were served. An encoded traversal request returned HTTP 400.
- Source review found parameterized database queries, TLS certificate verification for production Postgres, command allowlists, an 8 KiB WebSocket payload limit, server-selected player identity, and recovery tokens omitted from shared snapshots. No dangerous HTML insertion sink was observed in the reviewed client paths.

## Limits and evidence

Live inspection used eight small HTTP requests, reading at most 4 KiB from each response, with normal HTTPS certificate verification. Browser-based framing/XSS exploitation, provider account settings, container vulnerability scanning and production database penetration testing were outside this review. Existing tests are regression evidence, not a comprehensive malicious-input fuzzing campaign.

Execution artifacts in this session: `/tmp/our-block-audit.json`, `/tmp/our-block-security-tests.log`, `/tmp/our-block-security-probe.mjs`. These temporary files may disappear; the conclusions and counts are retained here. The local probe uses a disposable database and closes all sockets and its server afterward.

Priority: fix admission-slot exhaustion first, then apply and verify framing/browser policies. Cloudflare being present at the edge does not resolve these application findings by itself.

## Remediation — 24 October 2026, candidate `2026.10.24-rc2`

The following changes are implemented and locally verified; deployment and live browser verification remain pending:

- Pending sockets have a fixed ten-second admission deadline independent of pongs. Pending admission is bounded separately from admitted players: eight globally and four per transport source. Completed admissions release their pending reservation. Rejected joins close, and closed connections release reservations, including interrupted upgrades. A connection that disappears during a durable admission is cleaned up without leaving a new online ghost or replacing an existing live recovered seat.
- Production responses now set CSP, `nosniff`, a no-referrer policy, permissions restrictions and one-year HSTS without subdomain inclusion. CSP permits self-hosted scripts/assets and an explicit same-host secure WebSocket origin for WebKit compatibility. Inline styles remain permitted for existing React/Three.js styles and the support page; inline scripts and script evaluation are not allowed. `frame-ancestors` permits only self and the two known Handshake origins. X-Frame-Options is deliberately omitted because SAMEORIGIN would conflict with authorized cross-origin Handshake embedding in browsers that use it.
- Public `/health` retains readiness, protocol, release and storage-availability status. Counts, RSS and outgoing bytes moved to `/metrics`, requiring an exact Bearer `METRICS_TOKEN` of at least 32 characters using a timing-safe comparison. With no configured token the endpoint is disabled. The local load harness generates its own ephemeral token; a future public memory test must use a token privately configured on Render and in the operator's environment. Missing metrics now fail explicitly instead of reporting zero memory.
- Release ID is now `2026.10.24-rc2`, distinct from the earlier deployment with themed worlds.

Validation: full suite **98 tests: 97 passed, zero failed, one Postgres-specific test skipped**. The new local production-server regression checks response policies, refusal of unauthorized metrics, valid private metrics, cross-origin rejection, idle-slot expiry, continued admitted-player connectivity, failed-join closure and seat recovery. After the final timeout cleanup adjustment, the targeted security suite was rerun. TypeScript and Vite production build pass; the existing large world-bundle advisory remains.

Residual limits: these changes prevent the demonstrated indefinite idle-slot hold; they do not make an anonymous four-place service immune to persistent reconnect floods, distributed denial of service or people legitimately occupying all places. Transport-source limits deliberately ignore untrusted forwarding headers; shared Render proxy addresses can therefore share pending limits. Cloudflare/Render edge policies still require provider-side inspection. No browser rendering/CSP enforcement check was possible while local browser control is disabled. Town links retain their existing invitation behavior and are not confidential-room authentication.
