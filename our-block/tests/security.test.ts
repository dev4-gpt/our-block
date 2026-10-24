import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { WebSocket } from "ws";
import { AdmissionGate } from "../server/security.ts";

test("pending admissions have independent global and transport-source limits", () => {
  const gate = new AdmissionGate(3, 2);
  const a = {},
    b = {},
    c = {},
    d = {};
  assert(gate.reserve(a, "a"));
  assert(gate.reserve(b, "a"));
  assert(!gate.reserve(c, "a"));
  assert(gate.reserve(c, "b"));
  assert(!gate.reserve(d, "c"));
  gate.release(a);
  gate.release(a);
  assert(gate.reserve(d, "a"));
});

test(
  "production headers, private metrics, admission expiry and recovery",
  {
    skip: process.env.NETWORK_TEST !== "1",
    timeout: 20000,
  },
  async () => {
    const data = mkdtempSync("/tmp/our-block-security-test-");
    const token = "a".repeat(64);
    const proc = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts", "--production"],
      {
        env: {
          ...process.env,
          PORT: "3018",
          MAX_PLAYERS: "4",
          DATA_DIR: data,
          DATABASE_URL: "",
          METRICS_TOKEN: token,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const sockets: WebSocket[] = [];
    const connect = (origin?: string) =>
      new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(
          "ws://127.0.0.1:3018/ws",
          origin ? { origin } : {},
        );
        sockets.push(ws);
        ws.once("open", () => resolve(ws));
        ws.on("error", reject);
      });
    const join = async (payload: object) => {
      const ws = await connect("http://127.0.0.1:3018");
      const joined = new Promise<any>((resolve, reject) => {
        ws.on("message", (raw) => {
          const m = JSON.parse(String(raw));
          if (m.type === "joined") resolve(m);
          if (m.type === "error") reject(Error(m.message));
        });
      });
      ws.send(JSON.stringify({ type: "join", ...payload }));
      return { ws, seat: await joined };
    };
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Server startup timeout")),
          5000,
        );
        proc.stdout.on("data", (d) => {
          if (String(d).includes("OUR BLOCK")) {
            clearTimeout(timer);
            resolve();
          }
        });
        proc.once("exit", () => {
          clearTimeout(timer);
          reject(Error("Server exited"));
        });
      });
      for (const path of [
        "/",
        "/support.html",
        "/privacy.txt",
        "/health",
        "/metrics",
      ]) {
        const res = await fetch(`http://127.0.0.1:3018${path}`);
        const csp = res.headers.get("content-security-policy")!;
        assert.match(csp, /script-src 'self';/);
        assert.match(csp, /connect-src 'self' wss:\/\/127\.0\.0\.1:3018;/);
        assert.match(
          csp,
          /frame-ancestors 'self' https:\/\/app.joinhandshake.com https:\/\/ai.joinhandshake.com/,
        );
        assert.equal(res.headers.get("x-content-type-options"), "nosniff");
        assert.equal(res.headers.get("referrer-policy"), "no-referrer");
        assert.match(
          res.headers.get("strict-transport-security")!,
          /max-age=31536000/,
        );
        if (path === "/health") {
          const health = await res.json();
          assert.equal(health.ok, true);
          for (const key of [
            "rss",
            "outgoingBytes",
            "towns",
            "online",
            "capacity",
          ])
            assert(!Object.hasOwn(health, key));
        } else if (path === "/metrics") assert.equal(res.status, 404);
        if (!res.bodyUsed) await res.body?.cancel();
      }
      const denied = await fetch("http://127.0.0.1:3018/metrics", {
        headers: { Authorization: "Bearer " + "b".repeat(64) },
      });
      assert.equal(denied.status, 404);
      await denied.body?.cancel();
      const metrics = await fetch("http://127.0.0.1:3018/metrics", {
        headers: { Authorization: "Bearer " + token },
      });
      assert((await metrics.json()).rss > 0);
      await assert.rejects(connect("https://unrelated.example"), /401/);
      const resident = await join({ name: "Resident" });
      const idle = await Promise.all(
        Array.from({ length: 4 }, () => connect()),
      );
      await assert.rejects(connect(), /401/);
      await Promise.all(
        idle.map(
          (ws) =>
            new Promise<void>((resolve) => ws.once("close", () => resolve())),
        ),
      );
      assert.equal(resident.ws.readyState, WebSocket.OPEN);
      // A failed admission closes promptly instead of retaining its slot.
      const invalid = await connect();
      const closed = new Promise((resolve) => invalid.once("close", resolve));
      invalid.send(JSON.stringify({ type: "join", code: "bad" }));
      await closed;
      const recovered = await join({
        code: resident.seat.code,
        token: resident.seat.token,
      });
      assert.equal(recovered.seat.id, resident.seat.id);
      assert.equal(recovered.seat.token, resident.seat.token);
    } finally {
      for (const ws of sockets) ws.terminate();
      await new Promise<void>((resolve) => {
        if (proc.exitCode !== null) resolve();
        else {
          proc.once("exit", () => resolve());
          proc.kill("SIGTERM");
        }
      });
      rmSync(data, { recursive: true, force: true });
    }
  },
);
