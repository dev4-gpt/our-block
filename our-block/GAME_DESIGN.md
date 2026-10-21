# OUR BLOCK — implementation design and acceptance record

Audience: ages 9–15. One to four invited residents run a youth cooperative in a compact 3D neighborhood. Fictional credits represent choices and consequences, not real financial products. The learning loop is observe → investigate → plan → acquire → act → compare result → adjust.

Six districts are connected by walkable streets and open-front interiors: Home, Market, Workshop, Garden, Depot and Hall. Activities, offers, upgrades and projects are defined in shared/content.ts. Rules and transactional mutations are server-owned in shared/game.ts; navigation uses shared/navigation.ts. There are no required quizzes or voice chat.

## Current playable content

- Home: meter inspection, shelf repair job, water supplies; storage and insulation improvements.
- Market: compatible-parts comparison, produce sales, stock-sorting job; stall and cupboard improvements.
- Workshop: fault measurement, stool repair, replacement-claim test; bench and repair station improvements.
- Garden: planting/watering, timed harvest, leak inspection, growing trial; irrigation and rain collection improvements.
- Depot: order packing, route/receipt investigation, independent desk verification; cart and shelving improvements.
- Hall: food preparation, setup job, hire-term inspection; optional kitchen rental and event equipment.

Three cross-district commissions have alternative solutions and alternating supply demands. Garden: connector or whole hose, with a protective pad for repeat variant. Market: paper or reusable packaging; one or two orders. Evening: prepared food or packed produce, hired or owned lighting; one or two stools. Wrong unused purchases can be returned; contracts can be canceled without fees and renegotiated after expiry. Evidence persists because residents retain what they learned.

## Economy and time

300 initial shared credits, personal earnings, player backpacks, shared storage and atomic transfers. Shared spending requires a distinct online teammate; solo requests confirm directly. Starter jobs pay without materials once per day. Optional kitchen costs 10 upfront and 8/day beginning the next day; insulation reduces the recurring bill to 5. Unpaid bills suspend only the rented kitchen. Caretaker work reduces arrears by 5 per day; returning kitchen stops new bills. Starting housing remains safe.

Life day: 1200 active seconds. The town stops at day review and when all residents disconnect. Explore mode removes the day clock. Crops mature after 30 active seconds, stop offline and require explicit harvest. Ledger distinguishes income, spending and internal contributions; it is a cash accounting teaching model, not full business accounting.

## Visual and accessibility baseline

Procedural pastel low-poly neighborhood, warm light, named landmarks and visible improvement markers. Rotatable/zoomable camera, keyboard and tap walking, server-routed doorways. HTML controls expose all actions; map mode works without WebGL. Reduced motion and optional musical feedback. No external model calls or proprietary generated assets.

## Verification and remaining acceptance

Automated rules prove both initial project approaches and alternate commission supplies. Socket integration covers four seats, isolation, recovery and server restart. These do not prove human comprehension or learning transfer.

Remaining external gates: five unfamiliar pairs (four first-project successes without creator help); transfer to a new unlabeled scenario; voluntary replay; actual 375px device and sustained 30 FPS; measured 10 Mbps load; public hosting/external networks; real gameplay capture; Unity builds and mixed-client sessions. Keep these unchecked until observed.

Current investigations return authored observations after interaction. Future polish should add richer object manipulation, animations and more differentiated local stories. Do not describe this prototype as a fully validated six-district life simulation or claim a prize outcome.
