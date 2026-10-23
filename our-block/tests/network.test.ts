import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
const enabled = process.env.NETWORK_TEST === "1";
test(
  "four real sockets, room isolation, seat recovery and process restart",
  { skip: !enabled, timeout: 20000 },
  async () => {
    const data = mkdtempSync(join(tmpdir(), "our-block-test-"));
    let proc: ChildProcess;
    const sockets: WebSocket[] = [];
    async function start() {
      proc = spawn(
        process.execPath,
        ["--import", "tsx", "server/index.ts", "--production"],
        {
          env: {
            ...process.env,
            PORT: "3012",
            MAX_PLAYERS: "8",
            DATA_DIR: data,
            DATABASE_URL: process.env.TEST_DATABASE_URL || "",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(Error("Server startup timeout")),
          5000,
        );
        proc.stdout!.on("data", (d) => {
          if (String(d).includes("OUR BLOCK")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        proc.once("exit", () => {
          clearTimeout(timeout);
          reject(Error("Server exited"));
        });
      });
    }
    async function stop() {
      await new Promise<void>((resolve) => {
        proc.once("exit", () => resolve());
        proc.kill("SIGTERM");
      });
    }
    async function client(payload: any) {
      const ws = new WebSocket("ws://127.0.0.1:3012/ws");
      sockets.push(ws);
      const messages: any[] = [];
      ws.on("message", (d) => messages.push(JSON.parse(String(d))));
      await new Promise((r) => ws.once("open", r));
      ws.send(JSON.stringify({ type: "join", ...payload }));
      const wait = async (pred: (m: any) => boolean) => {
        for (let i = 0; i < 200; i++) {
          const index = messages.findIndex(pred);
          if (index >= 0) return messages.splice(index, 1)[0];
          await new Promise((r) => setTimeout(r, 10));
        }
        throw Error("Message timeout");
      };
      return { ws, wait, messages };
    }
    try {
      await start();
      const health = await fetch("http://127.0.0.1:3012/health");
      assert.equal(health.status, 200);
      assert.equal(health.headers.get("cache-control"), "no-store");
      assert.match((await health.json()).release, /^\d{4}\.\d{2}\.\d{2}-rc\d+$/);
      const support = await fetch("http://127.0.0.1:3012/support.html");
      assert.match(support.headers.get("content-type") || "", /^text\/html/);
      assert.equal(support.headers.get("cache-control"), "no-store");
      assert.match(await support.text(), /profiles\/r9qfrx/);
      const a = await client({ name: "A" }),
        seat = await a.wait((m) => m.type === "joined");
      const b = await client({ name: "B", code: seat.code });
      await b.wait((m) => m.type === "joined");
      const c = await client({ name: "C", code: seat.code });
      await c.wait((m) => m.type === "joined");
      const d = await client({ name: "D", code: seat.code });
      await d.wait((m) => m.type === "joined");
      const full = await a.wait(
        (m) => m.type === "state" && m.state.players.length === 4,
      );
      assert(!JSON.stringify(full.state).includes(seat.token));
      a.ws.send(
        JSON.stringify({
          v: 1,
          id: "work",
          revision: full.state.revision,
          type: "activity",
          target: "maintain",
        }),
      );
      await a.wait((m) => m.type === "result" && m.id === "work");
      const earned = await a.wait(
        (m) => m.type === "state" && m.state.players[0].money === 8,
      );
      a.ws.send(
        JSON.stringify({
          v: 1,
          id: "deposit",
          revision: earned.state.revision,
          type: "deposit",
          qty: 8,
        }),
      );
      await a.wait((m) => m.type === "result" && m.id === "deposit");
      await a.wait((m) => m.type === "state" && m.state.funds === 308);

      // A second socket sees both the route immediately and intermediate movement,
      // rather than seeing only the final destination.
      a.ws.send(JSON.stringify({ v: 1, id: "walk-sync", revision: earned.state.revision,
        type: "move", x: -5, z: -7 }));
      await a.wait((m) => m.type === "result" && m.id === "walk-sync");
      const routeView = await b.wait((m) => m.type === "state" && m.state.players[0].target);
      assert.equal(routeView.state.players.filter((p: any) => p.online).length, 4);
      const progress = await b.wait((m) => m.type === "state" && m.state.players[0].x > -14);
      assert(progress.state.players[0].x < -5);

      const fifth = await client({ name: "Fifth", code: seat.code });
      assert.match(
        (await fifth.wait((m) => m.type === "error")).message,
        /four/,
      );
      const other = await client({ name: "Other" });
      const otherSeat = await other.wait((m) => m.type === "joined");
      assert.notEqual(otherSeat.code, seat.code);
      const view = await other.wait((m) => m.type === "state");
      assert.equal(view.state.players.length, 1);
      a.ws.close();
      await new Promise((r) => setTimeout(r, 50));
      const recovered = await client({ code: seat.code, token: seat.token });
      assert.equal(
        (await recovered.wait((m) => m.type === "joined")).id,
        seat.id,
      );
      await stop();
      await start();
      const restarted = await client({ code: seat.code, token: seat.token });
      await restarted.wait((m) => m.type === "joined");
      const state = (await restarted.wait((m) => m.type === "state")).state;
      assert.equal(state.players.length, 4);
      assert.equal(state.funds, 308);
      assert.equal(state.players[0].money, 0);
      assert.equal(state.players.filter((p: any) => p.online).length, 1);
    } finally {
      for (const ws of sockets) ws.close();
      if (proc! && !proc.killed) await stop();
      rmSync(data, { recursive: true, force: true });
    }
  },
);
