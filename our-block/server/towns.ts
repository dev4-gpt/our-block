import { createHash } from "node:crypto";
import {
  apply,
  disconnect,
  restore,
  tick,
  type Command,
  type Town,
} from "../shared/game.ts";
import type { Receipt, TownStore } from "./storage.ts";
export class TownService {
  readonly towns = new Map<string, Town>();
  private queues = new Map<string, Promise<unknown>>();
  private dirty = new Set<string>();
  private touched = new Map<string, number>();
  private checked = 0;
  private usageFlight?: Promise<void>;
  private uncertain = new Set<string>();
  usage = { towns: 0, bytes: 0 };
  readonly storageBudget = (() => {
    const bytes = Number(process.env.STORAGE_BUDGET_BYTES || 104857600);
    return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : 104857600;
  })();
  constructor(readonly store: TownStore) {}
  get storageRatio() {
    return this.usage.bytes / this.storageBudget;
  }
  get availability() {
    return this.storageRatio >= 0.9
      ? "read-only"
      : this.storageRatio >= 0.8
        ? "limited"
        : this.storageRatio >= 0.7
          ? "warning"
          : "ready";
  }
  async load() {
    if (this.store.loadOne) {
      await this.refreshUsage(true);
      return;
    }
    for (const raw of await this.store.loadAll())
      this.towns.set(raw.code, restore(raw));
  }
  async refreshUsage(force = false) {
    if (!this.store.stats || (!force && Date.now() - this.checked < 15000))
      return;
    if (!this.usageFlight)
      this.usageFlight = this.store
        .stats()
        .then((usage) => {
          this.usage = usage;
          this.checked = Date.now();
        })
        .finally(() => {
          this.usageFlight = undefined;
        });
    await this.usageFlight;
  }
  async ensure(code: string) {
    if (this.uncertain.has(code) && this.store.loadOne) {
      const previous = this.towns.get(code),
        raw = await this.store.loadOne(code);
      if (!raw) {
        this.towns.delete(code);
        this.uncertain.delete(code);
        return;
      }
      const pending = structuredClone(raw.pending || []),
        recovered = restore(raw);
      for (const player of recovered.players)
        player.online =
          previous?.players.some((p) => p.id === player.id && p.online) ||
          false;
      recovered.pending = pending.filter((q) =>
        recovered.players.some((p) => p.id === q.by && p.online),
      );
      this.towns.set(code, recovered);
      this.dirty.delete(code);
      this.uncertain.delete(code);
    }
    const current = this.towns.get(code);
    if (current) {
      this.touched.set(code, Date.now());
      return current;
    }
    const raw = await this.store.loadOne?.(code);
    if (raw) {
      const t = restore(raw);
      this.towns.set(code, t);
      this.touched.set(code, Date.now());
      this.prune();
      return t;
    }
  }
  prune() {
    const idle = [...this.towns.values()]
      .filter(
        (t) =>
          !t.players.some((p) => p.online) &&
          !this.dirty.has(t.code) &&
          !this.queues.has(t.code),
      )
      .sort(
        (a, b) =>
          (this.touched.get(a.code) || 0) - (this.touched.get(b.code) || 0),
      );
    while (idle.length > 25 || this.towns.size > 50) {
      const t = idle.shift();
      if (!t) break;
      this.towns.delete(t.code);
      this.touched.delete(t.code);
      this.store.forget?.(t.code);
    }
  }
  run<T>(code: string, operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queues.get(code) || Promise.resolve();
    const result = previous.catch(() => {}).then(operation);
    this.queues.set(code, result);
    void result
      .finally(() => {
        if (this.queues.get(code) === result) this.queues.delete(code);
        this.prune();
      })
      .catch(() => {});
    return result;
  }
  async commit(town: Town, receipt?: Receipt) {
    try {
      await this.store.save(town, receipt);
    } catch (e) {
      // A lost COMMIT response is ambiguous: reconcile durable state before any later write.
      if (this.store.loadOne) this.uncertain.add(town.code);
      throw e;
    }
    this.towns.set(town.code, town);
    this.touched.set(town.code, Date.now());
    this.dirty.delete(town.code);
  }
  action(code: string, id: string, command: Command) {
    return this.run(code, async () => {
      const t = await this.ensure(code);
      if (!t) throw Error("Town not found.");
      const durable = !["move", "ping", "ack"].includes(command.type);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(command)
                .filter(([k]) => k !== "revision")
                .sort(([a], [b]) => a.localeCompare(b)),
            ),
          ),
        )
        .digest("hex");
      if (durable) {
        const receipt = await this.store.receipt?.(code, id, command.id);
        if (receipt) {
          if (receipt.fingerprint !== fingerprint)
            throw Error(
              "Invalid action identifier: already used for another decision.",
            );
          return { town: t, message: receipt.message, duplicate: true };
        }
      }
      await this.refreshUsage();
      if (this.availability === "read-only")
        throw Error(
          "READ_ONLY: Storage is near its allowance. Your town is preserved; actions are paused until space is available.",
        );
      if (
        this.storageRatio >= 0.8 &&
        ["accept", "renegotiate"].includes(command.type)
      )
        throw Error(
          "READ_ONLY: New contracts are paused to reserve space for existing projects.",
        );
      const result = apply(t, id, command);
      if (!result.duplicate) {
        if (durable)
          await this.commit(result.town, {
            player: id,
            id: command.id,
            fingerprint,
            message: result.message,
          });
        else {
          this.towns.set(code, result.town);
          this.touched.set(code, Date.now());
          this.dirty.add(code);
        }
      }
      return result;
    });
  }
  disconnect(code: string, id: string) {
    return this.run(code, async () => {
      const original = this.towns.get(code);
      if (!original) return;
      const t = structuredClone(original);
      disconnect(t, id);
      this.towns.set(code, t);
      this.dirty.add(code);
      const safe = this.uncertain.has(code) ? await this.ensure(code) : t;
      if (safe) await this.commit(safe);
    });
  }
  advance(code: string, dt: number, flush: boolean) {
    return this.run(code, async () => {
      const t = this.uncertain.has(code)
        ? await this.ensure(code)
        : this.towns.get(code);
      if (!t) return;
      if (t.players.some((p) => p.online) && !t.review) {
        await this.refreshUsage();
        if (this.availability === "read-only") return;
        const moving = t.players.some((p) => p.target || p.path?.length);
        tick(t, dt);
        if (
          moving ||
          t.mode === "life" ||
          t.crops.length ||
          t.players.some((p) => p.target || p.path?.length)
        )
          this.dirty.add(code);
      }
      if (flush && this.dirty.has(code)) await this.commit(t);
    });
  }
  async flush() {
    await Promise.all(
      [...this.towns.keys()].map((code) =>
        this.run(code, async () => {
          if (this.uncertain.has(code)) await this.ensure(code);
          if (this.dirty.has(code)) await this.commit(this.towns.get(code)!);
        }),
      ),
    );
  }
  async close() {
    await Promise.allSettled([...this.queues.values()]);
    await this.flush();
    await this.store.close();
  }
}
