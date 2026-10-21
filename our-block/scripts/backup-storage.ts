import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { openStore } from "../server/storage.ts";
const directory = process.argv[2] || "../backups";
const kind = process.argv.includes("--daily") ? "daily" : "release";
mkdirSync(directory, { recursive: true });
const store = await openStore();
try {
  const snapshot = await store.snapshot!();
  const suffix =
    kind === "daily"
      ? new Date().toISOString().slice(0, 10)
      : String(Date.now());
  const output = path.join(
    directory,
    `our-block-${kind}-${suffix}.backup.json`,
  );
  writeFileSync(
    output,
    JSON.stringify({
      format: 2,
      created: new Date().toISOString(),
      ...snapshot,
    }),
    { mode: 0o600, flag: "wx" },
  );
  const verified = JSON.parse(readFileSync(output, "utf8"));
  if (
    verified.towns.length !== snapshot.towns.length ||
    verified.receipts.length !== snapshot.receipts.length
  )
    throw Error("Backup verification failed; retention was not applied.");
  // Only this tool's verified daily/release namespace is rotated; legacy archives stay intact.
  const pattern =
    kind === "daily"
      ? /^our-block-daily-\d{4}-\d{2}-\d{2}\.backup\.json$/
      : /^our-block-release-\d+\.backup\.json$/;
  const files = readdirSync(directory)
    .filter((f) => pattern.test(f))
    .sort()
    .reverse();
  for (const f of files.slice(kind === "daily" ? 7 : 3))
    unlinkSync(path.join(directory, f));
  console.log(
    `Verified ${snapshot.towns.length} towns and ${snapshot.receipts.length} economic receipts in ${output}. Private recovery secrets: never publish.`,
  );
} finally {
  await store.close();
}
