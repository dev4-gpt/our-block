import { botStep } from "./bot.ts";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { WebSocketServer, WebSocket } from "ws";
import {
  act,
  replaceMissingWithBot,
  createRoom,
  project,
  tick,
  route,
  locked,
  BRANCHES,
  SHELTER,
  type Room,
  type Seat,
  type Action,
  type Branch,
} from "../shared/game.ts";
const port = Number(process.env.PORT || 3000),
  dir = process.env.DATA_DIR || "data";
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(resolve(dir, "last-light.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL)",
);
const rooms = new Map<string, Room>();
for (const row of db
  .prepare("SELECT state FROM rooms WHERE updated > ?")
  .all(Date.now() - 86400000)) {
  try {
    const r = JSON.parse(String(row.state)) as Room;
    r.mission ??= 0;
    r.seats.forEach((s) => (s.connected = s.bot));
    if (r.phase === "active" || r.phase === "paused") {
      r.phase = "paused";
      r.pauseAt = Date.now();
    }
    rooms.set(r.code, r);
  } catch {}
}
const save = (r: Room) =>
  db
    .prepare("INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)")
    .run(r.code, JSON.stringify(r), Date.now());
const dev =
  process.env.NODE_ENV !== "production" &&
  !process.argv.includes("--production");
const vite = dev
  ? await (
      await import("vite")
    ).createServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    })
  : null;
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400);
    res.end("Invalid URL");
    return;
  }
  const file = resolve("dist", "." + pathname);
  if (!file.startsWith(resolve("dist") + "/") && file !== resolve("dist")) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const p =
      existsSync(file) && extname(file) ? file : resolve("dist/index.html");
    res.setHeader(
      "Content-Type",
      (
        {
          html: "text/html",
          js: "application/javascript",
          css: "text/css",
          svg: "image/svg+xml",
          png: "image/png",
          txt: "text/plain; charset=utf-8",
        } as Record<string, string>
      )[extname(p).slice(1)] || "application/octet-stream",
    );
    res.end(readFileSync(p));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", (req, socket, head) => {
  if (req.url?.split("?")[0] !== "/socket") {
    if (!dev) socket.destroy();
    return;
  }
  try {
    if (
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    ) {
      socket.destroy();
      return;
    }
  } catch {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});
