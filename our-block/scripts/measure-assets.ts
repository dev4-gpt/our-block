/** Conservative decoded-asset transfer rehearsal, not a browser rendering benchmark. */
import { mkdirSync, writeFileSync } from "node:fs";
const origin = process.argv[2];
if (!origin?.startsWith("https://"))
  throw Error("Provide the explicit public HTTPS game origin.");
const base = new URL(origin);
if (base.search || base.username || base.password)
  throw Error("Use a public origin without credentials or query parameters.");
const health = await fetch(new URL("/health", base), {
  signal: AbortSignal.timeout(90000),
});
if (!health.ok || !((await health.json()) as any).ok)
  throw Error("Warm-server readiness failed.");
const bytesPerSecond = 1250000,
  start = performance.now();
let bytes = 0;
const queue = [new URL("/", base).href],
  seen = new Set<string>(),
  files: any[] = [];
while (queue.length) {
  const url = queue.shift()!;
  if (seen.has(url)) continue;
  seen.add(url);
  if (seen.size > 32) throw Error("Unexpected asset count.");
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw Error("Asset download failed.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body as any) {
    const b = new Uint8Array(chunk);
    size += b.length;
    bytes += b.length;
    if (bytes > 10000000) throw Error("Asset rehearsal traffic cap exceeded.");
    chunks.push(b);
    const delay = start + (bytes / bytesPerSecond) * 1000 - performance.now();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
  const body = Buffer.concat(chunks);
  files.push({
    path: new URL(url).pathname,
    decodedBytes: size,
    encoding: response.headers.get("content-encoding") || "identity",
  });
  const text = body.toString("utf8");
  const refs = [
    ...text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g),
    ...text.matchAll(
      /["']((?:\.\/|\/assets\/|assets\/)[A-Za-z0-9._\/-]+\.(?:js|css))["']/g,
    ),
  ];
  for (const match of refs) {
    const resolved = new URL(match[1], url);
    if (resolved.origin === base.origin && !seen.has(resolved.href))
      queue.push(resolved.href);
  }
}
const report = {
  date: new Date().toISOString(),
  origin: base.origin,
  sourceRef: process.env.MEASUREMENT_REF || "record deployed commit separately",
  bandwidthMbps: 10,
  method:
    "Sequential HTTP consumption capped at 1,250,000 decoded bytes/second; readiness excluded. Decoded-byte shaping is conservative when HTTP compression is used.",
  decodedBytes: bytes,
  elapsedMs: Math.round(performance.now() - start),
  assetTransferUnderTenSeconds: performance.now() - start <= 10000,
  files,
  limits: [
    "Not a browser start-to-interactive result.",
    "External Google Fonts and font rendering are excluded.",
    "Not a 10 Mbps physical-phone network result.",
  ],
};
mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  `docs/evidence/assets-${Date.now()}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
