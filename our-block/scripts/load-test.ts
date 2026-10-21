/** Real protocol clients. Local default. Public tests require an explicit measured allowance. */
import { WebSocket } from "ws";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const local = !process.env.LOAD_URL,
  port = Number(process.env.LOAD_PORT || 3014),
  origin = process.env.LOAD_URL || `http://127.0.0.1:${port}`;
const stages = (process.env.LOAD_STAGES || "4,20,50,100")
    .split(",")
    .map(Number),
  duration = Number(process.env.LOAD_SECONDS || 300);
if (
  stages.some((n) => ![4, 20, 50, 100].includes(n)) ||
  !Number.isFinite(duration) ||
  duration < 5 ||
  duration > 3600
)
  throw Error("Invalid stage or duration.");
const remaining = Number(process.env.LOAD_REMAINING_BYTES || 0),
  budget = Math.min(
    1e9,
    local ? Number(process.env.LOAD_BUDGET_BYTES || 1e9) : remaining * 0.1,
  );
if (
  !local &&
  (!process.argv.includes("--public") ||
    !origin.startsWith("https://") ||
    budget <= 0)
)
  throw Error(
    "Public runs require --public, HTTPS and LOAD_REMAINING_BYTES from current provider allowance.",
  );
const sparse = process.env.LOAD_SPARSE === "1";
if (sparse && (!local || stages.join(",") !== "4"))
  throw Error("Sparse soak is local-only with four clients.");
if (sparse && budget < 20000000)
  throw Error("Sparse soak forecast requires at least 20 MB remaining budget.");
let bytes = 0,
  proc: ChildProcess | undefined,
  temporary: string | undefined,
  aborted: string | undefined;
