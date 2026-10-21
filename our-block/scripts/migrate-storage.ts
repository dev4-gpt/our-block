import { DatabaseSync } from "node:sqlite";
import { PostgresStore } from "../server/storage.ts";
import { restore, type Town } from "../shared/game.ts";

/** Read-only source; destination inserts are all-or-nothing and never overwrite. */
export async function importSQLite(
  filename: string,
  destination: { importAll(towns: Town[]): Promise<void> },
) {
  const db = new DatabaseSync(filename, { readOnly: true });
  let towns: Town[];
  try {
    towns = db
      .prepare("SELECT code,data FROM towns")
      .all()
      .map((row) => {
        const raw = JSON.parse(String(row.data));
        if (raw.code !== row.code) throw Error("Source town code mismatch.");
        restore(structuredClone(raw)); // validate without clearing source seat state
        return raw as Town;
      });
  } finally {
    db.close();
  }
  await destination.importAll(towns);
  return towns.length;
}
if (process.argv[1]?.endsWith("migrate-storage.ts")) {
  const source = process.argv[2];
  if (!source || !process.env.DATABASE_URL)
    throw Error(
      "Usage: DATABASE_URL set in environment; npm run migrate:cloud -- /path/to/backup.sqlite",
    );
  const store = await PostgresStore.open(process.env.DATABASE_URL);
  try {
    console.log(
      `Imported ${await importSQLite(source, store)} towns. Existing destination codes are never overwritten.`,
    );
  } catch {
    console.error(
      "Import failed; no towns imported. Check connectivity and conflicting town codes.",
    );
    process.exitCode = 1;
  } finally {
    await store.close();
  }
}
