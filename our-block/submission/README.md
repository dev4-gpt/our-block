# Submission assets and links

Current project title: **OUR BLOCK — Build a Neighborhood Together**.

- [Play the public game](https://our-block-1ooe.onrender.com/)
- [GitHub source branch — public](https://github.com/dev4-gpt/our-block/tree/codex/cloud-hosting)
- [Handshake showcase project](https://app.joinhandshake.com/ai-showcase/projects/3670200)
- [Handshake submission editor](https://app.joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/submit) (sign-in may be required)
- [Support](https://our-block-1ooe.onrender.com/support.html), [privacy](https://our-block-1ooe.onrender.com/privacy.txt), [credits](https://our-block-1ooe.onrender.com/credits.txt)

Use the root playable URL in public text, without a saved-town code or diagnostic query. The showcase URL was observed in the user's LinkedIn draft; final submission and social publication status have not been independently confirmed.

## Copy

- [Project title](title.txt)
- [Short description](description.txt): 482 characters excluding its final newline, within the previously observed 500-character form limit.
- [Detailed project description](project-description.md)
- [LinkedIn and Handshake post drafts](social-posts.md): local drafts; publication has not been confirmed.

## Current screenshots

All current captures come from the deployed game, release **2026.10.24-rc2**, captured October 25, 2026. The source screenshots are unaltered browser captures. The two unified images crop and resize actual gameplay, add labels, and do not synthesize game content.

- [Closer seven-world montage](all-worlds-close-view.png): 3200 × 1500, tighter framing around the six districts; latest user-requested composition.
- [Full-view seven-world montage](all-worlds-full-view.png): 3200 × 1500, wider overview.
- [Single Island & Beach gameplay capture](cover-rc2-gameplay.png).
- Individual full-view captures: [Forest](world-forest.png), [City](world-city.png), [Snowy Mountains](world-snow.png), [Island & Beach](world-island.png), [Space Station](world-space.png), [Moon](world-moon.png), [Mars](world-mars.png).

For a form explicitly requiring one game screenshot, use the single gameplay capture. The montage is a composite of seven screenshots and its 32:15 shape differs from the previously recommended 3:2 cover ratio; inspect the uploader's crop before publishing.

Historical captures remain in this directory: `cover-rc1-gameplay-1200x800.png` and `cover-gameplay-1200x800.jpg`. `cover-draft.png` is AI-assisted promotional artwork, not an implemented-game screenshot.

## Verification and limits

Security release `f889f9d` was verified live on October 24: public health reports `2026.10.24-rc2`, security headers are present, and unauthenticated metrics access returns 404. The code passed 97 tests with one Postgres-specific skip and a production build. Subsequent submission-copy and screenshot changes do not change the executable.

See [release status](../docs/RELEASE_STATUS.md) and [security review](../docs/SECURITY_REVIEW_2026-10-23.md). Free hosting supports four online residents total and may sleep. No one-hour run is an official requirement established by this project. The entrant controls final submission and social publishing; this asset update does not publish either.

Link checks: on October 25, game, support, privacy, credits and Handshake showcase returned HTTP 200; 26 local Markdown destinations were checked for existence. On October 26, the user authorized changing `dev4-gpt/our-block` from private to public. GitHub confirmed public visibility, and the source branch returned HTTP 200 without authentication. A targeted scan of reachable local Git history found only placeholder/test database credentials and no unexplained credential candidates; private ignored backups were not published.
