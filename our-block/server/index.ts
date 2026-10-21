import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { openStore } from "./storage.ts";
import { TownService } from "./towns.ts";
import { WebSocketServer, WebSocket } from "ws";
import {
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
const prod = process.argv.includes("--production");
const vite = prod
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" });
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, protocol: 1, towns: towns.size }));
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
      return !origin || new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  },
});
const clients = new Map<WebSocket, { code: string; id: string }>();
function send(ws: WebSocket, x: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(x));
}
function broadcast(t: Town) {
  for (const [ws, c] of clients)
    if (c.code === t.code)
      send(ws, { type: "state", state: snapshot(t, c.id) });
}
wss.on("connection", (ws) => {
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
      send(ws, { type: "error", message: "Please slow down." });
      return;
    }
    incoming = incoming
      .then(async () => {
        let m: any;
        try {
          m = JSON.parse(raw.toString());
          if (!m || typeof m !== "object") throw Error("Invalid message.");
          if (m.type === "join") {
            if (joinedOrJoining) throw Error("Already joined.");
            joinedOrJoining = true;
            let code = String(m.code || "").toUpperCase();
            if (!code) {
              if (towns.size >= 500) throw Error("Town capacity reached.");
              do {
                code = randomBytes(3).toString("hex").toUpperCase();
              } while (towns.has(code));
            }
            await service.run(code, async () => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const existing = towns.get(code);
              if (m.code && !existing)
                throw Error("Town not found. Check your invitation.");
              const t = existing
                ? structuredClone(existing)
                : createTown(code, m.mode === "explore" ? "explore" : "life");
              let p = t.players.find((x) => x.token === m.token);
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
            });
            return;
          }
          const c = clients.get(ws);
          if (!c) throw Error("Join first.");
          const result = await service.action(c.code, c.id, m);
          send(ws, { type: "result", id: m.id, message: result.message });
          broadcast(result.town);
        } catch (e) {
          const message = (e as Error).message;
          const publicError =
            /^(STALE:|Already |Town |Seat |Invalid |Join |Unsupported |Walk |Choose |You |Not |No |A |The |This |Your |Their |Meet |Review |Rent |Contact |Resolve |Stay |Unknown |Accept |Renegotiate |Inspect |Check |All |One |Backpack |Shared |Please |Server )/.test(
              message,
            );
          send(ws, {
            type: "error",
            id: m?.id,
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
let last = Date.now(),
  saveAt = 0,
  running = false;
const timer = setInterval(async () => {
  const now = Date.now(),
    dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  if (running || shuttingDown) return;
  running = true;
  const flush = now - saveAt >= 2000;
  if (flush) saveAt = now;
  try {
    await Promise.all(
      [...towns.keys()].map(async (code) => {
        try {
          await service.advance(code, dt, flush);
        } catch {
          console.error("Periodic save delayed; will retry.");
        }
        const t = towns.get(code)!;
        if (t.players.some((p) => p.online)) broadcast(t);
      }),
    );
  } finally {
    running = false;
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
