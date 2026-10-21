import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
// Live sockets and a real SQLite restart, run with npm run test:network.
test("rooms isolate private views, reject bad actions, reconnect seats and survive process restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "last-light-"));
  let child: ChildProcess | undefined;
  const sockets: WebSocket[] = [];
  const boot = async () => {
    child = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts", "--production"],
      {
        env: { ...process.env, PORT: "3011", DATA_DIR: dir },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Server startup timeout")),
        10000,
      );
      child!.stdout!.on("data", (d) => {
        if (String(d).includes("listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child!.on("exit", (code) => {
        if (code) {
          clearTimeout(timeout);
          reject(Error(`Server exited ${code}`));
        }
      });
    });
  };
  const stop = async () => {
    if (child && !child.killed) {
      const done = new Promise<void>((resolve) =>
        child!.once("exit", () => resolve()),
      );
      child.kill("SIGTERM");
      await done;
    }
  };
  const client = async () => {
    const ws = new WebSocket("ws://localhost:3011/socket");
    sockets.push(ws);
    const queue: any[] = [],
      waiters: { check: (m: any) => boolean; resolve: (m: any) => void }[] = [];
    ws.on("message", (raw) => {
      const m = JSON.parse(String(raw));
      const i = waiters.findIndex((w) => w.check(m));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
      else queue.push(m);
    });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    return {
      ws,
      send: (m: object) => ws.send(JSON.stringify(m)),
      wait: (check: (m: any) => boolean) =>
        new Promise<any>((resolve, reject) => {
          const i = queue.findIndex(check);
          if (i >= 0) return resolve(queue.splice(i, 1)[0]);
          const timeout = setTimeout(
            () => reject(Error("Message timeout")),
            6000,
          );
          waiters.push({
            check,
            resolve: (m) => {
              clearTimeout(timeout);
              resolve(m);
            },
          });
        }),
    };
  };
  try {
    await boot();
    const g = await client();
    g.send({ type: "join", create: true, name: "Grid" });
    const joined = await g.wait((m) => m.type === "joined");
    const p = await client();
    p.send({ type: "join", code: joined.code, name: "Path" });
    const pj = await p.wait((m) => m.type === "joined");
    const other = await client();
    other.send({ type: "join", create: true, name: "Other" });
    const oj = await other.wait((m) => m.type === "joined");
    assert.notEqual(oj.code, joined.code);
    g.send({
      type: "action",
      action: {
        id: "start",
        phase: "lobby",
        mission: 0,
        type: "start",
        calm: true,
      },
    });
    const gs = (
      await g.wait((m) => m.type === "state" && m.state.phase === "active")
    ).state;
    const ps = (
      await p.wait((m) => m.type === "state" && m.state.phase === "active")
    ).state;
    assert(!("groups" in gs));
    assert.equal(ps.groups.length, 6);
    assert(!JSON.stringify(gs).includes(pj.token));
    p.send({
      type: "action",
      action: {
        id: "bad",
        phase: "active",
        mission: 1,
        type: "power",
        branch: "bridge",
      },
    });
    assert.match(
      (await p.wait((m) => m.type === "error")).message,
      /Gridkeeper/,
    );
    g.send({
      type: "action",
      action: {
        id: "power",
        phase: "active",
        mission: 1,
        type: "power",
        branch: "bridge",
      },
    });
    await p.wait((m) => m.type === "state" && m.state.power.includes("bridge"));
    p.send({
      type: "action",
      action: {
        id: "dispatch",
        phase: "active",
        mission: 1,
        type: "dispatch",
        van: "01",
        target: "g0",
      },
    });
    await p.wait((m) => m.type === "state" && m.state.vans[0]?.moving);
    p.ws.close();
    await g.wait((m) => m.type === "state" && m.state.phase === "paused");
    const p2 = await client();
    p2.send({ type: "join", code: pj.code, name: "Path", token: pj.token });
    await p2.wait((m) => m.type === "joined");
    const restored = (
      await p2.wait((m) => m.type === "state" && m.state.phase === "active")
    ).state;
    assert.equal(restored.role, "pathfinder");
    assert(restored.vans[0].moving);
    g.send({
      type: "action",
      action: {
        id: "locked",
        phase: "active",
        mission: 1,
        type: "power",
        branch: "bridge",
      },
    });
    assert.match(
      (await g.wait((m) => m.type === "error")).message,
      /cooling|reserved/,
    );
    await stop();
    for (const ws of sockets) ws.close();
    await boot();
    const gr = await client();
    gr.send({
      type: "join",
      code: joined.code,
      name: "Grid",
      token: joined.token,
    });
    await gr.wait((m) => m.type === "joined");
    const paused = (await gr.wait((m) => m.type === "state")).state;
    assert.equal(paused.phase, "paused");
    assert(paused.power.includes("bridge"));
    const pr = await client();
    pr.send({ type: "join", code: pj.code, name: "Path", token: pj.token });
    await pr.wait((m) => m.type === "joined");
    const state = (
      await pr.wait((m) => m.type === "state" && m.state.phase === "active")
    ).state;
    assert.equal(state.groups.length, 6);
    assert.equal(state.vans[0].target, "g0");
  } finally {
    for (const ws of sockets) ws.close();
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
