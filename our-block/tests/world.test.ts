import test from "node:test";
import assert from "node:assert/strict";
import { worldPlan, validateWorldPlan } from "../shared/world.ts";
import { route, walkable } from "../shared/navigation.ts";
test("all district entrances and interiors are reachable on shared world geometry", () => {
  assert(validateWorldPlan());
  for (const region of worldPlan.regions) {
    const path = route(-15, -7, region.entrance.x, region.entrance.z);
    assert(path.every((p) => walkable(p.x, p.z)));
    const center = region.structures.find((o) => o.id.endsWith("-floor"));
    if (center) {
      assert(
        route(
          region.entrance.x,
          region.entrance.z,
          center.position[0],
          center.position[2],
        ).length > 0,
      );
    }
  }
});
test("world plan rejects duplicate instances and invalid geometry", () => {
  const bad = structuredClone(worldPlan);
  bad.roads.push(bad.roads[0]);
  assert.throws(() => validateWorldPlan(bad), /Duplicate/);
});
