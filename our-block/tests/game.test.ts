import test from "node:test";
import assert from "node:assert/strict";
import {
  createTown,
  join,
  apply,
  tick,
  disconnect,
  snapshot,
  restore,
  type Town,
} from "../shared/game.ts";
import { districts, upgrades } from "../shared/content.ts";
function setup(n = 1) {
  let t = createTown("TEST");
  for (let i = 0; i < n; i++) join(t, "Neighbor " + i, "token" + i);
  let seq = 0;
  return {
    get t() {
      return t;
    },
    set t(v: Town) {
      t = v;
    },
    act(type: string, data: any = {}, id = "p1") {
      const result = apply(t, id, {
        v: 1,
        id: String(++seq),
        revision: t.revision,
        type,
        ...data,
      });
      t = result.town;
      return result;
    },
    at(d: string, id = "p1") {
      const p = t.players.find((x) => x.id === id)!,
        a = districts.find((x) => x.id === d)!;
      p.x = a.x;
      p.z = a.z;
    },
  };
}
test("shared purchases require an independent approval, commit once, and do not expose tokens", () => {
  const s = setup(2);
  s.at("market");
  s.act("buy", { target: "connector" });
  assert.equal(s.t.funds, 300);
  const pending = s.t.pending[0].id;
  assert.throws(
    () => s.act("approve", { target: pending }),
    /different teammate/,
  );
  s.act("approve", { target: pending }, "p2");
  assert.equal(s.t.funds, 282);
  assert.equal(s.t.players[0].bag.connector, 1);
  assert.throws(() => s.act("approve", { target: pending }, "p2"));
  assert(!JSON.stringify(snapshot(s.t, "p1")).includes("token0"));
});
test("idempotence and stale revisions prevent duplicate or concurrent spending", () => {
  const s = setup();
  s.at("market");
  const c = {
    v: 1 as const,
    id: "unique",
    revision: s.t.revision,
    type: "buy",
    target: "seed",
  };
  const a = apply(s.t, "p1", c);
  assert.equal(apply(a.town, "p1", c).duplicate, true);
  assert.equal(a.town.funds, 288);
  assert.throws(() => apply(a.town, "p1", { ...c, id: "other" }), /STALE/);
});
test("failed activities and inventory transfers roll back all changes", () => {
  const s = setup();
  s.at("garden");
  s.t.players[0].bag.water = 1;
  const before = structuredClone(s.t);
  assert.throws(() => s.act("activity", { target: "water" }), /supplies/);
  assert.deepEqual(s.t, before);
  assert.throws(() =>
    s.act("transfer", { item: "tool", qty: -1, direction: "take" }),
  );
});
test("all six districts have two functional upgrades", () => {
  assert.equal(upgrades.length, 12);
  for (const d of districts)
    assert.equal(upgrades.filter((u) => u.district === d.id).length, 2);
});
for (const alternative of [false, true])
  test(`all three projects have a full legal solution, approach ${alternative ? 2 : 1}`, () => {
    const s = setup();
    s.at("garden");
    s.act("accept", { target: "garden" });
    s.act("activity", { target: "inspect" });
    s.at("workshop");
    s.act("activity", { target: "diagnose" });
    s.at("market");
    s.act("activity", { target: "compare" });
    s.act("buy", { target: alternative ? "hose" : "connector" });
    s.at("garden");
    s.act("fit", { item: alternative ? "hose" : "connector" });
    s.act("test");
    s.act("complete", { target: "garden" });
    assert.equal(s.t.contracts.garden.status, "complete");
    s.at("market");
    s.act("accept", { target: "market" });
    s.act("buy", { target: "seed" });
    s.act("buy", { target: "pack" });
    s.at("home");
    s.act("activity", { target: "plan" });
    s.at("garden");
    s.act("activity", { target: "water" });
    tick(s.t, 30);
    s.act("activity", { target: "harvest" });
    s.at("depot");
    if (alternative) s.act("buy", { target: "reused" });
    s.act("activity", { target: "route" });
    s.act("activity", { target: "pack" });
    s.at("market");
    s.act("complete", { target: "market" });
    s.at("hall");
    s.act("accept", { target: "evening" });
    s.act("activity", { target: "terms" });
    s.act("buy", { target: "lamp" });
    if (alternative) s.act("upgrade", { target: "kitchen" });
    s.at("workshop");
    s.act("buy", { target: "filter" });
    s.act("activity", { target: "repair" });
    s.at("garden");
    s.act("upgrade", { target: "irrigation" });
    s.act("activity", { target: "water" });
    tick(s.t, 30);
    s.act("activity", { target: "harvest" });
    s.at("depot");
    s.act("activity", { target: "trace" });
    if (!alternative) s.act("activity", { target: "pack" });
    s.at("hall");
    if (alternative) s.act("activity", { target: "cater" });
    s.act("complete", { target: "evening" });
    assert(Object.values(s.t.contracts).every((x) => x.status === "complete"));
    assert(s.t.funds > 0);
  });
