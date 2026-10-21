# LAST LIGHT

**Two screens. One city.** A cooperative browser rescue game for two people on separate devices, or one player with EMBER, a labeled bot teammate.

One player controls power; the other dispatches rescue vans. Rescue six groups in five minutes by coordinating bridges, pumps, gates, and a powered shelter. Contextual radio requests make voice chat optional.

## Run locally

Requires Node.js **24 or newer** (uses built-in `node:sqlite`).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Create a room, copy the invite link, and open it in another browser tab or device. Each tab has its own seat in sessionStorage. To play on a phone on the same network, use your computer's LAN address instead of localhost. For testing alone, add EMBER in the lobby.

```sh
npm test
npm run test:network
npm run build
npm start
```

`test:network` starts its own server on port 3011, uses a temporary SQLite database, and verifies actual socket connections and a process restart. It needs permission to bind a local port. `npm start` serves the production build and sockets from the same port. `npm run dev` uses Vite middleware.

## Controls and rules

- **Gridkeeper:** select a circuit, review its effect, confirm power or release. Two active branches maximum; three-second relay cooldown. Reserved crossing paths cannot lose power.
- **Pathfinder:** select a van and a waiting group, review its route, dispatch. A van carries one group. After pickup, dispatch back to Beacon Shelter; unloading waits for shelter power.
- **Radio:** request power for a landmark. Teammate responses are On it, Done, or Cannot yet. Requests never execute infrastructure actions.
- North Gate controls northern access; Canal Pump controls the southern access and shortcut. Harbor Bridge is the fast middle crossing.
- Calm mode removes the deadline. Retry keeps the mission; New mission advances through three authored rescue layouts.
- 2D MAP preserves gameplay without WebGL. Keyboard users can operate all controls through the side panel. Reduced-motion preferences are respected. Sound is opt-in and never required.

## State and reconnection

The server owns routes, time, phase, scoring, seats and all mutations. Clients receive role-specific views: Gridkeeper never receives group records or van route/target fields during play; Pathfinder never receives the circuit-description records. Shared infrastructure states, moving vehicles and completed rescues are intentionally public. Postgame replay reveals both perspectives.

An unguessable seat token and room code are saved in sessionStorage. Refresh rejoins that seat. A second connection for the same token replaces the old connection. If a player disconnects during a mission, simulation and battery pause for 60 seconds; afterwards the remaining player may replace the seat with EMBER or end the mission. The deadline remains paused until the player chooses, so the mission never silently resumes without a teammate.

SQLite saves every two seconds and after human commands. A sudden process crash can lose up to two seconds of movement. Graceful shutdown saves immediately. Restarted missions wait for their human seats to reconnect. Set `DATA_DIR` to a writable durable directory, default `./data`; keep a single server instance because rooms are held in process memory.

## Deployment

A Dockerfile and Render blueprint are included. The blueprint requests a paid starter instance with a persistent disk; review provider pricing before provisioning. No hosting account has been provisioned and no public deployment is claimed.

1. Push this project to your Git provider.
2. Create a Render Blueprint from that repository using `render.yaml`, or run the Docker image on another persistent-volume host.
3. Route HTTPS and WebSocket traffic to the same service. The platform sets `PORT`.
4. Verify `/health`, room creation, a full mission across separate networks, refresh, and restart recovery.

Do not deploy multiple replicas without replacing the in-process room registry and SQLite architecture. Room rate limits are intended for a modest demo, not a large public launch.

## Attribution and prior work

Autopolis (Steven Koehl, MIT) provided the adapted grid-native routing approach, seeded layout RNG, and shaded geometry helper. The rescue simulation and UI are original. DispatchIQ inspired deterministic operation validation; Veloce Forge inspired the original event replay. No source from those two projects was copied. Full notice: [public/credits.txt](public/credits.txt), also served at `/credits.txt`.

No AI service, microphone, paid model, or live generation is needed. No claim of a guaranteed prize or verified competition eligibility is made.

## Acceptance checks still requiring people/devices

Automated rules and two-client socket tests do not replace these checks:
- Five unfamiliar pairs: at least four perform their first rescue without creator instruction; at least three voluntarily replay.
- Actual 375px phone layout and sustained 30 FPS on a midrange phone.
- Two devices on different external networks after public deployment.
- Capture real two-screen gameplay with OpenScreen, then create a 3:2 cover at least 1200px wide.
- Verify official challenge deadline, third-party reuse eligibility, and prize rules before publishing to Handshake.

Suggested submission description (under 500 characters):

> Two screens. One city. In LAST LIGHT, one player restores power while the other guides rescue vans through a blackout. Coordinate with radio pings to bring six groups home before the battery dies. Built with ChatGPT through planning, multiplayer debugging, and testing. Play together through a room link or try solo with EMBER. Includes Calm mode, reconnect recovery, and a postgame replay.
