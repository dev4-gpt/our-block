import http from "node:http";
import { validateCommand, errorCode, Budget } from "./validation.ts";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { openStore } from "./storage.ts";
import { TownService } from "./towns.ts";
import { SimulationClock } from "./simulation-clock.ts";
import { WebSocketServer, WebSocket } from "ws";
import {
  GameRuleError,
  createTown,
  join,
  apply,
  tick,
  snapshot,
  restore,
  disconnect,
  type Town,
} from "../shared/game.ts";
const port = Number(process.env.PORT || 3001);
const service = new TownService(await openStore());
await service.load();
const towns = service.towns;
let shuttingDown = false;
const maxPlayers = Math.min(
  100,
  Math.max(4, Number(process.env.MAX_PLAYERS || 4)),
);
const handshakes = new Budget(180, 60000),
  creations = new Budget(30, 3600000);
let outgoingBytes = 0;
const prod = process.argv.includes("--production");
const vite = prod
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" });
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: !shuttingDown,
        protocol: 1,
        towns: towns.size,
        availability: service.availability,
        capacity: maxPlayers,
        online: [...towns.values()].reduce(
          (n, t) => n + t.players.filter((p) => p.online).length,
          0,
        ),
        outgoingBytes,
        rss: process.memoryUsage().rss,
      }),
    );
    return;
  }
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(
      new URL(req.url || "/", `http://localhost:${port}`).pathname,
    );
  } catch {
    res.statusCode = 400;
    res.end("Invalid path");
    return;
  }
  let file = path.resolve("dist", "." + pathname);
  if (!file.startsWith(path.resolve("dist") + path.sep))
    file = path.resolve("dist/index.html");
  if (!existsSync(file) || !path.extname(file))
    file = path.resolve("dist/index.html");
  try {
    res.setHeader(
      "Content-Type",
      (
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".txt": "text/plain",
          ".json": "application/json",
        } as any
      )[path.extname(file)] || "application/octet-stream",
    );
    res.end(readFileSync(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 8192,
  verifyClient: ({
    origin,
    req,
  }: {
    origin: string;
    req: http.IncomingMessage;
  }) => {
    try {
      if (
        !handshakes.take(req.socket.remoteAddress || "unknown") ||
        wss.clients.size >= maxPlayers + 8
      )
        return false;
      return !origin || new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  },
});
const clients = new Map<WebSocket, { code: string; id: string }>();
const published = new Map<string, string>();
const stamp = (t: Town) =>
  `${t.revision}:${t.movementSequence}:${service.availability}`;
function send(ws: WebSocket, x: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    const body = JSON.stringify(x);
    outgoingBytes += Buffer.byteLength(body);
    if (ws.bufferedAmount > 262144) {
      ws.close(1013, "Connection too slow; recover your saved seat.");
      return;
    }
    ws.send(body);
  }
}
function broadcast(t: Town) {
  published.set(t.code, stamp(t));
  for (const [ws, c] of clients)
    if (c.code === t.code)
      send(ws, {
        type: "state",
        state: { ...snapshot(t, c.id), availability: service.availability },
      });
}
wss.on("connection", (ws, req) => {
  let n = 0,
    start = Date.now(),
    joinedOrJoining = false;
  let incoming = Promise.resolve();
  ws.on("error", () => {});
  ws.on("pong", () => {
    (ws as any).alive = true;
  });
  (ws as any).alive = true;
  ws.on("message", (raw) => {
    if (shuttingDown) return;
    if (Date.now() - start > 1000) {
      n = 0;
      start = Date.now();
    }
    if (++n > 30) {
      send(ws, {
        type: "error",
        message: "Please slow down.",
        code: "RATE_LIMIT",
      });
      return;
    }
    incoming = incoming
      .then(async () => {
        let m: any;
        try {
          try {
            m = JSON.parse(raw.toString());
          } catch {
            throw Error("Invalid JSON message.");
          }
          if (!m || typeof m !== "object") throw Error("Invalid message.");
          if (m.type === "join") {
            if (joinedOrJoining) throw Error("Already joined.");
            joinedOrJoining = true;
            if (
              Object.keys(m).some(
                (k) => !["type", "code", "token", "name", "mode"].includes(k),
              ) ||
              (m.code && !/^[A-Za-z0-9]{6}$/.test(m.code)) ||
              (m.token &&
                (typeof m.token !== "string" || m.token.length > 128)) ||
              (m.name && (typeof m.name !== "string" || m.name.length > 24))
            )
              throw Error("Invalid join request.");
            let code = String(m.code || "").toUpperCase();
            if (!code) {
              if (!creations.take(req.socket.remoteAddress || "unknown"))
                throw Error(
                  "CAPACITY: Please wait before creating another town.",
                );
              await service.refreshUsage(true);
              if (service.usage.towns >= 500 || service.storageRatio >= 0.8)
                throw Error(
                  "CAPACITY: New towns are paused. Existing progress is preserved.",
                );
              if (towns.size >= 500) throw Error("Town capacity reached.");
              do {
                code = randomBytes(3).toString("hex").toUpperCase();
              } while (towns.has(code));
            }
            await service.run("$admission", () =>
              service.run(code, async () => {
                if (ws.readyState !== WebSocket.OPEN) return;
                if (!m.code) {
                  await service.refreshUsage(true);
                  if (service.usage.towns >= 500 || service.storageRatio >= 0.8)
                    throw Error(
                      "CAPACITY: New towns are paused. Existing progress is preserved.",
                    );
                }
                const existing = await service.ensure(code);
                if (m.code && !existing)
                  throw Error("Town not found. Check your invitation.");
                const t = existing
                  ? structuredClone(existing)
                  : createTown(code, m.mode === "life" ? "life" : "explore");
                let p = t.players.find((x) => x.token === m.token);
                if (m.token && !p)
                  throw Error("Seat recovery token is invalid.");
                const occupied = [...towns.values()].reduce(
                  (n, t) => n + t.players.filter((x) => x.online).length,
                  0,
                );
                const active = [...towns.values()].filter((t) =>
                  t.players.some((x) => x.online),
                ).length;
                if (
                  !p?.online &&
                  (occupied >= maxPlayers ||
                    (!existing?.players.some((x) => x.online) && active >= 25))
                )
                  throw Error(
                    "CAPACITY: The server is full. Your saved seat is valid; wait and reconnect.",
                  );
                if (!p) {
                  if (m.token) throw Error("Seat recovery token is invalid.");
                  p = join(
                    t,
                    String(m.name || "Neighbor"),
                    randomBytes(24).toString("hex"),
                  );
                }
                p.online = true;
                t.revision++;
                await service.commit(t);
                for (const [old, c] of clients)
                  if (c.code === code && c.id === p.id) {
                    clients.delete(old);
                    old.close(4001, "Seat opened elsewhere");
                  }
                clients.set(ws, { code, id: p.id });
                send(ws, { type: "joined", code, token: p.token, id: p.id });
                broadcast(t);
              }),
            );
            return;
          }
          const c = clients.get(ws);
          if (!c) throw Error("Join first.");
          validateCommand(m);
          const result = await service.action(c.code, c.id, m);
          send(ws, {
            type: "result",
            id: m.id,
            message: result.message,
            code: "ACCEPTED",
            revision: result.town.revision,
            movementSequence: result.town.movementSequence,
            duplicate: !!result.duplicate,
          });
          broadcast(result.town);
        } catch (e) {
          const message = (e as Error).message;
          const publicError =
            e instanceof GameRuleError ||
            /^(CAPACITY:|READ_ONLY:|STALE:|Already |Town |Seat |Invalid |Join |Unsupported |Walk |Choose |You |Not |No |A |The |This |Your |Their |Meet |Review |Rent |Contact |Resolve |Stay |Unknown |Accept |Renegotiate |Inspect |Check |All |One |Backpack |Shared |Please |Server )/.test(
              message,
            );
          send(ws, {
            type: "error",
            id: m?.id,
            code: publicError
              ? e instanceof GameRuleError && e.code !== "RULE"
                ? e.code
                : errorCode(message)
              : "STORAGE",
            message: publicError
              ? message
              : "Save unavailable. No action was confirmed. Reconnect and review the town before trying again.",
          });
          if (!clients.has(ws)) joinedOrJoining = false;
          const c = clients.get(ws);
          if (c)
            send(ws, {
              type: "state",
              state: snapshot(towns.get(c.code)!, c.id),
            });
        }
      })
      .catch(() => console.error("Socket handler failed."));
  });
  ws.on("close", () => {
    void incoming
      .then(async () => {
        const c = clients.get(ws);
        clients.delete(ws);
        if (c) {
          try {
            await service.disconnect(c.code, c.id);
          } catch {
            console.error("Disconnect save delayed.");
          }
          broadcast(towns.get(c.code)!);
        }
      })
      .catch(() => {});
  });
});
const simulationClock = new SimulationClock(Date.now());
let saveAt = 0;
const timer = setInterval(async () => {
  if (shuttingDown) return;
  const now = Date.now(), dt = simulationClock.begin(now);
  if (dt === undefined) return;
  const flush = now - saveAt >= 2000;
  if (flush) saveAt = now;
  try {
    for (const code of published.keys())
      if (!towns.has(code)) published.delete(code);
    await Promise.all(
      [...towns.keys()].map(async (code) => {
        try {
          await service.advance(code, dt, flush);
        } catch {
          console.error("Periodic save delayed; will retry.");
        }
        const t = towns.get(code);
        if (
          t?.players.some((p) => p.online) &&
          published.get(code) !== stamp(t)
        )
          broadcast(t);
      }),
    );
  } finally {
    simulationClock.end();
  }
}, 100);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if ((ws as any).alive === false) {
      ws.terminate();
      continue;
    }
    (ws as any).alive = false;
    ws.ping();
  }
}, 30000);
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  clearInterval(heartbeat);
  server.close();
  for (const ws of wss.clients)
    ws.close(1012, "Server restarting; recover your seat.");
  try {
    await service.close();
    process.exit(0);
  } catch {
    console.error("Shutdown save failed.");
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
server.listen(port, "0.0.0.0", () =>
  console.log(`OUR BLOCK http://localhost:${port}`),
);
