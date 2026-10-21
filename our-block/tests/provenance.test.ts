import test from "node:test";
import assert from "node:assert/strict";
import {
  createTown,
  join,
  apply,
  restore,
  snapshot,
  type Town,
} from "../shared/game.ts";
import { townOffers } from "../shared/content.ts";
function fixture() {
  let t = createTown("PROVENANCE", "explore");
  join(t, "A", "private");
  join(t, "B", "private2");
  t.players[1].online = false;
  let seq = 0;
  return {
    get t() {
      return t;
    },
    set t(v: Town) {
      t = v;
    },
    at(x: number, z: number, id = "p1") {
      Object.assign(
        t.players.find((p) => p.id === id)!,
        { x, z },
      );
    },
    act(type: string, data: any = {}, id = "p1") {
      const c = {
        v: 1 as const,
        id: String(++seq),
        revision: t.revision,
        type,
        ...data,
      };
      const result = apply(t, id, c);
      t = result.town;
      return c;
    },
  };
}
test("personal return credits original payer after a gift; no shared-fund windfall", () => {
  const f = fixture();
  f.at(0, -12);
  f.t.players[0].money = 50;
  f.act("buy", { target: "connector", account: "personal" });
  assert.equal(f.t.players[0].money, 32);
  f.at(0, -12, "p2");
  f.t.players[1].online = true;
  f.act("give", { player: "p2", item: "connector", qty: 1 });
  f.act("refund", { target: "connector" }, "p2");
  assert.equal(f.t.players[0].money, 50);
  assert.equal(f.t.players[1].money, 0);
  assert.equal(f.t.funds, 300);
  assert.equal(f.t.lots.length, 0);
  assert.throws(
    () => f.act("refund", { target: "connector" }, "p2"),
    /refundable/,
  );
});
test("free units are consumed first; partial purchased packs cannot be refunded as full packs", () => {
  const f = fixture();
  f.at(0, -12);
  f.act("buy", { target: "seed" });
  f.t.players[0].bag.seed++;
  f.at(-15, 12);
  f.t.upgrades.push("irrigation");
  f.act("activity", { target: "water" });
  f.at(0, -12);
  assert.equal(snapshot(f.t, "p1").refundable.seed, 3);
  f.act("refund", { target: "seed" });
  assert.equal(f.t.funds, 300);
  f.act("buy", { target: "seed" });
  f.at(-15, 12);
  f.act("activity", { target: "water" });
  f.at(0, -12);
  assert.throws(() => f.act("refund", { target: "seed" }), /complete unused/);
  assert.equal(f.t.lots[0].qty, 2);
});
test("storage splits retain receipt value and original payer through recovery", () => {
  const f = fixture();
  f.at(0, -12);
  f.act("buy", { target: "seed" });
  f.at(-15, -12);
  f.act("transfer", { item: "seed", qty: 2, direction: "store" });
  assert.equal(f.t.lots.filter((l) => l.location === "storage")[0].qty, 2);
  f.t = restore(structuredClone(f.t));
  f.t.players[0].online = true;
  f.act("transfer", { item: "seed", qty: 2, direction: "take" });
  f.at(0, -12);
  f.act("refund", { target: "seed" });
  assert.equal(f.t.funds, 300);
  assert.equal(f.t.lots.length, 0);
});
test("refund duplicate IDs cannot credit twice and independent racing returns lose safely", () => {
  const f = fixture();
  f.at(0, -12);
  f.act("buy", { target: "wrong" });
  const command = f.act("refund", { target: "wrong" });
  assert.equal(apply(f.t, "p1", command).duplicate, true);
  assert.equal(f.t.funds, 300);
  assert.throws(() => apply(f.t, "p1", { ...command, id: "other" }), /STALE/);
});
test("legacy inventory stays usable without fabricated refundable history, and schema 2 migrates", () => {
  const f = fixture();
  const old: any = structuredClone(f.t);
  old.schema = 2;
  delete old.lots;
  delete old.projectWork;
  delete old.outcomes;
  old.players[0].bag.wrong = 1;
  f.t = restore(old);
  f.t.players[0].online = true;
  f.at(0, -12);
  assert.equal(f.t.schema, 3);
  assert.equal(f.t.players[0].bag.wrong, 1);
  assert.throws(() => f.act("refund", { target: "wrong" }), /legacy/);
  assert.equal(f.t.funds, 300);
  assert.equal(snapshot(f.t, "p1").lots, undefined);
});
test("replay uses actual new prices and rejects refunds for free lookalike units", () => {
  const f = fixture();
  f.t.variant = 1;
  f.at(0, -12);
  const cost = townOffers(f.t).find((o) => o.id === "connector")!.price;
  f.act("buy", { target: "connector" });
  assert.equal(f.t.funds, 300 - cost);
  f.act("refund", { target: "connector" });
  assert.equal(f.t.funds, 300);
  f.t.players[0].bag.connector = 1;
  assert.throws(() => f.act("refund", { target: "connector" }), /refundable/);
});
test("one pack assembled from two payers refunds each actual contribution", () => {
  const f = fixture();
  f.at(0, -12);
  f.t.players[0].money = 50;
  f.act("buy", { target: "seed", account: "personal" });
  f.at(-15, -12);
  f.act("transfer", { item: "seed", qty: 1, direction: "store" });
  f.at(-15, 12);
  f.t.upgrades.push("irrigation");
  f.act("activity", { target: "water" });
  f.act("activity", { target: "water" });
  f.at(0, -12);
  f.act("buy", { target: "seed" });
  f.at(-15, 12);
  f.act("activity", { target: "water" });
  f.at(-15, -12);
  f.act("transfer", { item: "seed", qty: 1, direction: "take" });
  f.at(0, -12);
  f.act("refund", { target: "seed" });
  assert.equal(f.t.players[0].money, 42);
  assert.equal(f.t.funds, 296);
  assert.equal(f.t.lots.length, 0);
});
