import { WebSocket } from "ws";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const origin = process.argv[2];
if (!origin?.startsWith("https://"))
  throw Error("Provide an explicit HTTPS deployment URL. Creates a test town.");
const endpoint = origin.replace(/^https/, "wss").replace(/\/$/, "") + "/ws";
const peers: Peer[] = [];
class Peer {
  ws = new WebSocket(endpoint);
  state: any;
  seat: any;
  results = new Map<string, any>();
  errors: any[] = [];
  constructor() {
    this.ws.on("message", (data) => {
      const m = JSON.parse(String(data));
      if (m.type === "state") this.state = m.state;
      if (m.type === "joined") this.seat = m;
      if (m.type === "result") this.results.set(m.id, m);
      if (m.type === "error") this.errors.push(m);
    });
    this.ws.on("error", () => {});
    peers.push(this);
  }
  async wait(test: () => any, label: string, timeout = 45000) {
    const start = Date.now();
    while (!test()) {
      if (this.errors.length) throw Error(this.errors.shift().message);
      if (Date.now() - start > timeout) throw Error("Timed out: " + label);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  async join(code = "", token?: string) {
    await this.wait(() => this.ws.readyState === WebSocket.OPEN, "socket open");
    this.ws.send(
      JSON.stringify({
        type: "join",
        code,
        token,
        name: "Cloud test " + peers.length,
        mode: "explore",
      }),
    );
    await this.wait(() => this.seat && this.state, "join");
  }
  async act(type: string, extra: any = {}) {
    const id = crypto.randomUUID(),
      revision = this.state.revision;
    this.ws.send(JSON.stringify({ v: 1, id, revision, type, ...extra }));
    await this.wait(
      () =>
        this.results.has(id) &&
        this.state.revision >= (this.results.get(id).revision ?? revision + 1),
      "action " + type,
    );
  }
  async walk(x: number, z: number) {
    await this.act("move", { x, z });
    await this.wait(() => {
      const p = this.state.players.find((p: any) => p.id === this.seat.id);
      return p && !p.target && Math.hypot(p.x - x, p.z - z) < 1.1;
    }, "walking");
  }
}
try {
  if (process.argv.includes("--recover")) {
    const saved = JSON.parse(
      readFileSync("../backups/cloud-smoke-seats.json", "utf8"),
    );
    if (saved.origin !== origin) throw Error("Recovery origin mismatch.");
    const a = new Peer();
    await a.join(saved.code, saved.seats[0].token);
    if (a.state.funds !== 337 || a.state.contracts.garden.status !== "complete")
      throw Error("Persisted project did not recover.");
    console.log(
      "Saved seat, completed garden and 337 credits recovered after deployment.",
    );
  } else {
    const a = new Peer();
    await a.join();
    for (let i = 0; i < 3; i++) {
      const p = new Peer();
      await p.join(a.seat.code);
    }
    await a.wait(() => a.state.players.length === 4, "four residents");
    console.log("Four residents joined one public town.");
    await a.walk(-15, 15);
    await a.act("activity", { target: "inspect" });
    await a.act("accept", { target: "garden" });
    await a.walk(15, -9);
    await a.act("activity", { target: "diagnose" });
    await a.walk(0, -9);
    await a.act("activity", { target: "compare" });
    await a.act("buy", { target: "connector", account: "shared" });
    const b = peers[1];
    await b.wait(() => b.state.pending.length === 1, "purchase request");
    await b.act("approve", { target: b.state.pending[0].id });
    await a.wait(
      () => a.state.funds === 282 && a.state.players[0].bag.connector === 1,
      "approved purchase",
    );
    await a.walk(-15, 15);
    await a.act("fit", { item: "connector" });
    await a.act("test");
    await a.act("complete", { target: "garden" });
    if (a.state.funds !== 337 || a.state.contracts.garden.status !== "complete")
      throw Error("Project completion failed.");
    mkdirSync("../backups", { recursive: true });
    writeFileSync(
      "../backups/cloud-smoke-seats.json",
      JSON.stringify(
        { origin, code: a.seat.code, seats: peers.map((p) => p.seat) },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      "Garden repair complete with 337 credits. Private recovery data saved in ignored backups.",
    );
  }
} finally {
  for (const p of peers) p.ws.close();
}
