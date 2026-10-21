import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteStore } from "../server/storage.ts";
import { restore } from "../shared/game.ts";
const filename = process.argv[2];
if (!filename)
  throw Error("Usage: npm run verify:backup -- /private/backup.backup.json");
const backup = JSON.parse(readFileSync(filename, "utf8"));
if (
  ![1, 2].includes(backup.format) ||
  !Array.isArray(backup.towns) ||
  (backup.format === 2 && !Array.isArray(backup.receipts))
)
  throw Error("Unsupported or incomplete backup.");
const towns = backup.towns.map((t: any) => restore(structuredClone(t))),
  directory = mkdtempSync(join(tmpdir(), "block-restore-check-"));
const store = new SQLiteStore(join(directory, "restored.sqlite"));
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw Error("Restoration mismatch. No credentials or player data printed.");
}
try {
  await store.importAll(towns, backup.receipts || []);
  const restored = await store.loadAll();
  equal(restored.length, towns.length);
  for (const expected of towns) {
    const actual = restored.find((t) => t.code === expected.code);
    if (!actual) throw Error("Restored town missing.");
    equal(actual.funds, expected.funds);
    equal(actual.contracts, expected.contracts);
    equal(actual.storage, expected.storage);
    equal(actual.evidence, expected.evidence);
    equal(actual.upgrades, expected.upgrades);
    equal(actual.totals, expected.totals);
    equal(
      actual.players.map((p) => [p.id, p.token, p.money, p.bag]),
      expected.players.map((p: any) => [p.id, p.token, p.money, p.bag]),
    );
  }
  equal(
    (await store.snapshot()).receipts.length,
    (backup.receipts || []).length,
  );
  for (const receipt of backup.receipts || [])
    equal(await store.receipt(receipt.code, receipt.player, receipt.id), {
      player: receipt.player,
      id: receipt.id,
      fingerprint: receipt.fingerprint,
      message: receipt.message,
    });
  console.log(
    `Restoration verified privately: ${towns.length} towns and ${(backup.receipts || []).length} receipts. The source backup was unchanged; temporary restored data removed.`,
  );
} finally {
  await store.close();
  rmSync(directory, { recursive: true, force: true });
}
