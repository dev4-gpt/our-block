import { readFileSync } from "node:fs";
import { openStore } from "../server/storage.ts";
import { restore } from "../shared/game.ts";
const file = process.argv[2];
if (!file) throw Error("Usage: npm run restore -- private-backup.json");
const backup = JSON.parse(readFileSync(file, "utf8"));
if (backup.format !== 1 || !Array.isArray(backup.towns))
  throw Error("Unsupported backup format.");
for (const t of backup.towns) restore(structuredClone(t));
const store = await openStore();
try {
  await store.importAll(backup.towns);
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