test("incompatible purchase is recoverable with a full unused return", () => {
  const s = setup();
  s.at("market");
  s.act("buy", { target: "wrong" });
  assert.equal(s.t.funds, 291);
  s.act("refund", { target: "wrong" });
  assert.equal(s.t.funds, 300);
  assert.throws(() => s.act("refund", { target: "wrong" }));
});
test("offline time pauses, day ends for review, bills suspend service and work pays arrears", () => {
  const s = setup();
  s.at("hall");
  s.act("upgrade", { target: "kitchen" });
  disconnect(s.t, "p1");
  tick(s.t, 1200);
  assert.equal(s.t.seconds, 0);
  s.t.players[0].online = true;
  tick(s.t, 1200);
  assert.equal(s.t.review, true);
  s.act("next");
  assert.equal(s.t.bill, 8);
  s.t.players[0].bag.produce = 1;
  assert.throws(() => s.act("activity", { target: "cater" }), /outstanding/);
  s.act("negotiate-bill");
  assert.equal(s.t.bill, 3);
  s.act("bill");
  s.act("activity", { target: "cater" });
  assert.equal(s.t.players[0].bag.meal, 1);
});
test("deadlines can be renegotiated, cancellation preserves supplies", () => {
  const s = setup();
  s.at("garden");
  s.act("accept", { target: "garden" });
  s.t.day = 5;
  s.t.review = true;
  s.act("next");
  assert.equal(s.t.contracts.garden.status, "expired");
  s.act("renegotiate", { target: "garden" });
  assert.equal(s.t.contracts.garden.due, 9);
  s.t.players[0].bag.seed = 1;
  s.act("abandon", { target: "garden" });
  assert.equal(s.t.players[0].bag.seed, 1);
});
test("disconnected buyer requests cancel, remaining player can buy solo", () => {
  const s = setup(2);
  s.at("market");
  s.act("buy", { target: "seed" });
  disconnect(s.t, "p1");
  assert.equal(s.t.pending.length, 0);
  s.at("market", "p2");
  s.act("buy", { target: "seed" }, "p2");
  assert.equal(s.t.players[1].bag.seed, 3);
});
test("movement is speed limited and bounds validated; interaction is local", () => {
  const s = setup();
  assert.throws(() => s.act("activity", { target: "diagnose" }), /closer/);
  assert.throws(() => s.act("move", { x: 100, z: 0 }));
  const x = s.t.players[0].x;
  s.act("move", { x: 0, z: -7 });
  tick(s.t, 1);
  assert.equal(s.t.players[0].x - x, 5);
});
test("restore clears connections and requests while preserving ownership and money", () => {
  const s = setup(2);
  s.at("market");
  s.act("buy", { target: "seed" });
  const t = restore(JSON.parse(JSON.stringify(s.t)));
  assert.equal(t.pending.length, 0);
  assert(t.players.every((p) => !p.online));
  assert.equal(t.funds, 300);
  assert.throws(() => restore({ schema: 2 }), /Unsupported save/);
});
test("four seats maximum and explorer time remains untimed", () => {
  const s = setup(4);
  assert.throws(() => join(s.t, "fifth", "x"));
  s.t.mode = "explore";
  tick(s.t, 5000);
  assert.equal(s.t.seconds, 0);
});
test("free work cannot be spammed and personal contributions preserve accounting", () => {
  const s = setup();
  s.at("home");
  s.act("activity", { target: "maintain" });
  assert.throws(() => s.act("activity", { target: "maintain" }), /today/);
  assert.equal(s.t.players[0].money, 8);
  s.act("deposit", { qty: 8 });
  assert.equal(s.t.funds, 308);
  assert.equal(s.t.players[0].money, 0);
});
test("growing takes active time, pauses offline and harvest happens exactly once", () => {
  const s = setup();
  s.at("garden");
  s.t.players[0].bag = { seed: 1, water: 1 };
  s.act("activity", { target: "water" });
  assert.throws(() => s.act("activity", { target: "harvest" }), /mature/);
  disconnect(s.t, "p1");
  tick(s.t, 60);
  assert.equal(s.t.simTime, 0);
  s.t.players[0].online = true;
  tick(s.t, 30);
  s.act("activity", { target: "harvest" });
  assert.equal(s.t.players[0].bag.produce, 1);
  assert.throws(() => s.act("activity", { target: "harvest" }));
});
for (const id of ["garden", "market", "evening"])
  test(`second ${id} commission changes supplies and can be completed`, () => {
    const s = setup();
    s.t.contracts[id] = { due: 3, status: "complete", variant: 0 };
    s.at(id === "evening" ? "hall" : id);
    s.act("accept", { target: id });
    assert.equal(s.t.contracts[id].variant, 1);
    s.t.evidence = [
      "leak",
      "diagnosis",
      "sizes",
      "receipt",
      "verified",
      "terms",
    ];
    s.t.players[0].bag =
      id === "garden"
        ? { connector: 1, filter: 1 }
        : id === "market"
          ? { parcel: 2 }
          : { repair: 2, parcel: 1, lamp: 1 };
    if (id === "garden") {
      s.act("fit", { item: "connector" });
      s.act("test");
    }
    s.act("complete", { target: id });
    assert.equal(s.t.contracts[id].status, "complete");
  });

