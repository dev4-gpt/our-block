# LAST LIGHT — Two screens. One city.

Implemented local v1 · October 20, 2026. See README.md for running, deployment, verification, and remaining real-world acceptance checks.

## Pitch and core loop

Two players rescue six stranded groups during a five-minute island blackout. Gridkeeper controls infrastructure; Pathfinder controls two rescue vans. Both watch the city return to light as people reach shelter.

Observe → request help at a landmark → teammate changes infrastructure → preview and dispatch a route → collect and deliver passengers → share the rescue reward.

The first encounter gives progressive on-screen guidance: power Harbor Bridge, collect the Clocktower group, and return to the powered shelter. There is no required microphone or modal manual.

## Rules

- One 16×16 island, six groups, two vans, one shelter, and four power branches. Each van carries one group.
- Only two branches can run at once. Switches have a three-second cooldown. Preview a change before confirming it.
- Harbor Bridge is the quick middle crossing. North Gate controls upper access and its crossing. Canal Pump opens lower access and its crossing. Beacon Shelter must be powered for unloading.
- Routes reserve required infrastructure until the van completes its journey, including any gate tile it currently occupies. The server refuses to switch that infrastructure off.
- Rescue credit is awarded only after shelter delivery, once per group. A loaded van cannot collect another group.
- Three authored group layouts share the island and are independently checked for legal solutions within the five-minute standard deadline.
- Standard mode ends at five minutes or six rescues. Calm mode measures elapsed time without a deadline. Retry keeps the layout; New mission advances to the next one.
- Progression labels move from First Contact to Across the Water to The Last Light as rescue totals increase. Gameplay complexity comes from geography and power allocation, not arbitrary timed disasters.

## Roles and communication

Gridkeeper receives circuit descriptions and controls. Pathfinder receives group records and van routes and targets. Both receive public infrastructure states, visible van positions, rescue totals, and a redacted live event feed. Completed missions reveal the recorded event sequence for replay.

Radio requests target Harbor Bridge, Canal Pump, North Gate, or Beacon Shelter. The recipient responds On it, Done, or Cannot yet. Requests never perform actions. EMBER is clearly labeled and dispatches or responds to requests through the same validation as a human player.

There is no mid-mission role swapping. A host adds a bot in the lobby. A disconnect pauses simulation and battery; after 60 seconds the remaining player explicitly chooses bot replacement or mission end. Refresh uses the saved seat token. New players cannot take occupied seats or join an active mission without their original token.

## Presentation

A deterministic low-poly island, slate water, warm shelter and window lights, readable vehicle colors, and restrained amber controls. Rescue progress lights additional windows. Sound is opt-in, with a short synthesized chord on delivery. All feedback also works visually.

Large HTML controls support keyboard operation; 2D Map preserves the rescue interface without WebGL. Reduced-motion preferences disable interpolated vehicle movement. The 3D renderer loads separately from the landing page.

## Architecture

React/Vite and Three.js client; Node HTTP and ws server; SQLite snapshots on a durable volume. One service serves the frontend and sockets. Run one instance.

The server validates role permissions, destinations, routes, capacity, cooldowns, and mission state. Actions include an ID, phase, and mission generation so duplicates and stale commands from an earlier retry cannot change the new mission. Role-specific projections exclude private fields and all seat tokens.

Room codes locate rooms; unguessable seat tokens authorize seat recovery. Snapshot persistence runs every two seconds and after human commands. Graceful termination saves immediately. After restart, missions remain paused until humans reconnect. A crash may lose up to two seconds of movement.

## Open-source integration

- **sleuthy-sloth/autopolis**, starred, MIT: adapted grid-native A* approach, Mulberry32 seeded layout helper, and shaded box geometry technique. Original rescue renderer and server protocol replace the city-simulator product. Full upstream notice is in public/credits.txt.
- **dev4-gpt/DispatchIQ**, created: design inspiration for deterministic validation of proposed operations. No Python backend or source copied.
- **dev4-gpt/veloce-forge**, created: inspiration for original timed-event replay. No source, wallet, model, or sandbox integration copied.
- **OpenScreen**, starred: recommended future capture tool after real-device acceptance. It was not installed or used, and no recording is claimed.
- Other audited candidates remain optional production aids or unrelated infrastructure. Pipecat and VoiceAI are unnecessary for pings-first multiplayer. WorldClaw is not a runtime dependency. A selective code review does not prove that no other repository could ever help.

## Verification status

Automated tests cover legal routes, meaningful power scarcity, capacity, cooldowns, reserved crossings, scoring, expiry, Calm mode, role privacy, stale and duplicate commands, retry reset, bot takeover, legal scripted solutions, and cooperating bot policies for all three layouts.

A separate real-socket test verifies room isolation, invalid-role rejection, seat recovery, and SQLite recovery across process restart. Browser testing verified two distinct player tabs, a complete first rescue, refresh rejoin, radio requests, previews, and the 2D map toggle. public/gameplay-preview.png is an actual browser screenshot.

Still unmeasured: five unfamiliar pairs, actual-phone responsiveness and 30 FPS, external-network play after public deployment, and OpenScreen capture. The Dockerfile and Render blueprint are prepared; no public service has been provisioned. Prize, deadline, and prior-work eligibility need official verification. No guarantee of a prize is made.
