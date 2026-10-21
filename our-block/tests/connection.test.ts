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
