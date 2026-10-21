import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { openStore } from "../server/storage.ts";
const directory = process.argv[2] || "../backups";
mkdirSync(directory, { recursive: true });
const store = await openStore();
try {
  const towns = await store.loadAll();
  const output = path.join(directory, `our-block-${Date.now()}.json`);
  writeFileSync(output, JSON.stringify({ format: 1, towns }, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    `Saved ${towns.length} towns to ${output}. Contains recovery secrets; keep private.`,
  );
} finally {
  await store.close();
}