const clients = new Map<WebSocket, { room: Room; seat: Seat }>();
const limits = new Map<string, { n: number; t: number }>();
function broadcast(r: Room) {
  for (const [ws, c] of clients)
    if (c.room === r && ws.readyState === WebSocket.OPEN)
      ws.send(
        JSON.stringify({
          type: "state",
          state: project(r, c.seat, Date.now()),
        }),
      );
}
function resume(r: Room) {
  if (r.phase === "paused" && r.seats.every((s) => s.connected)) {
    r.phase = "active";
    r.lastTick = Date.now();
    r.vans.forEach((v) => (v.nextAt = Date.now() + 230));
  }
}
function addBot(r: Room) {
  if (r.seats.length < 2)
    r.seats.push({
      token: randomUUID(),
      name: "EMBER · bot",
      role: r.seats[0].role === "gridkeeper" ? "pathfinder" : "gridkeeper",
      bot: true,
      connected: true,
    });
}
wss.on("connection", (ws, req) => {
  ws.on("error", () => ws.terminate());
  let count = 0,
    windowAt = Date.now();
  ws.on("message", (raw) => {
    try {
      if (Date.now() - windowAt > 1000) {
        windowAt = Date.now();
        count = 0;
      }
      if (++count > 20) throw Error("Too many actions. Slow down.");
      const m = JSON.parse(String(raw));
      let c = clients.get(ws);
      if (m.type === "join") {
        if (c) throw Error("Already joined.");
        const ip = req.socket.remoteAddress || "unknown";
        let rate = limits.get(ip);
        if (!rate || Date.now() - rate.t > 60000) {
          rate = { n: 0, t: Date.now() };
          limits.set(ip, rate);
        }
        if (++rate.n > 30)
          throw Error("Too many room requests. Try in a minute.");
        const name = String(m.name || "")
          .trim()
          .slice(0, 20);
        if (!name) throw Error("Enter a nickname.");
        let r: Room;
        if (m.create === true) {
          if (rooms.size >= 500) throw Error("Server is full. Try later.");
          let code = "";
          do {
            code = Array.from(
              randomBytes(4),
              (v) => "ABCDEFGHJKLMNPQRSTUVWXYZ"[v % 24],
            ).join("");
          } while (rooms.has(code));
          r = createRoom(code);
          rooms.set(code, r);
        } else {
          const found = rooms.get(String(m.code || "").toUpperCase());
          if (!found) throw Error("Room not found. Check the four letters.");
          r = found;
        }
        let seat =
          typeof m.token === "string"
            ? r.seats.find((s) => s.token === m.token && !s.bot)
            : undefined;
        if (seat) {
          for (const [other, entry] of clients)
            if (entry.seat === seat) {
              other.close(4001, "Seat resumed elsewhere");
              clients.delete(other);
            }
        } else {
          if (r.phase !== "lobby")
            throw Error(
              "Mission already started. Rejoin using your original browser.",
            );
          if (r.seats.length >= 2)
            throw Error("This room already has two players.");
          seat = {
            token: randomBytes(24).toString("hex"),
            name,
            role: r.seats.length
              ? r.seats[0].role === "gridkeeper"
                ? "pathfinder"
                : "gridkeeper"
              : "gridkeeper",
            bot: false,
            connected: true,
          };
          r.seats.push(seat);
        }
        seat.connected = true;
        clients.set(ws, { room: r, seat });
        resume(r);
        save(r);
        ws.send(
          JSON.stringify({
            type: "joined",
            code: r.code,
            token: seat.token,
            name: seat.name,
          }),
        );
        broadcast(r);
        return;
      }
      if (!c) throw Error("Join a room first.");
      const { room: r, seat } = c;
      if (m.type === "bot") {
        if (seat !== r.seats[0] && r.phase === "lobby")
          throw Error("Only the creator adds a bot.");
        if (r.phase === "lobby") {
          const missing = r.seats.find((s) => !s.connected);
          if (missing) {
            missing.bot = true;
            missing.name = "EMBER · bot";
            missing.token = randomUUID();
            missing.connected = true;
          } else addBot(r);
        } else if (r.phase === "paused" && Date.now() - r.pauseAt >= 60000) {
          replaceMissingWithBot(r, randomUUID(), Date.now());
        } else throw Error("Wait for the 60-second reconnect period.");
      } else if (m.type === "action")
        act(r, seat, m.action as Action, Date.now());
      else throw Error("Unknown message.");
      save(r);
      broadcast(r);
    } catch (e) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: e instanceof Error ? e.message : "Invalid request.",
        }),
      );
    }
  });
  ws.on("close", () => {
    const c = clients.get(ws);
    clients.delete(ws);
    if (!c) return;
    c.seat.connected = false;
    if (c.room.phase === "active") {
      c.room.phase = "paused";
      c.room.pauseAt = Date.now();
    }
    save(c.room);
    broadcast(c.room);
  });
});
let lastSave = 0;
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    tick(r, now);
    botStep(r, now);
    if (r.phase !== "lobby") broadcast(r);
    if (now - lastSave > 2000) save(r);
  }
  if (now - lastSave > 2000) lastSave = now;
  for (const [ip, v] of limits) if (now - v.t > 60000) limits.delete(ip);
}, 200);
server.listen(port, "0.0.0.0", () =>
  console.log(`LAST LIGHT listening on http://localhost:${port}`),
);
function shutdown() {
  for (const r of rooms.values()) save(r);
  db.close();
  server.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