test("delivery claim can be checked before payment and disputed once after verification", () => {
  const s = setup();
  s.at("depot");
  s.act("buy", { target: "delivery-fee" });
  assert.equal(s.t.funds, 275);
  assert.throws(
    () => s.act("refund", { target: "delivery-fee" }),
    /Contact the original/,
  );
  assert.throws(
    () => s.act("buy", { target: "delivery-fee" }),
    /existing disputed/,
  );
  s.act("activity", { target: "trace" });
  s.act("refund", { target: "delivery-fee" });
  assert.equal(s.t.funds, 300);
  assert.throws(() => s.act("refund", { target: "delivery-fee" }));
});
test("delivery payment also requires teammate approval", () => {
  const s = setup(2);
  s.at("depot");
  s.act("buy", { target: "delivery-fee" });
  assert.equal(s.t.funds, 300);
  s.act("approve", { target: s.t.pending[0].id }, "p2");
  assert.equal(s.t.funds, 275);
});
for (const project of ["garden", "market", "evening"])
  test(`${project}: an expired commitment can be canceled, supplies retained, and work planned again`, () => {
    const s = setup();
    s.at(project === "evening" ? "hall" : project);
    s.act("accept", { target: project });
    s.t.players[0].bag = { filter: 1 };
    s.t.day = s.t.contracts[project].due;
    s.t.review = true;
    s.act("next");
    assert.equal(s.t.contracts[project].status, "expired");
    s.act("renegotiate", { target: project });
    assert.equal(s.t.contracts[project].status, "active");
    s.act("abandon", { target: project });
    assert.equal(s.t.players[0].bag.filter, 1);
    s.act("accept", { target: project });
    assert.equal(s.t.contracts[project].status, "active");
  });
test("a declined request spends nothing and requester alone can cancel", () => {
  const s = setup(2);
  s.at("market");
  s.act("buy", { target: "connector" });
  const id = s.t.pending[0].id;
  assert.throws(() => s.act("cancel", { target: id }, "p2"), /requester/);
  s.act("decline", { target: id }, "p2");
  assert.equal(s.t.funds, 300);
  assert.equal(s.t.pending.length, 0);
  assert.equal(s.t.decisions.at(-1)?.status, "declined");
});
test("fitting consumes the carried part, a test is required, incompatible fitting leaves resources intact", () => {
  const s = setup();
  s.at("garden");
  s.act("accept", { target: "garden" });
  s.t.evidence = ["leak", "diagnosis", "sizes"];
  s.t.players[0].bag = { wrong: 1, connector: 1 };
  const before = structuredClone(s.t);
  assert.throws(() => s.act("fit", { item: "wrong" }));
  assert.deepEqual(s.t, before);
  s.act("fit", { item: "connector" });
  assert.equal(s.t.players[0].bag.connector || 0, 0);
  assert.throws(() => s.act("complete", { target: "garden" }), /test/i);
  s.act("test");
  s.act("complete", { target: "garden" });
  assert.equal(s.t.funds, 355);
});
