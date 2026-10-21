import { readFileSync } from "node:fs";
import { openStore } from "../server/storage.ts";
import { restore } from "../shared/game.ts";
const file = process.argv[2];
if (!file) throw Error("Usage: npm run restore -- private-backup.json");
const backup = JSON.parse(readFileSync(file, "utf8"));
if (![1, 2].includes(backup.format) || !Array.isArray(backup.towns))
  throw Error("Unsupported backup format.");
const towns = backup.towns.map((t: unknown) => restore(structuredClone(t)));
if (backup.format === 2 && !Array.isArray(backup.receipts))
  throw Error("Missing durable receipts.");
const store = await openStore();
try {
  await store.importAll(towns, backup.receipts || []);
  console.log(
    `Restored ${backup.towns.length} towns; conflicting codes are never replaced.`,
  );
} catch {
  console.error(
    "Restore failed; destination unchanged. Check connection and conflicting codes.",
  );
  process.exitCode = 1;
} finally {
  await store.close();
}
