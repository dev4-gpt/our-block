/** Local-only two-client protocol regression. Does not certify browser/device usability. */
import { WebSocket } from "ws";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { SQLiteStore } from "../server/storage.ts";
import { createTown, join as joinResident } from "../shared/game.ts";
import { districts } from "../shared/content.ts";
const directory = mkdtempSync(join(tmpdir(), "block-journey-"));
const port = 3020,
  origin = `http://127.0.0.1:${port}`;
const eveningOnly = process.env.JOURNEY_PHASE === "evening";
if (eveningOnly) {
  const seeded = createTown("EVE123", "explore");
  joinResident(seeded, "Builder", "fixture-builder");
  joinResident(seeded, "Verifier", "fixture-verifier");
  for (const p of seeded.players) {
    p.online = false;
    p.x = 15;
    p.z = 15;
  }
  seeded.contracts.garden = { due: 4, status: "complete", variant: 0 };
  seeded.contracts.market = { due: 4, status: "complete", variant: 0 };
  seeded.players[0].bag = { seed: 1, pack: 1 };
  seeded.funds = 384;
  const store = new SQLiteStore(join(directory, "our-block.sqlite"));
  await store.save(seeded);
  await store.close();
}
const proc = spawn(
  process.execPath,
  ["--import", "tsx", "server/index.ts", "--production"],
  {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: directory,
      DATABASE_URL: "",
      MAX_PLAYERS: "4",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const started = Date.now();
let bytes = 0,
  sequence = 0;
const peers: Peer[] = [];
const observations: string[] = [];
async function until(predicate: () => boolean, label: string, timeout = 30000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw Error("Timed out: " + label);
    if (bytes > 8000000) throw Error("Journey traffic cap exceeded");
    await new Promise((r) => setTimeout(r, 30));
  }
}
class Peer {
  ws?: WebSocket;
  state: any;
  seat: any;
  responses = new Map<string, any>();
  error?: string;
  constructor() {
    peers.push(this);
  }
  async connect(code?: string, token?: string) {
    this.state = undefined;
    this.error = undefined;
    const ws = new WebSocket(origin.replace("http", "ws") + "/ws");
    this.ws = ws;
    ws.on("error", () => {});
    ws.on("message", (data) => {
      bytes += Buffer.byteLength(String(data));
      const m = JSON.parse(String(data));
      if (m.type === "joined") this.seat = m;
      if (m.type === "state") {
        assert.equal(m.state.code, this.seat?.code);
        assert(!m.state.lots);
        assert(m.state.players.every((p: any) => !p.token));
        this.state = m.state;
      }
      if (m.type === "error" && !m.id) this.error = m.message;
      if ((m.type === "result" || m.type === "error") && m.id)
        this.responses.set(m.id, m);
    });
    await until(() => ws.readyState === 1, "socket");
    const message = JSON.stringify({
      type: "join",
      code,
      token,
      name: peers.indexOf(this) ? "Verifier" : "Builder",
      mode: "explore",
    });
    bytes += Buffer.byteLength(message);
    ws.send(message);
    await until(() => !!this.state || !!this.error, "join");
    if (this.error) throw Error(this.error);
  }
  async act(type: string, extra: any = {}) {
    await until(
      () =>
        peers.every((p) => !p.state || p.state.revision <= this.state.revision),
      "latest revision",
    );
    const id = "journey-" + ++sequence;
    const command = { v: 1, id, revision: this.state.revision, type, ...extra };
    const message = JSON.stringify(command);
    bytes += Buffer.byteLength(message);
    this.ws!.send(message);
    await until(() => this.responses.has(id), "result " + type);
    const result = this.responses.get(id);
    if (result.type === "error")
      throw Error(result.code + ": " + result.message);
    await until(
      () =>
        this.state.revision >= result.revision &&
        this.state.movementSequence >= result.movementSequence,
      "state " + type,
    );
    return command;
  }
  async walk(id: string) {
    const d = districts.find((d) => d.id === id)!;
    await this.act("move", { x: d.x, z: d.z + 3 });
    await until(() => {
      const p = this.state.players.find((p: any) => p.id === this.seat.id);
      return !p.target && Math.hypot(p.x - d.x, p.z - d.z - 3) < 1;
    }, "arrival " + id);
  }
  async close() {
    if (!this.ws || this.ws.readyState === 3) return;
    await new Promise<void>((resolve) => {
      this.ws!.once("close", () => resolve());
      this.ws!.close();
    });
  }
}
let failure: string | undefined;
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Startup timeout")), 10000);
    proc.stdout!.on("data", (d) => {
      if (String(d).includes("OUR BLOCK")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.once("exit", () => reject(Error("Server exited")));
  });
  const a = new Peer(),
    b = new Peer();
  await a.connect(
    eveningOnly ? "EVE123" : undefined,
    eveningOnly ? "fixture-builder" : undefined,
  );
  await b.connect(a.seat.code, eveningOnly ? "fixture-verifier" : undefined);
  await until(() => a.state.players.length === 2, "teammate");
  async function buy(target: string, kind = "buy") {
    await a.act(kind, { target, account: "shared" });
    const q = a.state.pending.find((q: any) => q.by === a.seat.id);
    assert(q);
    const funds = a.state.funds;
    await b.act("approve", { target: q.id });
    await until(() => a.state.funds === funds - q.cost, "approved funds");
    assert.equal(a.state.funds, b.state.funds);
  }
  const originalSeat = { ...a.seat };
  if (!eveningOnly) {
    await a.walk("market");
    await a.act("buy", { target: "connector" });
    assert.equal(a.state.funds, 300);

    await a.close();
    a.state = undefined;
    await until(
      () => b.state.pending.length === 0,
      "disconnect cancels request",
    );
    await a.connect(originalSeat.code, originalSeat.token);
    assert.equal(a.state.funds, 300);
    observations.push(
      "Interrupted purchase canceled without spending; saved requester recovered.",
    );
    await a.walk("garden");
    await a.act("accept", { target: "garden" });
    await b.walk("garden");
    await b.act("activity", { target: "inspect" });
    await a.walk("workshop");
    await a.act("activity", { target: "diagnose" });
    await a.walk("market");
    await a.act("activity", { target: "compare" });
    await buy("connector");
    await a.walk("garden");
    await a.act("fit", { item: "connector" });
    await b.act("test");
    await a.act("complete", { target: "garden" });
    assert.equal(a.state.funds, 337);
    assert.equal(a.state.outcomes[0].spending, 18);
    assert.equal(Object.keys(a.state.projectWork.garden).length, 2);
    observations.push(
      "Garden completed by two contributing residents; 300 - 18 + 55 = 337.",
    );
    await a.walk("market");
    await a.act("accept", { target: "market" });
    await buy("seed");
    await buy("pack");
    await a.walk("home");
    await a.act("activity", { target: "plan" });
    await a.walk("garden");
    await a.act("activity", { target: "water" });
    await until(
      () => a.state.crops.some((c: any) => c.ready <= a.state.simTime),
      "growth",
      40000,
    );
    await a.act("activity", { target: "harvest" });
    await a.walk("depot");
    await b.walk("depot");
    await b.act("activity", { target: "route" });
    await a.act("activity", { target: "pack" });
    await a.walk("market");
    await a.act("complete", { target: "market" });
    assert.equal(a.state.contracts.market.status, "complete");
    observations.push(
      "Market completed through growing, paper packing, independent order inspection and delivery.",
    );
  } else {
    observations.push(
      "Evening-only fixture: completed garden/market, 384 credits and one seed/pack seeded; no browser journey claimed.",
    );
    await b.walk("depot");
  }
  await a.walk("hall");
  await a.act("accept", { target: "evening" });
  await a.act("activity", { target: "terms" });
  await buy("lamp");
  await a.walk("workshop");
  await buy("filter");
  await a.act("activity", { target: "repair" });
  await a.walk("garden");
  await buy("irrigation", "upgrade");
  await a.act("activity", { target: "water" });
  await until(
    () => a.state.crops.some((c: any) => c.ready <= a.state.simTime),
    "second growth",
    40000,
  );
  await a.act("activity", { target: "harvest" });
  await a.walk("depot");
  await b.act("activity", { target: "trace" });
  await a.act("activity", { target: "pack" });
  await a.walk("hall");
  await a.act("complete", { target: "evening" });
  assert(
    Object.values(a.state.contracts).every((c: any) => c.status === "complete"),
  );
  assert.equal(a.state.outcomes.length, eveningOnly ? 1 : 3);
  const funds = a.state.funds;
  assert.equal(funds, b.state.funds);
  observations.push(
    "Evening completed through repaired furniture, hired lighting, packed food and independent payment verification.",
  );
  await a.close();
  a.state = undefined;
  await a.connect(originalSeat.code, originalSeat.token);
  assert.equal(a.state.funds, funds);
  assert.equal(a.state.outcomes.length, eveningOnly ? 1 : 3);
  observations.push(
    "Refresh-equivalent seat recovery retained three completions and matching funds.",
  );
} catch (error) {
  failure = (error as Error).message;
  process.exitCode = 1;
} finally {
  for (const p of peers) await p.close();
  if (!proc.killed)
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill("SIGTERM");
    });
  rmSync(directory, { recursive: true, force: true });
  const report = {
    date: new Date().toISOString(),
    scope: "two local protocol clients, isolated SQLite production server",
    eveningOnly,
    sourceRef: process.env.MEASUREMENT_REF || "record source separately",
    seconds: Math.round((Date.now() - started) / 1000),
    bytes,
    pass: !failure,
    failure,
    observations,
    limitations: [
      "Not browser UI or physical-device evidence.",
      "No unfamiliar participants; does not measure learning or usability.",
    ],
  };
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    `docs/evidence/journey-${Date.now()}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
