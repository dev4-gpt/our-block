# Technical privacy inventory — review still open

October 21, 2026. This inventories the candidate implementation; it does not certify legal compliance or age suitability. Complete the appropriate consent/privacy review before broader child-directed release.

| Data | Purpose and location | Control / remaining gate |
|---|---|---|
| Chosen nickname | Display in a private invited town; stored in the town database | 24-character limit; no real name required; no birthday/email field |
| Opaque seat recovery token | Authorize the seat; server database and current browser session | Other residents never receive tokens. Opt-in Remember stores it on the device; Forget clears both browser stores. Invitation URLs contain only the town code. |
| Inventory, balances, activity evidence and world progress | Server-owned multiplayer rules and saved towns in Neon; SQLite locally | Room isolation and private payload tests; no public matchmaking |
| Economic command IDs/results and purchase provenance | Durable duplicate-effect protection and recovery | Stored transactionally with town changes; not behavioral advertising or third-party analytics; storage budget enforced |
| Transport peer address and rate counters | Bounded in-memory abuse limits | Not deliberately persisted or logged by game code; forwarded addresses are not trusted |
| Device-check frame counts | Optional ten-minute local rendering diagnostic | Enabled with `deviceCheck=1`; no identifiers, uploads or network requests in the diagnostic; refreshing or hiding the page invalidates a run |
| Guidance preference | Local presentation choice | Device storage only; no age segmentation or automatic answer highlighting |
| Backups | Recovery from releases/data failure | Contain seat secrets; private files outside Git. Seven daily / three release retention supported. Automated off-Mac private backup scheduling remains open. |
| Provider operational metadata | Hosting and database operation | Render, Neon and GitHub have their own account/operational data practices; review those before broader release. Do not assume game code controls provider logs. |
| Fonts | Device system font stack | External Google Fonts import removed in the polish candidate; no font request is needed. |

No advertising SDK, free-text chat, real-money transactions, live model calls, birthday collection or behavioral analytics service is included. Players can exchange only authored contextual pings and acknowledgments. Nicknames are rendered as text. Do not claim that private invitation codes provide parental consent or verified identity.

Use anonymous playtest notes. Obtain guardian permission where appropriate before recruiting minors, and separate permission for identifiable recording. The entrant handles participant recruitment and competition terms personally. No messages to prospective participants have been sent by the agent.

Before broader release, decide a clear retention/deletion/support process for town owners, review child-directed positioning (including the existing Unity project audience setting), complete consent review, and verify the privacy notice against the actual deployed configuration. Never silently delete towns to free storage.

The browser links to a plain-language playtest privacy/support notice. Nicknames and town links are not identity verification or consent. The operator must still establish an appropriate support contact, identity-safe deletion verification, backup deletion/retention policy and consent review before a broader child-directed release. This technical work is not a legal compliance certification.
