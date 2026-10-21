import {
  apply,
  disconnect,
  restore,
  tick,
  type Command,
  type Town,
} from "../shared/game.ts";
import type { TownStore } from "./storage.ts";

/** Every mutation, including movement ticks and saves, shares this per-town queue. */
export class TownService {
  readonly towns = new Map<string, Town>();
  private queues = new Map<string, Promise<unknown>>();
  private dirty = new Set<string>();
  constructor(readonly store: TownStore) {}
  async load() {
    for (const raw of await this.store.loadAll())
      this.towns.set(raw.code, restore(raw));
  }
  run<T>(code: string, operation: () => T | Promise<T>): Promise<T> {
    const previous = this.queues.get(code) || Promise.resolve();
    const result = previous.catch(() => {}).then(operation);
    this.queues.set(code, result);
    void result
      .finally(() => {
        if (this.queues.get(code) === result) this.queues.delete(code);
      })
      .catch(() => {});
    return result;
  }
  async commit(town: Town) {
    await this.store.save(town);
    this.towns.set(town.code, town);
    this.dirty.delete(town.code);
  }
  action(code: string, id: string, command: Command) {
    return this.run(code, async () => {
      const t = this.towns.get(code);
      if (!t) throw Error("Town not found.");
      const result = apply(t, id, command);
      if (!result.duplicate) await this.commit(result.town);
      return result;
    });
  }
  disconnect(code: string, id: string) {
    return this.run(code, async () => {
      const original = this.towns.get(code);
      if (!original) return;
      const t = structuredClone(original);
      disconnect(t, id);
      // Lifecycle must become offline even if storage is temporarily unavailable.
      this.towns.set(code, t);
      this.dirty.add(code);
      await this.commit(t);
    });
  }
  advance(code: string, dt: number, flush: boolean) {
    return this.run(code, async () => {
      const t = this.towns.get(code);
      if (!t) return;
      if (t.players.some((p) => p.online) && !t.review) {
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
