import test from "node:test";
import assert from "node:assert/strict";
import { SimulationClock } from "../server/simulation-clock.ts";
import { TownService } from "../server/towns.ts";
import { createTown, join } from "../shared/game.ts";
import { walkable } from "../shared/navigation.ts";
import { visualPosition, smoothingAlpha } from "../src/motion.ts";

test("movement catches up after a delayed save without overlapping simulation writes", async () => {
  const town = createTown("MOTION");
  join(town, "Walker", "test-seat");
  town.players[0].target = { x: -5, z: -7 };
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = new TownService({
    loadAll: async () => [],
    save: async () => {
      await blocked;
    },
    importAll: async () => {},
    close: async () => {},
  });
  service.towns.set(town.code, town);
  const clock = new SimulationClock(0);
  const first = service.advance(town.code, clock.begin(100)!, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  for (const now of [200, 400, 800, 1200, 1500])
    assert.equal(clock.begin(now), undefined);
  release();
  await first;
  clock.end();
  await service.advance(town.code, clock.begin(1600)!, false);
  clock.end();
  assert.equal(town.players[0].x, -7); // 1.6 s × 5 units/s, not 0.2 s.
  assert.equal(town.simTime, 1.6);
  assert.equal(clock.begin(100000), 2); // bounded machine-suspension catch-up
});

test("four new neighbors spawn separately on reachable open ground", () => {
  const t = createTown("SPAWNS");
  for (let i = 0; i < 4; i++) join(t, `Neighbor ${i}`, `token-${i}`);
  assert.equal(new Set(t.players.map((p) => `${p.x},${p.z}`)).size, 4);
  assert(t.players.every((p) => walkable(p.x, p.z)));
});

test("visual motion respects route turns, stops at 250 ms, and never mutates authority", () => {
  const p = { x: 0, z: 0, target: { x: 0, z: 1 }, path: [{ x: 2, z: 1 }] };
  assert.deepEqual(visualPosition(p, 0.1), { x: 0, z: 0.5 });
  assert.deepEqual(visualPosition(p, 0.25), { x: 0.25, z: 1 });
  assert.deepEqual(visualPosition(p, 10), visualPosition(p, 0.25));
  assert.equal(p.x, 0);
  assert.deepEqual(visualPosition({ x: 2, z: 3 }, 1), { x: 2, z: 3 });
  const remaining = (fps: number) =>
    Math.pow(1 - smoothingAlpha(1 / fps), fps / 10);
  assert(Math.abs(remaining(30) - remaining(60)) < 1e-10);
});
