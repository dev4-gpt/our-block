import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import type { Town } from "../shared/game.ts";

export interface TownStore {
  loadAll(): Promise<Town[]>;
  save(town: Town): Promise<void>;
  importAll(towns: Town[]): Promise<void>;
  close(): Promise<void>;
}
export class SQLiteStore implements TownStore {
  private db: DatabaseSync;
  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS towns(code TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
  }
  async loadAll() {
    return this.db
      .prepare("SELECT data FROM towns")
      .all()
      .map((r) => JSON.parse(String(r.data)) as Town);
  }
  async save(town: Town) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO towns(code,data) VALUES(?,?)")
        .run(town.code, JSON.stringify(town));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async importAll(towns: Town[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const t of towns)
        this.db
          .prepare("INSERT INTO towns(code,data) VALUES(?,?)")
          .run(t.code, JSON.stringify(t));
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
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const testOnly =
    process.env.ALLOW_LOCAL_PG_TEST === "1" &&
    local &&
    process.env.NODE_ENV !== "production";
  // pg otherwise lets query parameters override the explicit SSL configuration.
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
      await pool.query(
        "CREATE TABLE IF NOT EXISTS towns (code TEXT PRIMARY KEY, data JSONB NOT NULL, storage_version BIGINT NOT NULL DEFAULT 0)",
      );
      await pool.query(
        "ALTER TABLE towns ADD COLUMN IF NOT EXISTS storage_version BIGINT NOT NULL DEFAULT 0",
      );
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
  async save(town: Town) {
    const known = this.versions.get(town.code);
    const result =
      known === undefined
        ? await this.pool.query(
            "INSERT INTO towns(code,data,storage_version) VALUES($1,$2::jsonb,0) RETURNING storage_version",
            [town.code, JSON.stringify(town)],
          )
        : await this.pool.query(
            "UPDATE towns SET data=$2::jsonb,storage_version=storage_version+1 WHERE code=$1 AND storage_version=$3 RETURNING storage_version",
            [town.code, JSON.stringify(town), known],
          );
    if (result.rowCount !== 1)
      throw Error(
        "Save conflict: another server updated this town. Reconnect after the deployment finishes.",
      );
    this.versions.set(town.code, String(result.rows[0].storage_version));
  }
  async importAll(towns: Town[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const t of towns)
        await client.query(
          "INSERT INTO towns(code,data) VALUES($1,$2::jsonb)",
          [t.code, JSON.stringify(t)],
        );
      await client.query("COMMIT");
      for (const t of towns) this.versions.set(t.code, "0");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
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
