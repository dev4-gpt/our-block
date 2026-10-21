import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as file } from "node:path";
import {
  createTown,
  join,
  apply,
  restore,
  snapshot,
  tick,
} from "../shared/game.ts";
import { SQLiteStore, PostgresStore } from "../server/storage.ts";
import { TownService } from "../server/towns.ts";
import { validateCommand, Budget } from "../server/validation.ts";
import { gardenSteps } from "../src/guidance.ts";
const command = (revision: number, id: string, type: string, extra = {}) => ({
  v: 1 as const,
  revision,
  id,
  type,
  ...extra,
});
for (const backend of [
  "sqlite",
  ...(process.env.TEST_DATABASE_URL ? ["postgres"] : []),
])
  test(`${backend}: economic receipts survive history eviction, restart, export and restore`, async () => {
    const dir = mkdtempSync(file(tmpdir(), "block-receipt-"));
    let store =
      backend === "sqlite"
        ? new SQLiteStore(file(dir, "a.sqlite"))
        : await PostgresStore.open(process.env.TEST_DATABASE_URL!);
    let service = new TownService(store);
    try {
      const t = createTown("D" + Date.now());
      join(t, "A", "fixture-secret");
      await service.commit(t);
      const c = command(t.revision, "original-job", "activity", {
        target: "maintain",
      });
      await service.action(t.code, "p1", c);
      // Force the old bounded in-save cache out of the way; durable receipts must still win.
      const saved = structuredClone(service.towns.get(t.code)!);
      saved.processed = Array.from({ length: 1000 }, (_, i) => `p1:later-${i}`);
      await service.commit(saved);
      await service.close();
      store =
        backend === "sqlite"
          ? new SQLiteStore(file(dir, "a.sqlite"))
          : await PostgresStore.open(process.env.TEST_DATABASE_URL!);
      service = new TownService(store);
      await service.load();
      const result = await service.action(t.code, "p1", c);
      assert.equal(result.duplicate, true);
      assert.equal(result.town.players[0].money, 8);
      await assert.rejects(
        service.action(t.code, "p1", { ...c, type: "deposit", qty: 8 }),
        /identifier/,
      );
      const backup = await store.snapshot!();
      const original = backup.towns.find((x) => x.code === t.code)!;
      const dest = new SQLiteStore(file(dir, "restored.sqlite"));
      try {
        await dest.importAll(
          [original],
          backup.receipts.filter((x) => x.code === t.code),
        );
        const restored = new TownService(dest);
        await restored.load();
        assert.equal((await restored.action(t.code, "p1", c)).duplicate, true);
        assert.equal((await dest.loadOne(t.code))!.players[0].money, 8);
        await assert.rejects(dest.importAll([original], backup.receipts));
      } finally {
        await dest.close();
      }
    } finally {
      await service.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
test("cumulative totals remain correct after display ledger truncation", () => {
  let t = createTown("TOTALS");
  join(t, "A", "fixture");
  for (let i = 0; i < 130; i++) {
    t.review = true;
    t = apply(t, "p1", command(t.revision, `day-${i}`, "next")).town;
    t = apply(
      t,
      "p1",
      command(t.revision, `job-${i}`, "activity", { target: "maintain" }),
    ).town;
  }
  assert.equal(t.ledger.length, 200);
  assert.equal(t.totals.p1.income, 1040);
  assert.equal(t.players[0].money, 1040);
  assert.equal(t.totalsComplete, true);
});
test("movement and pings do not invalidate a teammate economic decision", () => {
  let t = createTown("MOVE");
  join(t, "A", "fixture");
  join(t, "B", "fixture2");
  const rev = t.revision;
  t = apply(t, "p2", command(rev, "walk", "move", { x: -14, z: -9 })).town;
  tick(t, 0.1);
  assert.equal(t.revision, rev);
  const earned = apply(
    t,
    "p1",
    command(rev, "earn", "activity", { target: "maintain" }),
  );
  assert.equal(earned.town.players[0].money, 8);
});
test("schema-1 fixture preserves balances, labels partial history and cancels unsafe pending requests", () => {
  const old = JSON.parse(
    readFileSync(new URL("./fixtures/schema-1.json", import.meta.url), "utf8"),
  );
  const t = restore(old);
  assert.equal(t.schema, 3);
  assert.equal(t.funds, 282);
  assert.equal(t.players[0].bag.connector, 1);
  assert.equal(t.players[0].online, false);
  assert.deepEqual(t.pending, []);
  assert.equal(t.totalsComplete, false);
  assert.equal(t.gardenRepair?.tested, true);
  assert.throws(() => restore({ schema: 3 }), /Unsupported save/);
});
test("read-only storage rejects actions without modifying state; lazy cache keeps progress", async () => {
  const saved = new Map();
  const store = {
    loadAll: async () => [],
    loadOne: async (code: string) => saved.get(code),
    stats: async () => ({ towns: saved.size, bytes: 100000000 }),
    save: async (t: any) => {
      saved.set(t.code, structuredClone(t));
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store);
  for (let i = 0; i < 60; i++) {
    const t = createTown("CACHE" + i);
    await service.commit(t);
  }
  service.prune();
  assert.equal(service.towns.size, 25);
  assert.equal(saved.size, 60);
  assert((await service.ensure("CACHE0"))?.code === "CACHE0");
  const t = service.towns.get("CACHE0")!;
  join(t, "A", "fixture");
  await assert.rejects(
    service.action(
      t.code,
      "p1",
      command(t.revision, "blocked", "activity", { target: "maintain" }),
    ),
    /READ_ONLY/,
  );
  assert.equal(t.players[0].money, 0);
});
test("command validation rejects forged fields, nonfinite values and ambiguous transfers", () => {
  for (const extra of [
    { token: "secret" },
    { qty: NaN },
    { direction: "steal" },
    { account: "somebody-else" },
  ])
    assert.throws(() =>
      validateCommand({
        ...command(0, "x", "transfer", {
          item: "tool",
          qty: 1,
          direction: "take",
        }),
        ...extra,
      }),
    );
  const b = new Budget(2, 100);
  assert(b.take("a", 0));
  assert(b.take("a", 1));
  assert(!b.take("a", 2));
  assert(b.take("a", 101));
});
test("guidance describes investigation without leaking an offer or changing snapshots", () => {
  const t = createTown("GUIDE");
  join(t, "A", "fixture");
  const before = JSON.stringify(snapshot(t, "p1"));
  const text = JSON.stringify(gardenSteps(snapshot(t, "p1")));
  assert(!/\b(connector|hose|trustworthy)\b/.test(text));
  assert.equal(JSON.stringify(snapshot(t, "p1")), before);
});
test("a duplicate receipt insert rolls back the entire SQLite save", async () => {
  const dir = mkdtempSync(file(tmpdir(), "block-atomic-"));
  const store = new SQLiteStore(file(dir, "a.sqlite"));
  try {
    const t = createTown("ATOMIC");
    join(t, "A", "fixture");
    const receipt = {
      player: "p1",
      id: "one",
      fingerprint: "fixture",
      message: "done",
    };
    await store.save(t, receipt);
    t.funds = 0;
    await assert.rejects(store.save(t, receipt));
    assert.equal((await store.loadOne(t.code))!.funds, 300);
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("lost COMMIT response reconciles durable state before a later decision or duplicate reply", async () => {
  let persisted: any,
    receipt: any,
    loseReply = false;
  const store = {
    loadAll: async () => [],
    loadOne: async () => structuredClone(persisted),
    receipt: async () => receipt,
    save: async (t: any, r?: any) => {
      persisted = structuredClone(t);
      if (r) receipt = r;
      if (loseReply) {
        loseReply = false;
        throw Error("connection lost after commit");
      }
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store),
    t = createTown("UNCERTAIN");
  join(t, "A", "fixture");
  await service.commit(t);
  loseReply = true;
  const c = command(t.revision, "earned", "activity", { target: "maintain" });
  await assert.rejects(service.action(t.code, "p1", c));
  assert.equal(service.towns.get(t.code)!.players[0].money, 0);
  const recovered = await service.action(t.code, "p1", c);
  assert.equal(recovered.duplicate, true);
  assert.equal(recovered.town.players[0].money, 8);
  assert.equal(recovered.town.players[0].online, true);
  assert.equal(persisted.players[0].money, 8);
});
test("disconnect and shutdown cannot overwrite an ambiguously committed transaction", async () => {
  let persisted: any,
    loseReply = false;
  const store = {
    loadAll: async () => [],
    loadOne: async () => structuredClone(persisted),
    save: async (t: any) => {
      persisted = structuredClone(t);
      if (loseReply) {
        loseReply = false;
        throw Error("lost commit reply");
      }
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store),
    t = createTown("CLOSE");
  join(t, "A", "fixture");
  await service.commit(t);
  loseReply = true;
  await assert.rejects(
    service.action(
      t.code,
      "p1",
      command(t.revision, "job", "activity", { target: "maintain" }),
    ),
  );
  await service.disconnect(t.code, "p1");
  await service.close();
  assert.equal(persisted.players[0].money, 8);
  assert.equal(persisted.players[0].online, false);
});

test("schema-2 fixture migrates to provenance-safe schema 3 without inventing receipts", () => {
  const old = JSON.parse(
    readFileSync(new URL("./fixtures/schema-2.json", import.meta.url), "utf8"),
  );
  const t = restore(old);
  assert.equal(t.schema, 3);
  assert.equal(t.funds, old.funds);
  assert.deepEqual(t.lots, []);
  assert.equal(t.players[0].bag.connector, 1);
  assert.equal(t.totalsComplete, true);
});
