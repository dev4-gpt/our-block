import test from "node:test";
import assert from "node:assert/strict";
import { TownConnection } from "../src/connection.ts";
class Socket {
  readyState = 1;
  onopen: any = null;
  onmessage: any = null;
  onerror: any = null;
  onclose: any = null;
  sent: any[] = [];
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
  receive(m: any) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}
function setup() {
  const sockets: Socket[] = [],
    jobs: { fn: () => void; ms: number }[] = [],
    states: string[] = [];
  let uncertain = 0;
  const client = new TownConnection({
    url: "ws://test/ws",
    health: async () => {},
    socket: () => {
      const ws = new Socket();
      sockets.push(ws);
      return ws;
    },
    message: () => {},
    status: (text) => states.push(text),
    uncertain: () => {
      uncertain++;
    },
    schedule: (fn, ms) => {
      const job = { fn, ms };
      jobs.push(job);
      return job;
    },
    cancel: (job) => {
      const i = jobs.indexOf(job);
      if (i >= 0) jobs.splice(i, 1);
    },
  });
  return {
    client,
    sockets,
    jobs,
    states,
    get uncertain() {
      return uncertain;
    },
  };
}
const turn = () => new Promise((r) => setImmediate(r));
test("stalled moving snapshots recover the seat without replaying purchases", async () => {
  const s = setup();
  s.client.start({ code: "ABC", token: "seat" });
  await turn();
  const ws = s.sockets[0];
  ws.onopen({});
  ws.receive({ type: "joined", code: "ABC", token: "seat" });
  ws.receive({ type: "state", state: { players: [{ online: true, target: { x: 4, z: 2 } }] } });
  s.client.send({ id: "purchase", type: "buy" });
  const lateFrame = ws.onmessage;
  s.jobs.find((j) => j.ms === 5000)!.fn();
  assert.equal(ws.readyState, 3);
  assert.equal(s.uncertain, 1);
  assert(!s.client.send({ id: "late", type: "move" }));
  s.jobs.find((j) => j.ms === 1000)!.fn();
  await turn();
  const recovered = s.sockets[1];
  recovered.onopen({});
  assert.deepEqual(recovered.sent, [{ type: "join", code: "ABC", token: "seat" }]);
  lateFrame({ data: JSON.stringify({ type: "state", state: {} }) });
  assert(!s.client.send({ id: "still-not-joined", type: "move" }));
  s.client.stop();
});
test("idle snapshots cancel movement timeout and resume reconnects without keepalive traffic", async () => {
  const s = setup();
  s.client.start({ code: "ABC", token: "seat" });
  await turn();
  const ws = s.sockets[0];
  ws.onopen({});
  ws.receive({ type: "joined", code: "ABC", token: "seat" });
  ws.receive({ type: "state", state: {} });
  s.client.send({ id: "walk", type: "move", x: 3, z: 4 });
  assert(s.jobs.some((j) => j.ms === 5000));
  ws.receive({ type: "state", state: { players: [{ online: true }] } });
  assert(!s.jobs.some((j) => j.ms === 5000));
  assert.equal(ws.sent.length, 2);
  s.client.resume();
  assert.equal(ws.readyState, 3);
  s.client.stop();
  assert.equal(s.jobs.length, 0);
});
test("recover reconnects with token and never retransmits uncertain purchase", async () => {
  const s = setup();
  s.client.start({ code: "ABC", token: "seat" });
  await turn();
  const ws = s.sockets[0];
  ws.onopen({});
  ws.receive({ type: "joined", code: "ABC", token: "seat" });
  ws.receive({ type: "state", state: {} });
  assert(s.client.send({ id: "buy-1", type: "buy" }));
  ws.close();
  assert.equal(s.uncertain, 1);
  assert(!s.client.send({ id: "buy-2", type: "buy" }));
  s.jobs.find((x) => x.ms === 1000)!.fn();
  await turn();
  const next = s.sockets[1];
  next.onopen({});
  assert.deepEqual(next.sent, [{ type: "join", code: "ABC", token: "seat" }]);
  s.client.stop();
});
test("unconfirmed town creation is not silently repeated", async () => {
  const s = setup();
  s.client.start({ name: "A" });
  await turn();
  s.sockets[0].onopen({});
  s.sockets[0].close();
  assert(s.states.at(-1)!.includes("before a seat was confirmed"));
  assert.equal(s.jobs.length, 0);
  s.client.stop();
});
test("recovery errors and seat replacement stop retries", async () => {
  const s = setup();
  s.client.start({ code: "ABC", token: "invalid" });
  await turn();
  const ws = s.sockets[0];
  ws.onopen({});
  ws.receive({ type: "error", message: "Seat recovery token is invalid." });
  assert.equal(s.jobs.length, 0);
  s.client.stop();
});
test("90-second wake budget ends retries and exposes manual reconnect", async () => {
  const s = setup();
  s.client.start({ code: "ABC", token: "seat" });
  await turn();
  const deadline = s.jobs.find((x) => x.ms === 90000);
  assert(deadline);
  deadline.fn();
  assert.match(s.states.at(-1)!, /90 seconds/);
  assert.equal(s.sockets[0].readyState, 3);
  assert(!s.client.send({ id: "late", type: "buy" }));
  s.client.stop();
});
