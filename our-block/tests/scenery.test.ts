import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createScenery } from "../src/scenery.ts";
import { worldThemes, getWorldTheme } from "../src/world-themes.ts";

for (const theme of worldThemes) {
  test(`${theme.name} has valid geometry within a small mobile rendering budget`, () => {
    const scene = createScenery(theme);
    try {
      const geometry = scene.geometry;
      for (const name of ["position", "normal", "color"]) {
        const attribute = geometry.getAttribute(name);
        assert.equal(attribute.count, geometry.getAttribute("position").count);
        assert.ok(Array.from(attribute.array).every(Number.isFinite));
      }
      assert.ok(geometry.getAttribute("position").count / 3 < 10000);
      assert.equal(scene.children.length, 0);
      assert.ok(geometry.boundingSphere!.radius < 210);
    } finally {
      scene.geometry.dispose();
      scene.material.dispose();
    }
  });

  test(`${theme.name} leaves the existing main walking lanes clear`, () => {
    const scene = createScenery(theme);
    try {
      scene.updateMatrixWorld();
      const routes = [
        [new T.Vector3(-24, 0.9, 0), new T.Vector3(1, 0, 0), 48],
        ...[-7.5, 7.5].map((x) => [
          new T.Vector3(x, 0.9, -22),
          new T.Vector3(0, 0, 1),
          44,
        ]),
      ];
      for (const [origin, direction, far] of routes) {
        const ray = new T.Raycaster(
          origin as T.Vector3,
          direction as T.Vector3,
          0,
          far as number,
        );
        assert.equal(ray.intersectObject(scene).length, 0);
      }
    } finally {
      scene.geometry.dispose();
      scene.material.dispose();
    }
  });
}
test("world styles have stable unique identities and safely recover an unknown saved preference", () => {
  assert.equal(new Set(worldThemes.map((t) => t.id)).size, 7);
  assert.equal(getWorldTheme("unknown").id, "forest");
  assert.equal(getWorldTheme(null).id, "forest");
  for (const id of ["space", "moon", "mars"]) {
    assert.equal(getWorldTheme(id).outfit, "space");
    assert.equal(getWorldTheme(id).shelter, true);
  }
  assert.equal(getWorldTheme("island").outfit, "beach");
  assert.equal(getWorldTheme("mountains").outfit, "winter");
  assert.equal(getWorldTheme("mountains").shelter, true);
});
