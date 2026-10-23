# Support and private operations

Public route: https://app.joinhandshake.com/profiles/r9qfrx, verified in the owner's signed-in account October 23. Public reachability/contact can depend on Handshake account permissions. Inviter relay is the fallback. Never collect recovery tokens in support messages.

## Reports

Ask for release identifier, device/browser, approximate time and reproduction steps. Keep only the information needed to resolve the issue; do not copy personal support conversations into Git. Public issue reports must omit town links, nicknames, secrets, and player screenshots with personal information. Reproduce in a disposable local town when possible.

## Shared-town deletion requests

No deletion has been requested or authorized by this release task. This procedure does not grant permission to purge data.

1. Receive the request privately; ask for the town code only through private support. Establish which seats and shared progress are affected.
2. Observe the requester act from the existing recovered seat in a private live verification session: agree two ordinary contextual pings/acknowledgments with landmarks and timing and observe the seat ID perform them. Do not ask them to reveal the token. Nicknames, screenshots, and codes alone are insufficient. If no saved seat can be recovered, do not infer ownership.
3. Resolve other residents' interests; do not let one arbitrary seat delete a shared town. Confirm the exact shared-town removal and irreversible consequences with the authorized participants before any mutation. Escalate disputed or unverifiable requests; no automatic deletion occurs.
4. Before execution, stop writes to the target town and review the precise town/receipt records affected. Delete that town and its receipts transactionally using a reviewed operator procedure. Do not affect other towns. Verify absence without printing secrets.
5. Locate all private copies of this town (daily/release exports and immutable rollback archives). Redact that town and its receipts or remove the complete copy if no other needed data is lost; keep an owner-only removal log outside Git. Re-run restore verification on redacted exports. Do not restore any untreated copy. A rollback pair containing removed data becomes invalid until sanitized and reverified.
6. Confirm processing privately. Remove report details once no longer needed; retain only the minimal private removal record needed to prevent resurrection. No unimplemented automatic retention clock or response SLA is promised.

## Daily/release backups

Use npm run backup -- /private/durable-directory --daily once per day during active release work, and omit --daily before a deployment. The tool retains seven dated daily and three release copies in its own namespace. The directory must be private, persistent, ignored by Git, and outside Render's ephemeral filesystem. Store access credentials separately. Do not upload private backup files as release artifacts.

Run npm run verify:backup -- /private/backup.backup.json before release. Pair the verified file with the exact previously-live source in a private rollback manifest. Preserve the chosen export under an immutable private filename when rotation could remove a required rollback copy. Restore only sanitized backups into an empty target first. Never roll back schema-affecting code without the matching verified data.

No unattended scheduling is configured. Without an operator backup that day, record a missed backup rather than implying automation. No paid cron, paid storage, or artificial service keepalive is allowed. Review Render/Neon dashboards before deployment and stop if the $0 allowance cannot cover it.