process.on("SIGINT", () => {
  aborted = "Interrupted by operator; partial run retained.";
});
process.on("SIGTERM", () => {
  aborted = "Stopped by operator; partial run retained.";
});
const peers: Peer[] = [],
  groups: Peer[][] = [],
  reports: any[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function percentile(a: number[], p = 0.95) {
  return a.length
    ? [...a].sort((a, b) => a - b)[
        Math.min(a.length - 1, Math.floor(a.length * p))
      ]
    : 0;
}
function check() {
  if (aborted) throw Error(aborted);
  if (bytes > budget) throw Error("Traffic budget exceeded.");
}
async function until(test: () => any, label: string, ms = 12000) {
  const start = Date.now();
  while (!test()) {
    check();
    if (Date.now() - start > ms) throw Error("Timeout: " + label);
    await sleep(10);
  }
}
let ack: number[] = [],
  delivery: number[] = [],
  actions = 0,
  errors = 0,
  peakRss = 0;
class Peer {
  ws?: WebSocket;
  state: any;
  seat: any;
  seq = 0;
  responses = new Map<string, any>();
  sent = new Map<string, number>();
  async connect(code = "") {
    this.state = undefined;
    this.ws = new WebSocket(origin.replace(/^http/, "ws") + "/ws");
    this.ws.on("error", () => {});
    this.ws.on("message", (data) => {
      bytes += Buffer.byteLength(String(data));
      const m = JSON.parse(String(data));
      if (m.type === "joined") this.seat = m;
      if (m.type === "state") {
        if (m.state.code !== this.seat?.code) {
          aborted = "Cross-town disclosure";
          return;
        }
        if (m.state.players.some((p: any) => p.token) || m.state.processed) {
          aborted = "Private payload disclosure";
          return;
        }
        this.state = m.state;
      }
      if (m.type === "result" || m.type === "error") {
        this.responses.set(m.id, m);
        if (this.sent.has(m.id)) {
          ack.push(Date.now() - this.sent.get(m.id)!);
          if (m.type === "error") {
            errors++;
            aborted = "Unexpected rule/storage error: " + m.message;
          }
        }
      }
    });
    await until(() => this.ws!.readyState === 1, "socket");
    this.send({
      type: "join",
      ...(this.seat
        ? { code: this.seat.code, token: this.seat.token }
        : { code, name: "Load resident", mode: "explore" }),
    });
    await until(() => this.state, "join");
  }
  send(m: any) {
    const s = JSON.stringify(m);
    bytes += Buffer.byteLength(s);
    this.ws!.send(s);
  }
  async act(type: string, extra: any = {}, same?: any) {
    const group = groups.find((g) => g.includes(this));
    if (group)
      await until(
        () =>
          this.state.revision >=
          Math.max(...group.map((p) => p.state?.revision || 0)),
        "teammate state propagation",
      );
    const c = same || {
      v: 1,
      id: `load-${++this.seq}`,
      revision: this.state.revision,
      type,
      ...extra,
    };
    this.sent.set(c.id, Date.now());
    this.responses.delete(c.id);
    actions++;
    this.send(c);
    await until(() => this.responses.has(c.id), "ack " + type);
    const r = this.responses.get(c.id),
      received = Date.now();
    if (r.type === "error") throw Error(r.message);
    await until(
      () =>
        this.state.revision >= (r.revision ?? 0) &&
        this.state.movementSequence >= (r.movementSequence ?? 0),
      "full state",
    );
    delivery.push(Date.now() - received);
    this.sent.delete(c.id);
    return c;
  }
  async close() {
    const ws = this.ws;
    if (!ws || ws.readyState === 3) return;
    await new Promise<void>((r) => {
      ws.once("close", () => r());
      ws.close();
    });
  }
}
try {
  if (local) {
    temporary = mkdtempSync(join(tmpdir(), "block-load-"));
    proc = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts", "--production"],
      {
        env: {
          ...process.env,
          PORT: String(port),
          DATA_DIR: temporary,
          DATABASE_URL: "",
          MAX_PLAYERS: "100",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Server startup timeout")),
        10000,
      );
      proc!.stdout!.on("data", (d) => {
        if (String(d).includes("OUR BLOCK")) {
          clearTimeout(timer);
          resolve();
        }
      });
      proc!.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Server exited"));
      });
    });
  }
  for (const count of stages) {
    // Conservative forecast uses full snapshots, then actual bytes enforce the hard cap.
    const forecast = count * duration * 10 * 18000;
    if (!local && bytes + forecast > budget)
      throw Error(
        `Forecast ${forecast} bytes exceeds remaining test traffic budget; stage refused.`,
      );
    for (let i = peers.length; i < count; i++) {
      const p = new Peer();
      peers.push(p);
      if (i % 4 === 0) groups.push([]);
      const group = groups[Math.floor(i / 4)];
      await p.connect(group[0]?.seat.code || "");
      group.push(p);
    }
    await sleep(200);
    ack = [];
    delivery = [];
    actions = errors = peakRss = 0;
    let round = 0;
    const started = Date.now(),
      before = bytes;
    let memorySince = 0,
      badSince = 0;
    while (Date.now() - started < duration * 1000) {
      check();
      await Promise.all(
        groups
          .filter((g) => peers.indexOf(g[0]) < count)
          .map(async (g) => {
            // Each town serializes economic choices while all towns act in parallel.
            for (const p of g) {
              await p.act("move", { x: -15 + (round % 2), z: -9 });
            }
            if (round === 0)
              for (const p of g)
                if (
                  !p.state.players
                    .find((x: any) => x.id === p.seat.id)
                    .daily.includes("maintain")
                )
                  await p.act("activity", { target: "maintain" });
            const buyer = g[0];
            if (round % 3 === 0) {
              await buyer.act("upgrade", { target: "storage" }).catch((e) => {
                throw e;
              });
              const q = buyer.state.pending.find(
                (x: any) => x.by === buyer.seat.id,
              );
              if (!q) throw Error("Missing approval");
              await g[1].act("decline", { target: q.id });
            }
            if (round === 1) {
              for (const p of [g[0], g[1]])
                await p.act("move", { x: 0, z: -9 });
              await until(
                () =>
                  [g[0], g[1]].every((p) => {
                    const a = p.state.players.find(
                      (x: any) => x.id === p.seat.id,
                    );
                    return !a.target && Math.hypot(a.x, a.z + 9) < 1;
                  }),
                "market walk",
              );
              const before = g[0].state.funds;
              await g[0].act("buy", { target: "connector" });
              await g[1].act("approve", { target: g[0].state.pending[0].id });
              await until(
                () => g[0].state.funds === before - 18,
                "purchase broadcast",
              );
              await g[0].act("refund", { target: "connector" });
              if (g[0].state.funds !== before)
                throw Error("Purchase/refund balance mismatch");
              for (const p of [g[0], g[1]])
                await p.act("move", { x: -15, z: -9 });
              await until(
                () =>
                  [g[0], g[1]].every((p) => {
                    const a = p.state.players.find(
                      (x: any) => x.id === p.seat.id,
                    );
                    return !a.target && Math.hypot(a.x + 15, a.z + 9) < 1;
                  }),
                "home walk",
              );
              const c = await buyer.act("deposit", { qty: 1 });
              const funds = buyer.state.funds;
              const again = await buyer.act("deposit", {}, c);
              if (
                !buyer.responses.get(again.id).duplicate ||
                buyer.state.funds !== funds
              )
                throw Error("Duplicate economic effect");
            }
          }),
      );
      if (round === 2)
        for (const g of groups) {
          const p = g.at(-1)!;
          await p.close();
          await p.connect();
        }
      const h = (await (await fetch(origin + "/health")).json()) as any;
      peakRss = Math.max(peakRss, h.rss || 0);
      if (h.rss > 400 * 1024 * 1024) {
        memorySince ||= Date.now();
        if (Date.now() - memorySince > 10000)
          throw Error("Memory above 400 MiB for 10 seconds");
      } else memorySince = 0;
      if (
        percentile(ack) > 1000 ||
        percentile(delivery) > 500 ||
        errors / Math.max(1, actions) >= 0.01
      ) {
        badSince ||= Date.now();
        if (Date.now() - badSince > 60000)
          throw Error("Sustained latency/error failure");
      } else badSince = 0;
      round++;
      const wake = Math.min(
        started + duration * 1000,
        sparse ? started + round * 300000 : Date.now() + 3000,
      );
      while (Date.now() < wake) {
        await sleep(Math.min(5000, wake - Date.now()));
        check();
        if (sparse) {
          const health = await fetch(origin + "/health");
          const raw = await health.text();
          bytes += Buffer.byteLength(raw);
          const sample = JSON.parse(raw);
          peakRss = Math.max(peakRss, sample.rss || 0);
          if (sample.rss > 400 * 1024 * 1024) {
            memorySince ||= Date.now();
            if (Date.now() - memorySince >= 10000)
              throw Error("Memory above 400 MiB for 10 seconds");
          } else memorySince = 0;
          if (!sample.ok || sample.online !== 4)
            throw Error("Soak readiness or resident count failed");
        }
      }
    }
    const report = {
      clients: count,
      towns: groups.length,
      seconds: Math.round((Date.now() - started) / 1000),
      actions,
      ackP95ms: percentile(ack),
      postAckStateP95ms: percentile(delivery),
      unexpectedErrors: errors,
      bytes: bytes - before,
      peakServerRssMiB: Math.round(peakRss / 1048576),
      pass: percentile(ack) < 1000 && percentile(delivery) < 500 && !errors,
    };
    reports.push(report);
    console.log(JSON.stringify(report));
    if (!report.pass) throw Error("Stage failed.");
  }
} catch (e) {
  aborted = (e as Error).message;
  process.exitCode = 1;
  console.error("Load run stopped:", aborted);
} finally {
  for (const p of peers) await p.close();
  if (proc && !proc.killed)
    await new Promise<void>((resolve) => {
      proc!.once("exit", () => resolve());
      proc!.kill("SIGTERM");
    });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
  const dir = process.env.LOAD_REPORT_DIR || "docs/evidence";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `load-${Date.now()}.json`),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        scope: local ? "local SQLite rehearsal" : "public service",
        origin,
        budget,
        sparse,
        forecastBytes: sparse ? 20000000 : undefined,
        sourceRef:
          process.env.MEASUREMENT_REF ||
          "working candidate; record commit separately",
        totalBytes: bytes,
        aborted,
        reports,
        limitations: [
          "Synthetic clients; not physical-device or unfamiliar-player evidence.",
          "State metric is delay after acknowledgment until matching full snapshot, not synchronized one-way latency.",
          "No production capacity increase is authorized by this report alone.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}
