import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import type { Town } from "../shared/game.ts";
export type Receipt = {
  player: string;
  id: string;
  fingerprint: string;
  message: string;
};
export type StoredReceipt = Receipt & { code: string };
export interface TownStore {
  snapshot?(): Promise<{ towns: Town[]; receipts: StoredReceipt[] }>;
  loadAll(): Promise<Town[]>;
  loadOne?(code: string): Promise<Town | undefined>;
  forget?(code: string): void;
  stats?(): Promise<{ towns: number; bytes: number }>;
  receipt?(
    code: string,
    player: string,
    id: string,
  ): Promise<Receipt | undefined>;
  save(town: Town, receipt?: Receipt): Promise<void>;
  importAll(towns: Town[], receipts?: StoredReceipt[]): Promise<void>;
  close(): Promise<void>;
}
export class SQLiteStore implements TownStore {
  private db: DatabaseSync;
  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS towns(code TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts(code TEXT NOT NULL, player TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, message TEXT NOT NULL, PRIMARY KEY(code,player,id));",
    );
  }
  async loadAll() {
    return this.db
      .prepare("SELECT data FROM towns")
      .all()
      .map((r) => JSON.parse(String(r.data)) as Town);
  }
  async loadOne(code: string) {
    const r = this.db.prepare("SELECT data FROM towns WHERE code=?").get(code);
    return r ? (JSON.parse(String(r.data)) as Town) : undefined;
  }
  async stats() {
    const r = this.db.prepare("SELECT count(*) AS n FROM towns").get()!;
    const pages = this.db.prepare("PRAGMA page_count").get()!,
      size = this.db.prepare("PRAGMA page_size").get()!;
    return {
      towns: Number(r.n),
      bytes: Number(pages.page_count) * Number(size.page_size),
    };
  }
  async receipt(code: string, player: string, id: string) {
    return this.db
      .prepare(
        "SELECT player,id,fingerprint,message FROM receipts WHERE code=? AND player=? AND id=?",
      )
      .get(code, player, id) as Receipt | undefined;
  }
  async save(town: Town, receipt?: Receipt) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO towns(code,data) VALUES(?,?)")
        .run(town.code, JSON.stringify(town));
      if (receipt)
        this.db
          .prepare(
            "INSERT INTO receipts(code,player,id,fingerprint,message) VALUES(?,?,?,?,?)",
          )
          .run(
            town.code,
            receipt.player,
            receipt.id,
            receipt.fingerprint,
            receipt.message,
          );
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async snapshot() {
    this.db.exec("BEGIN");
    try {
      const towns = await this.loadAll();
      const receipts = this.db
        .prepare("SELECT code,player,id,fingerprint,message FROM receipts")
        .all() as StoredReceipt[];
      this.db.exec("COMMIT");
      return { towns, receipts };
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async importAll(towns: Town[], receipts: StoredReceipt[] = []) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const t of towns)
        this.db
          .prepare("INSERT INTO towns(code,data) VALUES(?,?)")
          .run(t.code, JSON.stringify(t));
      for (const r of receipts) {
        if (!towns.some((t) => t.code === r.code))
          throw Error("Receipt without town");
        this.db
          .prepare(
            "INSERT INTO receipts(code,player,id,fingerprint,message) VALUES(?,?,?,?,?)",
          )
          .run(r.code, r.player, r.id, r.fingerprint, r.message);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async close() {
    this.db.close();
  }
}
export function postgresConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Error("DATABASE_URL must be a Postgres URL.");
  const testOnly =
    process.env.ALLOW_LOCAL_PG_TEST === "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    process.env.NODE_ENV !== "production";
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: testOnly ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: "our-block",
  };
}
export class PostgresStore implements TownStore {
  private versions = new Map<string, string>();
  private constructor(private pool: pg.Pool) {}
  static async open(url: string) {
    const pool = new pg.Pool(postgresConfig(url));
    pool.on("error", () =>
      console.error("Database connection interrupted. No credentials logged."),
    );
    try {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(
          "SELECT pg_advisory_xact_lock(hashtext('our-block-schema'))",
        );
        await c.query(
          "CREATE TABLE IF NOT EXISTS towns(code TEXT PRIMARY KEY,data JSONB NOT NULL,storage_version BIGINT NOT NULL DEFAULT 0)",
        );
        await c.query(
          "ALTER TABLE towns ADD COLUMN IF NOT EXISTS storage_version BIGINT NOT NULL DEFAULT 0",
        );
        await c.query(
          "CREATE TABLE IF NOT EXISTS receipts(code TEXT NOT NULL,player TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,message TEXT NOT NULL,PRIMARY KEY(code,player,id))",
        );
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
      return new PostgresStore(pool);
    } catch {
      await pool.end();
      throw Error(
        "Could not initialize Postgres storage. Check server credentials and TLS access.",
      );
    }
  }
  async loadAll() {
    const r = await this.pool.query(
      "SELECT code,data,storage_version FROM towns",
    );
    for (const row of r.rows)
      this.versions.set(row.code, String(row.storage_version));
    return r.rows.map((r) => r.data as Town);
  }
  forget(code: string) {
    this.versions.delete(code);
  }
  async loadOne(code: string) {
    const r = await this.pool.query(
      "SELECT code,data,storage_version FROM towns WHERE code=$1",
      [code],
    );
    if (!r.rows.length) return;
    this.versions.set(code, String(r.rows[0].storage_version));
    return r.rows[0].data as Town;
  }
  async stats() {
    const r = await this.pool.query(
      "SELECT (SELECT count(*) FROM towns) AS n,pg_database_size(current_database()) AS bytes",
    );
    return { towns: Number(r.rows[0].n), bytes: Number(r.rows[0].bytes) };
  }
  async receipt(code: string, player: string, id: string) {
    const r = await this.pool.query(
      "SELECT player,id,fingerprint,message FROM receipts WHERE code=$1 AND player=$2 AND id=$3",
      [code, player, id],
    );
    return r.rows[0] as Receipt | undefined;
  }
  async save(town: Town, receipt?: Receipt) {
    const client = await this.pool.connect();
    const known = this.versions.get(town.code);
    try {
      await client.query("BEGIN");
      const result =
        known === undefined
          ? await client.query(
              "INSERT INTO towns(code,data,storage_version) VALUES($1,$2::jsonb,0) RETURNING storage_version",
              [town.code, JSON.stringify(town)],
            )
          : await client.query(
              "UPDATE towns SET data=$2::jsonb,storage_version=storage_version+1 WHERE code=$1 AND storage_version=$3 RETURNING storage_version",
              [town.code, JSON.stringify(town), known],
            );
      if (result.rowCount !== 1)
        throw Error(
          "Save conflict: another server updated this town. Reconnect after the deployment finishes.",
        );
      if (receipt)
        await client.query(
          "INSERT INTO receipts(code,player,id,fingerprint,message) VALUES($1,$2,$3,$4,$5)",
          [
            town.code,
            receipt.player,
            receipt.id,
            receipt.fingerprint,
            receipt.message,
          ],
        );
      await client.query("COMMIT");
      this.versions.set(town.code, String(result.rows[0].storage_version));
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async snapshot() {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const towns = (await c.query("SELECT data FROM towns")).rows.map(
        (r) => r.data as Town,
      );
      const receipts = (
        await c.query("SELECT code,player,id,fingerprint,message FROM receipts")
      ).rows as StoredReceipt[];
      await c.query("COMMIT");
      return { towns, receipts };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async importAll(towns: Town[], receipts: StoredReceipt[] = []) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      for (const t of towns)
        await c.query("INSERT INTO towns(code,data) VALUES($1,$2::jsonb)", [
          t.code,
          JSON.stringify(t),
        ]);
      for (const r of receipts) {
        if (!towns.some((t) => t.code === r.code))
          throw Error("Receipt without town");
        await c.query(
          "INSERT INTO receipts(code,player,id,fingerprint,message) VALUES($1,$2,$3,$4,$5)",
          [r.code, r.player, r.id, r.fingerprint, r.message],
        );
      }
      await c.query("COMMIT");
      for (const t of towns) this.versions.set(t.code, "0");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}
export async function openStore(): Promise<TownStore> {
  if (process.env.DATABASE_URL)
    return PostgresStore.open(process.env.DATABASE_URL);
  if (process.env.RENDER)
    throw Error(
      "Render requires DATABASE_URL; refusing to create temporary cloud saves.",
    );
  return new SQLiteStore(
    path.join(process.env.DATA_DIR || "data", "our-block.sqlite"),
  );
}
