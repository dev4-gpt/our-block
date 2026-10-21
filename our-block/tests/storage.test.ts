import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import {
  SQLiteStore,
  PostgresStore,
  postgresConfig,
  type TownStore,
} from "../server/storage.ts";
import { TownService } from "../server/towns.ts";
import { createTown, join, type Town } from "../shared/game.ts";
import { importSQLite } from "../scripts/migrate-storage.ts";
function town(code = "SAVE") {
  const t = createTown(code);
  join(t, "A", "private-a");
  join(t, "B", "private-b");
  return t;
}
const backends = [
  "sqlite",
  ...(process.env.TEST_DATABASE_URL ? ["postgres"] : []),
];
for (const backend of backends)
  test(`${backend}: durable ledger, atomic conflict refusal, duplicate and concurrent commands`, async () => {
    const dir = mkdtempSync(pathJoin(tmpdir(), "block-store-"));
    const store: TownStore =
      backend === "sqlite"
        ? new SQLiteStore(pathJoin(dir, "save.sqlite"))
        : await PostgresStore.open(process.env.TEST_DATABASE_URL!);
    const code = "T" + Date.now() + Math.random().toString(16).slice(2, 6);
    const t = town(code);
    const service = new TownService(store);
    try {
      await service.commit(t);
      const cmd = {
        v: 1 as const,
        id: "job",
        type: "activity",
        target: "maintain",
        revision: t.revision,
      };
      const results = await Promise.allSettled([
        service.action(code, "p1", cmd),
        service.action(code, "p2", { ...cmd, id: "competing" }),
      ]);
      assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
      const committed = service.towns.get(code)!;
      const buyer = committed.players.find((p) => p.money === 8)!;
      await service.action(
        code,
        buyer.id,
        cmd.id === "job" && buyer.id === "p1"
          ? cmd
          : { ...cmd, id: "competing" },
      );
      assert.equal(
        service.towns.get(code)!.players.filter((p) => p.money === 8).length,
        1,
      );
      const loaded = (await store.loadAll()).find((x) => x.code === code)!;
      assert.equal(loaded.players.find((p) => p.id === buyer.id)!.money, 8);
      const other = town(code + "NEW");
      await assert.rejects(store.importAll([other, t]));
      assert(!(await store.loadAll()).some((x) => x.code === other.code));
    } finally {
      await service.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
test("failed save does not publish money or processed IDs; queued next action can recover", async () => {
  let fail = true;
  const data = new Map<string, Town>();
  const store: TownStore = {
    loadAll: async () => [],
    save: async (t) => {
      if (fail) throw Error("storage down");
      data.set(t.code, structuredClone(t));
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store),
    t = town();
  service.towns.set(t.code, t);
  const command = {
    v: 1 as const,
    id: "earn",
    revision: t.revision,
    type: "activity",
    target: "maintain",
  };
  await assert.rejects(service.action(t.code, "p1", command));
  assert.equal(service.towns.get(t.code)!.players[0].money, 0);
  assert.equal(t.processed.length, 0);
  fail = false;
  await service.action(t.code, "p1", command);
  assert.equal(data.get(t.code)!.players[0].money, 8);
});
test("empty towns generate no periodic writes, disconnection flushes once", async () => {
  let writes = 0;
  const store: TownStore = {
    loadAll: async () => [],
    save: async () => {
      writes++;
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store),
    t = town();
  await service.commit(t);
  await service.disconnect(t.code, "p1");
  await service.disconnect(t.code, "p2");
  const before = writes;
  for (let i = 0; i < 10; i++) await service.advance(t.code, 0.1, true);
  assert.equal(writes, before);
  assert.equal(t.seconds, 0);
});
test("SQLite import preserves codes and secrets but refuses all conflicts transactionally", async () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), "block-import-")),
    file = pathJoin(dir, "source.sqlite");
  const source = new SQLiteStore(file),
    dest = new SQLiteStore(pathJoin(dir, "dest.sqlite"));
  try {
    await source.save(town("A"));
    await source.save(town("B"));
    await importSQLite(file, dest);
    const rows = await dest.loadAll();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].players[0].token, "private-a");
    await assert.rejects(importSQLite(file, dest));
    assert.equal((await dest.loadAll()).length, 2);
  } finally {
    await source.close();
    await dest.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("TLS cannot be weakened by database URL options", () => {
  const config = postgresConfig(
    "postgresql://user:secret@example.com/db?sslmode=disable",
  );
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert(!config.connectionString!.includes("sslmode"));
  assert.throws(() => postgresConfig("https://example.com"));
});
test(
  "Postgres rejects an overlapping server overwriting a newer town",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const a = await PostgresStore.open(process.env.TEST_DATABASE_URL!),
      b = await PostgresStore.open(process.env.TEST_DATABASE_URL!);
    try {
      const t = town("OVERLAP" + Date.now());
      await a.save(t);
      await b.loadAll();
      t.funds = 299;
      await a.save(t);
      const stale = structuredClone(t);
      stale.funds = 0;
      await assert.rejects(b.save(stale), /Save conflict/);
      assert.equal(
        (await a.loadAll()).find((x) => x.code === t.code)!.funds,
        299,
      );
    } finally {
      await a.close();
      await b.close();
    }
  },
);
test("movement avoids immediate database writes and flushes periodically; economics still commit before response", async () => {
  let writes = 0;
  const store: TownStore = {
    loadAll: async () => [],
    save: async () => {
      writes++;
    },
    importAll: async () => {},
    close: async () => {},
  };
  const service = new TownService(store),
    t = town("MOVESAVE");
  await service.commit(t);
  const before = writes;
  await service.action(t.code, "p1", {
    v: 1,
    id: "move",
    revision: t.revision,
    type: "move",
    x: -14,
    z: -7,
  });
  assert.equal(writes, before);
  await service.advance(t.code, 0.1, false);
  assert.equal(writes, before);
  await service.advance(t.code, 0.1, true);
  assert.equal(writes, before + 1);
  const latest = service.towns.get(t.code)!;
  await service.action(t.code, "p1", {
    v: 1,
    id: "work",
    revision: latest.revision,
    type: "activity",
    target: "maintain",
  });
  assert.equal(writes, before + 2);
  assert.equal(service.towns.get(t.code)!.players[0].money, 8);
  await service.close();
});

for (const backend of backends)
  test(`${backend}: original-payer refund is durable, transactional and restart-idempotent`, async () => {
    const dir = mkdtempSync(pathJoin(tmpdir(), "block-refund-"));
    const open = async () =>
      backend === "sqlite"
        ? new SQLiteStore(pathJoin(dir, "save.sqlite"))
        : await PostgresStore.open(process.env.TEST_DATABASE_URL!);
    let store = await open(),
      service = new TownService(store);
    const t = createTown(
      "R" + Date.now() + Math.random().toString(16).slice(2, 6),
      "explore",
    );
    join(t, "A", "refund-private");
    t.players[0].money = 50;
    t.players[0].x = 0;
    t.players[0].z = -12;
    try {
      await service.commit(t);
      await service.action(t.code, "p1", {
        v: 1,
        id: "purchase",
        revision: t.revision,
        type: "buy",
        target: "connector",
        account: "personal",
      });
      const bought = service.towns.get(t.code)!;
      const refund = {
        v: 1 as const,
        id: "return",
        revision: bought.revision,
        type: "refund",
        target: "connector",
      };
      const results = await Promise.allSettled([
        service.action(t.code, "p1", refund),
        service.action(t.code, "p1", { ...refund, id: "racing-return" }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(service.towns.get(t.code)!.players[0].money, 50);
      await service.close();
      store = await open();
      service = new TownService(store);
      const saved = await service.ensure(t.code);
      assert(saved);
      saved.players[0].online = true;
      await service.commit(saved);
      await service.action(t.code, "p1", refund);
      assert.equal(service.towns.get(t.code)!.funds, 300);
      assert.equal(service.towns.get(t.code)!.players[0].money, 50);
      assert.equal(service.towns.get(t.code)!.lots.length, 0);
    } finally {
      await service.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
