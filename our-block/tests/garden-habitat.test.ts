import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createGardenHabitat } from "../src/garden-habitat.ts";

test("growing habitat has a closed entrance that opens for an approaching resident and closes when clear", () => {
  const habitat = createGardenHabitat();
  const ray = new T.Raycaster(
    new T.Vector3(habitat.entrance.x + 3, 1.4, habitat.entrance.z),
    new T.Vector3(-1, 0, 0),
    0,
    4,
  );
  const blocked = () => {
    habitat.group.updateMatrixWorld(true);
    return ray.intersectObject(habitat.group, true).length > 0;
  };
  try {
    assert.equal(blocked(), true);
    habitat.update(
      [{ online: true, x: habitat.entrance.x + 2, z: habitat.entrance.z }],
      0.1,
      true,
    );
    assert.equal(blocked(), false);
    habitat.update(
      [{ online: false, x: habitat.entrance.x, z: habitat.entrance.z }],
      0.1,
      true,
    );
    assert.equal(blocked(), true);
  } finally {
    habitat.dispose();
  }
});
test("growing habitat includes all three uninterrupted walls and a complete roof", () => {
  const habitat = createGardenHabitat();
  try {
    habitat.group.updateMatrixWorld(true);
    const center = habitat.group.position;
    for (const direction of [
      new T.Vector3(-1, 0, 0),
      new T.Vector3(0, 0, -1),
      new T.Vector3(0, 0, 1),
      new T.Vector3(0, 1, 0),
    ]) {
      const ray = new T.Raycaster(
        new T.Vector3(center.x, 2, center.z),
        direction,
        0,
        8,
      );
      assert.ok(ray.intersectObject(habitat.group, true).length > 0);
    }
  } finally {
    habitat.dispose();
  }
});
